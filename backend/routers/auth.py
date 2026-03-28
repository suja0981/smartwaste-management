"""
routers/auth.py — Phase 2 + Phase 3 update.

Phase 3 additions:
  POST /auth/device-token    register an FCM device token (push notifications)
  DELETE /auth/device-token  unregister on logout / token refresh

All other endpoints unchanged from Phase 2.

Fixes applied:
  - get_device_or_user: added token revocation (blacklist) check on JWT path.
    Previously a logged-out admin JWT still authenticated IoT telemetry.
  - All datetime.utcnow() replaced with datetime.now(timezone.utc)
    (utcnow() is deprecated in Python 3.12+).
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import get_settings
from database import UserDB, APIKeyDB, TokenBlacklistDB, get_db
from models import UserRegister, UserLogin, TokenResponse, UserResponse, TokenRefreshRequest
from security import PasswordPolicy
from firebase_service import verify_firebase_token, is_firebase_available
from api_key_services import generate_api_key, verify_api_key, revoke_api_key

settings = get_settings()
SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.refresh_token_expire_days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

router = APIRouter()


# ─── Pydantic models ──────────────────────────────────────────────────────────

class FirebaseLoginRequest(BaseModel):
    id_token: str

class APIKeyCreateRequest(BaseModel):
    label: str

class APIKeyResponse(BaseModel):
    key_id: int
    label: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None

class DeviceTokenRequest(BaseModel):
    """FCM device token registration — Phase 3."""
    token: str
    platform: str = "android"   # android | ios | web


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _now() -> datetime:
    """Current UTC time. Uses timezone-aware datetime (utcnow() is deprecated)."""
    return datetime.now(timezone.utc)

def _hash_password(password: str) -> str:
    return pwd_context.hash(password)

def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def _create_jwt(email: str, role: str, token_type: str = "access") -> str:
    now = _now()
    expire = (
        now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        if token_type == "refresh"
        else now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": email,
        "role": role,
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": token_type,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _is_token_revoked(token_jti: str, db: Session) -> bool:
    return (
        db.query(TokenBlacklistDB)
        .filter(TokenBlacklistDB.token_jti == token_jti)
        .first()
    ) is not None

def _revoke_token(token_jti: str, email: str, expires_at: datetime, db: Session) -> None:
    db.add(TokenBlacklistDB(
        token_jti=token_jti,
        email=email,
        revoked_at=_now(),
        expires_at=expires_at,
    ))
    db.commit()

def _user_to_response(user: UserDB) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
    )

def _upsert_firebase_user(decoded_token: dict, db: Session) -> UserDB:
    firebase_uid = decoded_token["uid"]
    email = decoded_token.get("email", "")
    full_name = decoded_token.get("name", email.split("@")[0])
    provider = decoded_token.get("firebase", {}).get("sign_in_provider", "firebase")

    user = db.query(UserDB).filter(UserDB.firebase_uid == firebase_uid).first()
    if not user and email:
        user = db.query(UserDB).filter(UserDB.email == email).first()
        if user:
            user.firebase_uid = firebase_uid
            user.auth_provider = provider

    if not user:
        user = UserDB(
            email=email,
            full_name=full_name,
            hashed_password=None,
            role="user",
            is_active=True,
            created_at=_now(),
            firebase_uid=firebase_uid,
            auth_provider=provider,
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    return user


# ─── Shared dependencies ──────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> UserDB:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type", "access")
        jti: str = payload.get("jti")

        if not email:
            raise ValueError("No subject in token")
        if jti and _is_token_revoked(jti, db):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if token_type != "access":
            raise ValueError("Refresh token cannot be used for API access")
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return user


def require_admin(current_user: UserDB = Depends(get_current_user)) -> UserDB:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def get_device_or_user(
    api_key: Optional[str] = Depends(api_key_header),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> dict:
    """
    Dual-auth dependency for the telemetry endpoint.

    - IoT devices supply  X-API-Key: wsk_live_<key>
    - Admins/testers supply  Authorization: Bearer <access_jwt>

    FIX: The JWT path now checks the token blacklist so a logged-out
    admin token can no longer authenticate telemetry ingestion.
    """
    if api_key:
        record = verify_api_key(api_key, db)
        if record:
            return {"type": "device", "identity": record, "label": record.label}
        raise HTTPException(status_code=401, detail="Invalid API key")

    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            token_type = payload.get("type", "access")
            jti = payload.get("jti")

            if token_type != "access":
                raise ValueError("Not an access token")
            if jti and _is_token_revoked(jti, db):
                raise HTTPException(status_code=401, detail="Token has been revoked")

            user = db.query(UserDB).filter(UserDB.email == email).first()
            if user and user.is_active:
                return {"type": "user", "identity": user, "label": user.email}
        except (JWTError, ValueError):
            pass

    raise HTTPException(
        status_code=401,
        detail="Provide either X-API-Key header (IoT devices) or Authorization: Bearer <token>",
    )


# ─── POST /auth/signup ────────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse)
def signup(user_data: UserRegister, db: Session = Depends(get_db)):
    is_valid, msg = PasswordPolicy.validate_password(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=422, detail=msg)
    if db.query(UserDB).filter(UserDB.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = UserDB(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=_hash_password(user_data.password),
        role="user",
        is_active=True,
        created_at=_now(),
        auth_provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=_create_jwt(user.email, user.role, "access"),
        refresh_token=_create_jwt(user.email, user.role, "refresh"),
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─── POST /auth/login ─────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == user_data.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not _verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    return TokenResponse(
        access_token=_create_jwt(user.email, user.role, "access"),
        refresh_token=_create_jwt(user.email, user.role, "refresh"),
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─── POST /auth/firebase ──────────────────────────────────────────────────────

@router.post("/firebase", response_model=TokenResponse)
def firebase_login(body: FirebaseLoginRequest, db: Session = Depends(get_db)):
    if not is_firebase_available():
        raise HTTPException(status_code=503, detail="Firebase auth not configured on this server.")

    decoded = verify_firebase_token(body.id_token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token.")

    user = _upsert_firebase_user(decoded, db)
    return TokenResponse(
        access_token=_create_jwt(user.email, user.role, "access"),
        refresh_token=_create_jwt(user.email, user.role, "refresh"),
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─── GET /auth/me ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserDB = Depends(get_current_user)):
    return _user_to_response(current_user)


# ─── POST /auth/logout ────────────────────────────────────────────────────────

@router.post("/logout")
def logout(
    current_user: UserDB = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti:
            exp_datetime = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
            _revoke_token(jti, current_user.email, exp_datetime, db)
    except JWTError:
        pass
    return {"message": "Logged out successfully"}


# ─── POST /auth/refresh ──────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: TokenRefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        token_type: str = payload.get("type")
        jti: str = payload.get("jti")

        if token_type != "refresh":
            raise ValueError("Not a refresh token")
        if not email or not role:
            raise ValueError("Invalid claims")
        if jti and _is_token_revoked(jti, db):
            raise HTTPException(status_code=401, detail="Refresh token has been revoked")
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")

    return TokenResponse(
        access_token=_create_jwt(email, role, "access"),
        refresh_token=body.refresh_token,
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─── POST /auth/device-token  (Phase 3 — FCM) ────────────────────────────────

@router.post("/device-token", status_code=201)
def register_device_token(
    body: DeviceTokenRequest,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Register an FCM device token for push notifications.
    Call this immediately after login with the token from the Firebase SDK.

    Body: { "token": "<fcm_registration_token>", "platform": "android" }
    """
    from services.notifications import register_device_token as _register
    _register(current_user.id, body.token, body.platform, db)
    return {"registered": True, "platform": body.platform}


