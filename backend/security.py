"""
Security hardening module for Smart Waste Management API
Includes middleware for security headers, rate limiting, and input validation
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta
from collections import defaultdict
import time
from typing import Dict, Tuple, Set


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses
    Helps protect against common web vulnerabilities
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Server"] = "SmartWaste/1.0"  # Hide actual server info
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple rate limiting middleware
    Limits requests per IP address per time window
    """

    def __init__(self, app: FastAPI, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list] = defaultdict(list)
        self.cleanup_interval = 300  # Clean up old entries every 5 minutes
        self.last_cleanup = time.time()

    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Cleanup old entries periodically
        now = time.time()
        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_entries(now)
            self.last_cleanup = now
        
        # Check rate limit
        minute_ago = now - 60
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if req_time > minute_ago
        ]
        
        if len(self.requests[client_ip]) >= self.requests_per_minute:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many requests",
                    "message": f"Rate limit exceeded: {self.requests_per_minute} requests per minute",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )
        
        self.requests[client_ip].append(now)
        
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            self.requests_per_minute - len(self.requests[client_ip])
        )
        
        return response

    def _cleanup_old_entries(self, current_time: float):
        """Remove old IP entries to prevent memory buildup"""
        cutoff_time = current_time - 3600  # Keep 1 hour of data
        for ip in list(self.requests.keys()):
            self.requests[ip] = [
                req_time for req_time in self.requests[ip]
                if req_time > cutoff_time
            ]
            if not self.requests[ip]:
                del self.requests[ip]


class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Stricter rate limiting for authentication endpoints.
    Prevents brute force attacks on login, signup, and password reset.
    
    Limits: 5 attempts per minute per IP address
    """

    def __init__(self, app: FastAPI, requests_per_minute: int = 5):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list] = defaultdict(list)
        self.cleanup_interval = 300
        self.last_cleanup = time.time()
        # Track failed login attempts for progressive lockout
        self.failed_attempts: Dict[str, list] = defaultdict(list)
        self.lockout_threshold = 10  # Lock out after 10 failed attempts
        self.lockout_duration = 300  # 5 minutes lockout

    async def dispatch(self, request: Request, call_next):
        # Only apply to auth endpoints
        if not request.url.path.startswith("/auth/"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        # Cleanup periodically
        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_entries(now)
            self.last_cleanup = now

        # Check if IP is currently locked out
        lockout_attempts = [
            t for t in self.failed_attempts.get(client_ip, [])
            if t > now - self.lockout_duration
        ]
        if len(lockout_attempts) >= self.lockout_threshold:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many authentication attempts",
                    "message": "Account temporarily locked. Please try again later.",
                    "retry_after": self.lockout_duration,
                },
                headers={"Retry-After": str(self.lockout_duration)},
            )

        # Check general rate limit (5 per minute)
        minute_ago = now - 60
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if req_time > minute_ago
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

        # Call the actual endpoint
        response = await call_next(request)

        # Track failed login/signup attempts
        if response.status_code in [401, 422, 400]:  # Auth failure codes
            self.failed_attempts[client_ip].append(now)

        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, self.requests_per_minute - len(self.requests[client_ip]))
        )

        return response

    def _cleanup_old_entries(self, current_time: float):
        """Remove old entries to prevent memory buildup"""
        cutoff_time = current_time - 3600
        for ip in list(self.requests.keys()):
            self.requests[ip] = [
                t for t in self.requests[ip] if t > cutoff_time
            ]
            if not self.requests[ip]:
                del self.requests[ip]
        for ip in list(self.failed_attempts.keys()):
            self.failed_attempts[ip] = [
                t for t in self.failed_attempts[ip] if t > cutoff_time
            ]
            if not self.failed_attempts[ip]:
                del self.failed_attempts[ip]


class InputValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate and sanitize input
    Helps prevent injection attacks and malformed requests
    """

    async def dispatch(self, request: Request, call_next):
        # Check for excessive request size (limit to 10MB)
        max_content_length = 10 * 1024 * 1024  # 10MB
        content_length = request.headers.get("content-length")
        
        if content_length:
            try:
                if int(content_length) > max_content_length:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Payload too large"}
                    )
            except (ValueError, TypeError):
                pass
        
        # Check for suspicious headers
        suspicious_headers = ["x-forwarded-proto", "x-forwarded-for"]
        for header in suspicious_headers:
            if request.headers.get(header):
                # Log suspicious activity (in production, use proper logging)
                pass
        
        response = await call_next(request)
        return response


def add_security_to_app(app: FastAPI, enable_rate_limiting: bool = True, 
                        requests_per_minute: int = 60):
    """
    Add all security middleware to FastAPI application
    
    Args:
        app: FastAPI application instance
        enable_rate_limiting: Whether to enable rate limiting
        requests_per_minute: Rate limit threshold for general API
    """
    # Add security headers middleware (should be last for proper header setting)
    app.add_middleware(SecurityHeadersMiddleware)
    
    # Add input validation middleware
    app.add_middleware(InputValidationMiddleware)
    
    # Add stricter auth rate limiting (5 req/min on /auth/* endpoints)
    app.add_middleware(AuthRateLimitMiddleware, requests_per_minute=5)
    
    # Add rate limiting middleware if enabled
    if enable_rate_limiting:
        app.add_middleware(RateLimitMiddleware, requests_per_minute=requests_per_minute)


class PasswordPolicy:
    """
    Password policy validator for user accounts
    """

    @staticmethod
    def validate_password(password: str) -> Tuple[bool, str]:
        """
        Validate password against security policy
        
        Requirements:
        - Minimum 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
        
        Returns:
            (is_valid, error_message)
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
        """
        Determine password strength level
        """
        score = 0
        
        if len(password) >= 8:
            score += 1
        if len(password) >= 12:
            score += 1
        if any(c.isupper() for c in password):
            score += 1
        if any(c.islower() for c in password):
            score += 1
        if any(c.isdigit() for c in password):
            score += 1
        
        special_chars = "!@#$%^&*()_+-=[]{}|;:',.<>?/`~"
        if any(c in special_chars for c in password):
            score += 1
        
        if score <= 2:
            return "weak"
        elif score <= 4:
            return "moderate"
        else:
            return "strong"


class AuditLogger:
    """
    Audit logging for security events
    """

    @staticmethod
    def log_auth_event(event_type: str, user_id: str, email: str, 
                      status: str, details: str = None):
        """
        Log authentication events
        
        Args:
            event_type: login, logout, registration, password_change, etc.
            user_id: User identifier
            email: User email
            status: success, failure
            details: Additional details
        """
        timestamp = datetime.utcnow().isoformat()
        log_entry = {
            "timestamp": timestamp,
            "event_type": event_type,
            "user_id": user_id,
            "email": email,
            "status": status,
            "details": details
        }
        # In production, write to proper audit log
        # logger.info(f"AUDIT: {log_entry}")

    @staticmethod
    def log_api_event(event_type: str, endpoint: str, method: str,
                     status_code: int, client_ip: str, user_id: str = None):
        """
        Log API access events
        """
        timestamp = datetime.utcnow().isoformat()
        log_entry = {
            "timestamp": timestamp,
            "event_type": event_type,
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "client_ip": client_ip,
            "user_id": user_id
        }
        # In production, write to proper audit log
        # logger.info(f"API_AUDIT: {log_entry}")
