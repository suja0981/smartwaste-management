"""
auth_utils.py — Shared auth dependencies for use across all routers.

Re-exports the single authoritative implementations from routers/auth.py
so all routers import from one place and there is no duplicated JWT logic.

Usage in any router:
    from auth_utils import get_current_user, require_admin
"""

from routers.auth import get_current_user, require_admin  # noqa: F401
from database import UserDB, get_db                        # noqa: F401