"""
auth_utils.py — Shared auth dependencies for use across all routers.

FIX: Old version duplicated the JWT decode logic that also existed in auth.py.
     Now this file simply re-exports the single authoritative implementations.

Usage in any router:
    from auth_utils import get_current_user, require_admin, require_user
"""

# Re-export from the single source of truth so nothing breaks if other routers
# already import from here.
from routers.auth import get_current_user, require_admin  # noqa: F401
from database import UserDB, get_db                        # noqa: F401


def require_user(current_user: UserDB = None):
    """
    Alias kept for backward compatibility.
    Use get_current_user directly in new code — it already checks is_active.
    """
    from fastapi import Depends
    from routers.auth import get_current_user as _get_current_user

    def _inner(user: UserDB = Depends(_get_current_user)) -> UserDB:
        return user

    return _inner