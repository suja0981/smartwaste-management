"""
api_key_services.py

Lightweight API key auth for IoT devices.

Why not Firebase for devices?
  Firebase auth requires a network round-trip to Google's servers and a
  client SDK. An ESP32 or Raspberry Pi posting telemetry every 30 seconds
  just needs a static secret header — fast, simple, no SDK.

Security design:
  - Keys are generated with secrets.token_urlsafe (128-bit entropy)
  - Only the SHA-256 hash is stored in the database (never the plaintext)
  - The plaintext is shown exactly once at creation time
  - Keys are prefixed with "wsk_live_" so they're recognisable in logs
"""

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from database import APIKeyDB
from config import get_settings

settings = get_settings()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_key(plain_key: str) -> str:
    """SHA-256 hash of the plain key. This is what gets stored."""
    return hashlib.sha256(plain_key.encode()).hexdigest()


def generate_api_key(label: str, db: Session) -> dict:
    """
    Generate a new API key.

    Returns:
        {
            "key": "wsk_live_abc123...",   ← show this ONCE, then discard
            "key_id": 42,
            "label": "Bin Sensor - Site A"
        }
    """
    raw = secrets.token_urlsafe(32)
    plain_key = f"{settings.api_key_prefix}{raw}"

    record = APIKeyDB(
        key_hash=_hash_key(plain_key),
        label=label,
        is_active=True,
        created_at=_now(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "key": plain_key,       # shown once — not stored
        "key_id": record.id,
        "label": record.label,
        "note": "Store this key securely. It will not be shown again.",
    }


def verify_api_key(plain_key: str, db: Session) -> Optional[APIKeyDB]:
    """
    Verify an API key from the X-API-Key header.

    Returns the APIKeyDB record if valid and active, else None.
    Updates last_used_at on every successful verification.
    """
    if not plain_key or not plain_key.startswith(settings.api_key_prefix):
        return None

    key_hash = _hash_key(plain_key)
    record = db.query(APIKeyDB).filter(
        APIKeyDB.key_hash == key_hash,
        APIKeyDB.is_active == True,  # noqa: E712
    ).first()

    if record:
        record.last_used_at = _now()
        db.commit()

    return record


def revoke_api_key(key_id: int, db: Session) -> bool:
    """Deactivate an API key by its DB id."""
    record = db.query(APIKeyDB).filter(APIKeyDB.id == key_id).first()
    if not record:
        return False
    record.is_active = False
    db.commit()
    return True