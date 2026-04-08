from datetime import datetime, timedelta, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from api_key_services import generate_api_key, revoke_api_key, verify_api_key
from config import get_settings
from database import APIKeyDB, TokenBlacklistDB, UserDB, UserSettingsDB, get_db
from firebase_service import is_firebase_available, verify_firebase_token
from models import TokenRefreshRequest, TokenResponse, UserLogin, UserRegister, UserResponse
from security import PasswordPolicy

settings = get_settings()
SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.refresh_token_expire_days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

router = APIRouter()


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
    token: str
    platform: str = "android"


class NotificationSettingsModel(BaseModel):
    criticalBins: bool = True
    routeUpdates: bool = True
    systemAlerts: bool = False
    emailDigest: bool = False
    pushEnabled: bool = False


class DisplaySettingsModel(BaseModel):
    compactMode: bool = False
    autoRefresh: bool = True


class UserSettingsResponse(BaseModel):
    full_name: str
    email: str
    notifications: NotificationSettingsModel
    display: DisplaySettingsModel


class UserSettingsUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    notifications: NotificationSettingsModel
    display: DisplaySettingsModel


def _now() -> datetime:
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
    # Lazily prune expired entries on every revocation to prevent unbounded
    # table growth. The indexed expires_at column makes this a fast range scan.
    db.query(TokenBlacklistDB).filter(
        TokenBlacklistDB.expires_at < _now()
    ).delete(synchronize_session=False)
    db.add(
        TokenBlacklistDB(
            token_jti=token_jti,
            email=email,
            revoked_at=_now(),
            expires_at=expires_at,
        )
    )
    db.commit()


def _user_to_response(user: UserDB) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
    )


def _get_or_create_settings(user_id: int, db: Session) -> UserSettingsDB:
    settings_row = db.query(UserSettingsDB).filter(UserSettingsDB.user_id == user_id).first()
    if settings_row:
        return settings_row

    settings_row = UserSettingsDB(
        user_id=user_id,
        critical_bins=True,
        route_updates=True,
        system_alerts=False,
        email_digest=False,
        push_enabled=False,
        compact_mode=False,
        auto_refresh=True,
        updated_at=_now(),
    )
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


def _settings_to_response(user: UserDB, settings_row: UserSettingsDB) -> UserSettingsResponse:
    return UserSettingsResponse(
        full_name=user.full_name,
        email=user.email,
        notifications=NotificationSettingsModel(
            criticalBins=settings_row.critical_bins,
            routeUpdates=settings_row.route_updates,
            systemAlerts=settings_row.system_alerts,
            emailDigest=settings_row.email_digest,
            pushEnabled=settings_row.push_enabled,
        ),
        display=DisplaySettingsModel(
            compactMode=settings_row.compact_mode,
            autoRefresh=settings_row.auto_refresh,
        ),
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
        try:
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
        except IntegrityError:
            # A concurrent Firebase login inserted the same user between our
            # read and write (TOCTOU race). Roll back and re-read from DB.
            db.rollback()
            user = (
                db.query(UserDB).filter(UserDB.firebase_uid == firebase_uid).first()
                or db.query(UserDB).filter(UserDB.email == email).first()
            )
            if not user:
                raise HTTPException(status_code=500, detail="Failed to create user account")
    else:
        db.commit()
    db.refresh(user)
    _get_or_create_settings(user.id, db)
    return user


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
        email = payload.get("sub")
        token_type = payload.get("type", "access")
        jti = payload.get("jti")

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
        detail="Provide either X-API-Key header or Authorization: Bearer <token>",
    )


@router.post("/signup", response_model=TokenResponse)
def signup(user_data: UserRegister, db: Session = Depends(get_db)):
    is_valid, message = PasswordPolicy.validate_password(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=422, detail=message)
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
    _get_or_create_settings(user.id, db)

    return TokenResponse(
        access_token=_create_jwt(user.email, user.role, "access"),
        refresh_token=_create_jwt(user.email, user.role, "refresh"),
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=TokenResponse)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == user_data.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not _verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    _get_or_create_settings(user.id, db)
    return TokenResponse(
        access_token=_create_jwt(user.email, user.role, "access"),
        refresh_token=_create_jwt(user.email, user.role, "refresh"),
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/firebase", response_model=TokenResponse)
def firebase_login(body: FirebaseLoginRequest, db: Session = Depends(get_db)):
    if not is_firebase_available():
        raise HTTPException(status_code=503, detail="Firebase auth is not configured on this server.")

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


@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserDB = Depends(get_current_user)):
    return _user_to_response(current_user)


@router.get("/settings", response_model=UserSettingsResponse)
def get_settings_for_user(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings_row = _get_or_create_settings(current_user.id, db)
    return _settings_to_response(current_user, settings_row)


@router.put("/settings", response_model=UserSettingsResponse)
def update_settings_for_user(
    body: UserSettingsUpdateRequest,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings_row = _get_or_create_settings(current_user.id, db)

    if body.full_name is not None and body.full_name.strip():
        current_user.full_name = body.full_name.strip()

    settings_row.critical_bins = body.notifications.criticalBins
    settings_row.route_updates = body.notifications.routeUpdates
    settings_row.system_alerts = body.notifications.systemAlerts
    settings_row.email_digest = body.notifications.emailDigest
    settings_row.push_enabled = body.notifications.pushEnabled
    settings_row.compact_mode = body.display.compactMode
    settings_row.auto_refresh = body.display.autoRefresh
    settings_row.updated_at = _now()

    db.commit()
    db.refresh(current_user)
    db.refresh(settings_row)
    return _settings_to_response(current_user, settings_row)


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


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: TokenRefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        role = payload.get("role")
        token_type = payload.get("type")
        jti = payload.get("jti")
        exp = payload.get("exp")

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

    # Rotate: revoke the consumed refresh token and issue a fresh one.
    # A stolen refresh token can therefore only be exchanged once.
    if jti:
        exp_dt = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
        _revoke_token(jti, email, exp_dt, db)

    _get_or_create_settings(user.id, db)
    return TokenResponse(
        access_token=_create_jwt(email, role, "access"),
        refresh_token=_create_jwt(email, role, "refresh"),
        user=_user_to_response(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/device-token", status_code=201)
def register_device_token(
    body: DeviceTokenRequest,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from services.notifications import register_device_token as _register

    _register(current_user.id, body.token, body.platform, db)
    return {"registered": True, "platform": body.platform}


@router.delete("/device-token")
def unregister_device_token(
    body: DeviceTokenRequest,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from services.notifications import unregister_device_token as _unregister

    removed = _unregister(body.token, db)
    return {"unregistered": removed}


@router.post("/api-keys")
def create_api_key(
    body: APIKeyCreateRequest,
    db: Session = Depends(get_db),
    _admin: UserDB = Depends(require_admin),
):
    return generate_api_key(body.label, db)


@router.get("/api-keys", response_model=List[APIKeyResponse])
def list_api_keys(
    db: Session = Depends(get_db),
    _admin: UserDB = Depends(require_admin),
):
    keys = db.query(APIKeyDB).order_by(APIKeyDB.created_at.desc()).all()
    return [
        APIKeyResponse(
            key_id=key.id,
            label=key.label,
            is_active=key.is_active,
            created_at=key.created_at,
            last_used_at=key.last_used_at,
        )
        for key in keys
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
