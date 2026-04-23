"""
security.py — Security hardening for the Smart Waste Management API.

Includes:
  - SecurityHeadersMiddleware   : adds standard HTTP security headers
  - RateLimitMiddleware         : per-IP request throttling (general API)
  - AuthRateLimitMiddleware     : stricter throttling on /auth/* endpoints
  - InputValidationMiddleware   : rejects oversized request bodies
  - PasswordPolicy              : enforces strong passwords at signup

NOTE — rate limiter storage:
  Request counters are stored in-memory per process. In a multi-worker
  deployment (e.g. Gunicorn with 4 workers) each worker maintains its own
  counter, so the effective limit is requests_per_minute × worker_count.
  For single-worker or development use this is fine. For production with
  multiple workers, replace the dict storage with Redis.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime
from collections import defaultdict
import time
from typing import Dict, Tuple


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard HTTP security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        # BaseHTTPMiddleware must not intercept WebSocket upgrade requests —
        # doing so corrupts the ASGI send/receive channels for the WS protocol.
        if request.scope["type"] == "websocket":
            return await call_next(request)

        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://www.gstatic.com; "
            "style-src 'self' 'unsafe-inline' https://unpkg.com; "
            "img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com blob:; "
            "connect-src 'self' https://www.google-analytics.com https://*.vercel-insights.com wss:; "
            "font-src 'self' data:; "
            "frame-ancestors 'none'"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Server"] = "SmartWaste/1.0"

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Per-IP rate limiting for the general API.
    Default: 200 requests per minute (set higher to accommodate IoT devices).
    """

    def __init__(self, app: FastAPI, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list] = defaultdict(list)
        self.cleanup_interval = 300
        self.last_cleanup = time.time()

    async def dispatch(self, request: Request, call_next):
        if request.scope["type"] == "websocket":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"

        now = time.time()
        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_entries(now)
            self.last_cleanup = now

        minute_ago = now - 60
        self.requests[client_ip] = [
            t for t in self.requests[client_ip] if t > minute_ago
        ]

        if len(self.requests[client_ip]) >= self.requests_per_minute:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many requests",
                    "message": f"Rate limit exceeded: {self.requests_per_minute} requests per minute",
                    "retry_after": 60,
                },
                headers={"Retry-After": "60"},
            )

        self.requests[client_ip].append(now)

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            self.requests_per_minute - len(self.requests[client_ip])
        )
        return response

    def _cleanup_old_entries(self, current_time: float):
        cutoff = current_time - 3600
        for ip in list(self.requests.keys()):
            self.requests[ip] = [t for t in self.requests[ip] if t > cutoff]
            if not self.requests[ip]:
                del self.requests[ip]


class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Stricter rate limiting for /auth/* endpoints.
    Limits: 5 requests per minute per IP.
    Progressive lockout: 5-minute lockout after 10 failed attempts.
    """

    def __init__(self, app: FastAPI, requests_per_minute: int = 5):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list] = defaultdict(list)
        self.failed_attempts: Dict[str, list] = defaultdict(list)
        self.lockout_threshold = 10
        self.lockout_duration = 300   # 5 minutes
        self.cleanup_interval = 300
        self.last_cleanup = time.time()

    async def dispatch(self, request: Request, call_next):
        if request.scope["type"] == "websocket":
            return await call_next(request)

        if not request.url.path.startswith("/auth/"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_entries(now)
            self.last_cleanup = now

        # Check lockout
        recent_failures = [
            t for t in self.failed_attempts.get(client_ip, [])
            if t > now - self.lockout_duration
        ]
        if len(recent_failures) >= self.lockout_threshold:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many authentication attempts",
                    "message": "Account temporarily locked. Please try again later.",
                    "retry_after": self.lockout_duration,
                },
                headers={"Retry-After": str(self.lockout_duration)},
            )

        # Check per-minute rate limit
        minute_ago = now - 60
        self.requests[client_ip] = [
            t for t in self.requests[client_ip] if t > minute_ago
        ]

        if len(self.requests[client_ip]) >= self.requests_per_minute:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many authentication attempts. Max {self.requests_per_minute} per minute.",
                    "retry_after": 60,
                },
                headers={"Retry-After": "60"},
            )

        self.requests[client_ip].append(now)

        response = await call_next(request)

        if response.status_code in (400, 401, 422):
            self.failed_attempts[client_ip].append(now)

        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, self.requests_per_minute - len(self.requests[client_ip]))
        )
        return response

    def _cleanup_old_entries(self, current_time: float):
        cutoff = current_time - 3600
        for mapping in (self.requests, self.failed_attempts):
            for ip in list(mapping.keys()):
                mapping[ip] = [t for t in mapping[ip] if t > cutoff]
                if not mapping[ip]:
                    del mapping[ip]


class InputValidationMiddleware(BaseHTTPMiddleware):
    """Rejects requests with a Content-Length above 10 MB."""

    _MAX_BYTES = 10 * 1024 * 1024  # 10 MB

    async def dispatch(self, request: Request, call_next):
        if request.scope["type"] == "websocket":
            return await call_next(request)

        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > self._MAX_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Payload too large", "max_bytes": self._MAX_BYTES},
                    )
            except (ValueError, TypeError):
                pass

        return await call_next(request)


def add_security_to_app(
    app: FastAPI,
    enable_rate_limiting: bool = True,
    enable_auth_rate_limiting: bool = True,
    requests_per_minute: int = 60,
):
    """
    Attach all security middleware to the FastAPI application.

    Args:
        app: FastAPI application instance
        enable_rate_limiting: Whether to enable general rate limiting
        enable_auth_rate_limiting: Whether to enable /auth/* throttling
        requests_per_minute: General API rate limit (per IP, per worker)
    """
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(InputValidationMiddleware)
    if enable_auth_rate_limiting:
        app.add_middleware(AuthRateLimitMiddleware, requests_per_minute=5)
    if enable_rate_limiting:
        app.add_middleware(RateLimitMiddleware, requests_per_minute=requests_per_minute)


class PasswordPolicy:
    """Validates and scores user passwords at signup."""

    @staticmethod
    def validate_password(password: str) -> Tuple[bool, str]:
        """
        Returns (is_valid, error_message).

        Requirements: 8+ chars, uppercase, lowercase, digit, special character.
        """
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"
        if not any(c.isupper() for c in password):
            return False, "Password must contain at least one uppercase letter"
        if not any(c.islower() for c in password):
            return False, "Password must contain at least one lowercase letter"
        if not any(c.isdigit() for c in password):
            return False, "Password must contain at least one digit"

        special_chars = "!@#$%^&*()_+-=[]{}|;:',.<>?/`~"
        if not any(c in special_chars for c in password):
            return False, "Password must contain at least one special character"

        return True, ""

    @staticmethod
    def get_password_strength(password: str) -> str:
        """Returns 'weak', 'moderate', or 'strong'."""
        score = sum([
            len(password) >= 8,
            len(password) >= 12,
            any(c.isupper() for c in password),
            any(c.islower() for c in password),
            any(c.isdigit() for c in password),
            any(c in "!@#$%^&*()_+-=[]{}|;:',.<>?/`~" for c in password),
        ])
        if score <= 2:
            return "weak"
        elif score <= 4:
            return "moderate"
        return "strong"
