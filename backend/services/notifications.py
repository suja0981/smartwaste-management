"""
services/notifications.py  —  Phase 3: Firebase Cloud Messaging push notifications.

Notification triggers (IoT-only project, no CCTV):
  - Bin fill level crosses 80% (warning) or 90% (critical)
  - A task is assigned to a crew
  - A route is marked active (crew is on the way)

Token management:
  - Device tokens are stored in DeviceTokenDB.
  - POST /auth/device-token  →  register or refresh a token
  - Tokens are scoped to a user so we can target notifications
    (e.g., only the assigned crew gets "new task" notification).
"""

import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from database import DeviceTokenDB, UserDB, CrewDB
from firebase_service import _init_firebase   # reuses existing initialisation

logger = logging.getLogger(__name__)


# ─── Internal: send via FCM ───────────────────────────────────────────────────

def _send_fcm(tokens: List[str], title: str, body: str, data: dict = None) -> int:
    """
    Send a notification to a list of FCM tokens.

    Returns the number of messages successfully sent.
    Uses MulticastMessage for up to 500 tokens per call (FCM limit).
    Falls back silently if Firebase is not configured (dev without credentials).
    """
    if not tokens:
        return 0

    app = _init_firebase()
    if app is None:
        logger.debug("[FCM] Firebase not configured — notification skipped")
        return 0

    try:
        from firebase_admin import messaging

        notification = messaging.Notification(title=title, body=body)

        # Batch into chunks of 500 (FCM multicast limit)
        sent = 0
        chunk_size = 500
        for i in range(0, len(tokens), chunk_size):
            chunk = tokens[i: i + chunk_size]
            message = messaging.MulticastMessage(
                tokens=chunk,
                notification=notification,
                data={k: str(v) for k, v in (data or {}).items()},
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        sound="default",
                        default_vibrate_timings=True,
                    ),
                ),
            )
            response = messaging.send_each_for_multicast(message)
            sent += response.success_count
            if response.failure_count:
                logger.warning(f"[FCM] {response.failure_count} tokens failed in batch")

        logger.info(f"[FCM] Sent '{title}' to {sent}/{len(tokens)} tokens")
        return sent

    except Exception as e:
        logger.error(f"[FCM] Send failed: {e}")
        return 0


def _get_tokens_for_users(user_ids: List[int], db: Session) -> List[str]:
    """Fetch all active FCM tokens for a list of user IDs."""
    if not user_ids:
        return []
    rows = db.query(DeviceTokenDB.token).filter(
        DeviceTokenDB.user_id.in_(user_ids)
    ).all()
    return [r.token for r in rows]


def _get_admin_tokens(db: Session) -> List[str]:
    """Fetch FCM tokens for all admin users."""
    admins = db.query(UserDB.id).filter(
        UserDB.role == "admin", UserDB.is_active == True
    ).all()
    return _get_tokens_for_users([a.id for a in admins], db)


# ─── Public notification functions ───────────────────────────────────────────

def notify_bin_fill_warning(bin_id: str, location: str, fill_level: int, db: Session) -> None:
    """
    Called by the telemetry router when a bin crosses the 80% threshold.
    Notifies all admin users.
    """
    is_critical = fill_level >= 90
    title = f"🚨 Bin {bin_id} Critical" if is_critical else f"⚠️ Bin {bin_id} Warning"
    body = f"{location} is {fill_level}% full — {'immediate ' if is_critical else ''}collection needed"

    tokens = _get_admin_tokens(db)
    _send_fcm(
        tokens, title, body,
        data={"bin_id": bin_id, "fill_level": str(fill_level), "type": "bin_alert"},
    )


def notify_task_assigned(
    task_id: str,
    task_title: str,
    location: str,
    crew_id: str,
    db: Session,
) -> None:
    """
    Called by the tasks router when a task is assigned to a crew.
    Notifies all users linked to that crew (leader + members if they have tokens).
    In practice, the crew leader registers their device token after login.
    """
    crew = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    crew_name = crew.name if crew else crew_id

    # Find users whose email matches the crew email (simple linking strategy)
    if crew and crew.email:
        user = db.query(UserDB).filter(UserDB.email == crew.email).first()
        user_ids = [user.id] if user else []
    else:
        user_ids = []

    # Also notify all admins
    admins = db.query(UserDB.id).filter(
        UserDB.role == "admin", UserDB.is_active == True
    ).all()
    user_ids += [a.id for a in admins]

    tokens = _get_tokens_for_users(list(set(user_ids)), db)
    _send_fcm(
        tokens,
        title=f"📋 New Task — {crew_name}",
        body=f"{task_title} at {location}",
        data={"task_id": task_id, "crew_id": crew_id, "type": "task_assigned"},
    )


def notify_route_activated(route_id: str, crew_id: str, bin_count: int, db: Session) -> None:
    """
    Called when a route status changes to 'active'.
    Notifies admins so they can track progress.
    """
    crew = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    crew_name = crew.name if crew else crew_id

    tokens = _get_admin_tokens(db)
    _send_fcm(
        tokens,
        title=f"🚛 Route Started — {crew_name}",
        body=f"Collecting {bin_count} bins. Route ID: {route_id}",
        data={"route_id": route_id, "crew_id": crew_id, "type": "route_active"},
    )


# ─── Device token registration helper (used by auth router) ──────────────────

from datetime import datetime


def register_device_token(
    user_id: int, token: str, platform: str, db: Session
) -> DeviceTokenDB:
    """
    Upsert a device FCM token for a user.
    If the token already exists (different user), reassign it — handles
    the case where a device was wiped and re-used.
    """
    now = datetime.utcnow()
    record = db.query(DeviceTokenDB).filter(DeviceTokenDB.token == token).first()

    if record:
        # Reassign to current user (device may have been factory-reset)
        record.user_id = user_id
        record.platform = platform
        record.updated_at = now
    else:
        record = DeviceTokenDB(
            user_id=user_id,
            token=token,
            platform=platform,
            created_at=now,
            updated_at=now,
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return record


def unregister_device_token(token: str, db: Session) -> bool:
    """Remove a device token (called on logout)."""
    record = db.query(DeviceTokenDB).filter(DeviceTokenDB.token == token).first()
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True