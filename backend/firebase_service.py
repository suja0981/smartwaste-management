"""
firebase_service.py — updated for sgm-project-fc254.

Key change: verify_id_token() now passes check_revoked=True and the
project-specific audience so tokens from OTHER Firebase projects are
rejected even if they're validly signed.
"""

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_firebase_app = None
_init_attempted = False


def _init_firebase():
    global _firebase_app, _init_attempted

    if _init_attempted:
        return _firebase_app

    _init_attempted = True

    try:
        import firebase_admin
        from firebase_admin import credentials
        from config import get_settings

        settings = get_settings()

        if not settings.firebase_configured():
            logger.warning(
                "Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH "
                "in backend/.env to enable Firebase auth."
            )
            return None

        if settings.firebase_credentials_json:
            cred = credentials.Certificate(
                json.loads(settings.firebase_credentials_json)
            )
        elif settings.firebase_service_account_path:
            cred = credentials.Certificate(settings.firebase_service_account_path)
        else:
            return None

        if not firebase_admin._apps:
            _firebase_app = firebase_admin.initialize_app(cred)
        else:
            _firebase_app = firebase_admin.get_app()

        logger.info(
            f"Firebase Admin SDK initialised for project: "
            f"{settings.firebase_project_id or 'sgm-project-fc254'}"
        )
        return _firebase_app

    except ImportError:
        logger.error(
            "firebase-admin not installed. "
            "Run: pip install firebase-admin==6.5.0"
        )
        return None
    except Exception as e:
        logger.error(f"Firebase initialisation failed: {e}")
        return None


def verify_firebase_token(id_token: str) -> Optional[dict]:
    """
    Verify a Firebase ID token from the frontend.

    Checks:
      - Token signature (using your service account)
      - Token expiry
      - Token was issued for sgm-project-fc254 specifically
      - Token has not been revoked (check_revoked=True)

    Returns decoded token dict on success, None on any failure.
    """
    app = _init_firebase()
    if app is None:
        return None

    try:
        from firebase_admin import auth
        from config import get_settings

        settings = get_settings()

        decoded = auth.verify_id_token(
            id_token,
            check_revoked=True,          # rejects tokens revoked via Firebase console
            # app= not needed since we only have one initialised app
        )

        # Extra guard: confirm the token is for YOUR project
        # (protects against token substitution attacks)
        expected_project = settings.firebase_project_id or "sgm-project-fc254"
        if decoded.get("aud") != expected_project:
            logger.warning(
                f"Token audience mismatch: expected {expected_project}, "
                f"got {decoded.get('aud')}"
            )
            return None

        return decoded

    except Exception as e:
        logger.warning(f"Firebase token verification failed: {e}")
        return None


def is_firebase_available() -> bool:
    return _init_firebase() is not None