@router.delete("/device-token")
def unregister_device_token(
    body: DeviceTokenRequest,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unregister an FCM device token. Call on logout or app uninstall."""
    from services.notifications import unregister_device_token as _unregister
    removed = _unregister(body.token, db)
    return {"unregistered": removed}


# ─── IoT API Key management ───────────────────────────────────────────────────

@router.post("/api-keys")
def create_api_key(
    body: APIKeyCreateRequest,
    db: Session = Depends(get_db),
    _admin: UserDB = Depends(require_admin),
):
    """Generate a new API key for an IoT device. Admin only."""
    return generate_api_key(body.label, db)


@router.get("/api-keys", response_model=List[APIKeyResponse])
def list_api_keys(
    db: Session = Depends(get_db),
    _admin: UserDB = Depends(require_admin),
):
    keys = db.query(APIKeyDB).order_by(APIKeyDB.created_at.desc()).all()
    return [
        APIKeyResponse(
            key_id=k.id,
            label=k.label,
            is_active=k.is_active,
            created_at=k.created_at,
            last_used_at=k.last_used_at,
        )
        for k in keys
    ]


@router.delete("/api-keys/{key_id}", status_code=204)
def delete_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    _admin: UserDB = Depends(require_admin),
):
    if not revoke_api_key(key_id, db):
        raise HTTPException(status_code=404, detail="API key not found")
    return None