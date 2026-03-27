"""
routers/auth.py — Phase 2 complete implementation.

Endpoints:
  POST /auth/signup          local email/password registration
  POST /auth/login           local email/password login
  POST /auth/firebase        Firebase ID token → our JWT (Google + email)
  GET  /auth/me              current user info
  POST /auth/logout          client-side logout hint
  POST /auth/api-keys        generate IoT device API key  [admin only]
  GET  /auth/api-keys        list all API keys            [admin only]
  DELETE /auth/api-keys/{id} revoke an API key            [admin only]
"""

from datetime import datetime, timedelta
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
http_bearer = HTTPBearer(auto_error=False)   # auto_error=False so IoT routes can use API key instead
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

router = APIRouter()


# ─── Pydantic models (auth-specific, not in models.py) ───────────────────────

class FirebaseLoginRequest(BaseModel):
    id_token: str       # Firebase ID token from the frontend

class APIKeyCreateRequest(BaseModel):
    label: str          # e.g. "Bin Sensor - Site A"

class APIKeyResponse(BaseModel):
    key_id: int
    label: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return pwd_context.hash(password)

def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def _create_jwt(email: str, role: str, token_type: str = "access") -> str:
    """
    Create a JWT token.
    token_type: 'access' (30 min) or 'refresh' (7 days)
    """
    if token_type == "refresh":
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    else:  # access
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    jti = str(uuid.uuid4())  # JWT ID for revocation
    payload = {
        "sub": email,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": jti,
        "type": token_type,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _is_token_revoked(token_jti: str, db: Session) -> bool:
    """Check if a token has been revoked (blacklisted)"""
    return db.query(TokenBlacklistDB).filter(
        TokenBlacklistDB.token_jti == token_jti
    ).first() is not None

def _revoke_token(token_jti: str, email: str, expires_at: datetime, db: Session) -> None:
    """Add a token to the blacklist"""
    blacklist_entry = TokenBlacklistDB(
        token_jti=token_jti,
        email=email,
        revoked_at=datetime.utcnow(),
        expires_at=expires_at,
    )
    db.add(blacklist_entry)
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
    """
    Find or create a UserDB row for a Firebase-authenticated user.
    Called on every Firebase login so profile info stays fresh.
    """
    firebase_uid = decoded_token["uid"]
    email = decoded_token.get("email", "")
    full_name = decoded_token.get("name", email.split("@")[0])
    provider = decoded_token.get("firebase", {}).get("sign_in_provider", "firebase")

    # 1. Look up by firebase_uid (returning user)
    user = db.query(UserDB).filter(UserDB.firebase_uid == firebase_uid).first()

    # 2. Look up by email (user may have signed up locally before)
    if not user and email:
        user = db.query(UserDB).filter(UserDB.email == email).first()
        if user:
            # Link their existing account to Firebase
            user.firebase_uid = firebase_uid
            user.auth_provider = provider

    # 3. Brand-new user — create a row
    if not user:
        user = UserDB(
            email=email,
            full_name=full_name,
            hashed_password=None,       # no password for OAuth users
            role="user",
            is_active=True,
            created_at=datetime.utcnow(),
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
    """
    Validates our own JWT (issued after local login OR Firebase login).
    Used by all protected endpoints except IoT telemetry.
    Checks for token revocation (blacklist).
    """
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
        
        # Check if token is revoked
        if jti and _is_token_revoked(jti, db):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Only access tokens are valid for API calls
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
    Flexible auth for IoT endpoints — accepts either:
      - X-API-Key header  (IoT devices / CCTV systems)
      - Bearer JWT        (dashboard or testing via Swagger)

    Returns a dict with {"type": "device"|"user", "identity": ...}
    so the caller knows who sent the request.
    """
    # Try API key first
    if api_key:
        record = verify_api_key(api_key, db)
        if record:
            return {"type": "device", "identity": record, "label": record.label}
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Fall back to JWT
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            user = db.query(UserDB).filter(UserDB.email == email).first()
            if user and user.is_active:
                return {"type": "user", "identity": user, "label": user.email}
        except JWTError:
            pass

    raise HTTPException(
        status_code=401,
        detail="Provide either X-API-Key header (IoT devices) or Authorization: Bearer <token>",
    )


# ─── POST /auth/signup ────────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse)
def signup(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register with email + password. PasswordPolicy enforced."""
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
        created_at=datetime.utcnow(),
        auth_provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = _create_jwt(user.email, user.role, token_type="access")
    refresh_token = _create_jwt(user.email, user.role, token_type="refresh")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─── POST /auth/login ─────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login with email + password (local accounts only)."""
    user = db.query(UserDB).filter(UserDB.email == user_data.email).first()

    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not _verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    access_token = _create_jwt(user.email, user.role, token_type="access")
    refresh_token = _create_jwt(user.email, user.role, token_type="refresh")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─── POST /auth/firebase ──────────────────────────────────────────────────────

@router.post("/firebase", response_model=TokenResponse)
def firebase_login(body: FirebaseLoginRequest, db: Session = Depends(get_db)):
    """
    Exchange a Firebase ID token for our own JWT.

    Flow:
      1. Frontend signs in with Google (or email) via Firebase SDK
      2. Frontend gets a Firebase ID token
      3. Frontend POSTs { "id_token": "..." } here
      4. We verify with Firebase Admin SDK
      5. We upsert the user in our database
      6. We return our own JWT — identical format to /auth/login

    This keeps every other API endpoint unchanged — they all just see a
    normal JWT regardless of how the user authenticated.
    """
    if not is_firebase_available():
        raise HTTPException(
            status_code=503,
            detail=(
                "Firebase auth is not configured on this server. "
                "Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_CREDENTIALS_JSON "
                "in your backend .env file."
            ),
        )

    decoded = verify_firebase_token(body.id_token)
    if not decoded:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Firebase token. Please sign in again.",
        )

    user = _upsert_firebase_user(decoded, db)

    access_token = _create_jwt(user.email, user.role, token_type="access")
    refresh_token = _create_jwt(user.email, user.role, token_type="refresh")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
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
    """
    Logout by revoking the current JWT token.
    The token is added to the blacklist so it can't be reused even if intercepted.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        
        if jti:
            exp_datetime = datetime.utcfromtimestamp(exp) if exp else None
            _revoke_token(jti, current_user.email, exp_datetime, db)
    except JWTError:
        pass  # Even if token is invalid, return success

    return {"message": "Logged out successfully"}


# ─── POST /auth/refresh ──────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    body: TokenRefreshRequest,
    db: Session = Depends(get_db),
):
    """
    Exchange a refresh token for a new access token.
    
    Refresh tokens expire every 7 days. Users should call this endpoint
    when their access token expires (every 30 minutes).
    """
    try:
        payload = jwt.decode(body.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        token_type: str = payload.get("type")
        jti: str = payload.get("jti")
        
        if token_type != "refresh":
            raise ValueError("Token is not a refresh token")
        
        if not email or not role:
            raise ValueError("Invalid token claims")
        
        # Check if refresh token has been revoked
        if jti and _is_token_revoked(jti, db):
            raise HTTPException(
                status_code=401,
                detail="Refresh token has been revoked",
            )
        
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token",
        )

    # Verify user still exists and is active
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")

    # Issue new access token (but keep the same refresh token)
    new_access_token = _create_jwt(email, role, token_type="access")

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=body.refresh_token,  # Refresh token remains valid
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─── IoT API Key management (admin only) ─────────────────────────────────────

@router.post("/api-keys")
def create_api_key(
    body: APIKeyCreateRequest,
    db: Session = Depends(get_db),
    _admin: UserDB = Depends(require_admin),
):
    """
    Generate a new API key for an IoT device or CCTV system.
    The plaintext key is returned ONCE — store it on the device immediately.
    Admin only.
    """
    return generate_api_key(body.label, db)


@router.get("/api-keys", response_model=List[APIKeyResponse])
def list_api_keys(
    db: Session = Depends(get_db),
    _admin: UserDB = Depends(require_admin),
):
    """List all API keys (hashes only — plaintext never stored). Admin only."""
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
    """Revoke an API key. The device using it will immediately get 401s. Admin only."""
    success = revoke_api_key(key_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="API key not found")
    return None