"""
Configuration — Phase 2 update.
Added Firebase service account path + IoT API key prefix.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache


class Settings(BaseSettings):
    # ── Core API ──────────────────────────────────────────────────────────────
    api_title: str = "Smart Waste Management API"
    api_description: str = (
        "IoT Sensor Integration, Real-time WebSocket Feed, "
        "Route Optimization & ML Fill Predictions"
    )
    api_version: str = "3.0.0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True
    environment: str = "development"

    # ── Security ──────────────────────────────────────────────────────────────
    secret_key: str = "your-super-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = ""  # Must be set via DATABASE_URL env var (PostgreSQL)

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000,http://10.84.200.109"

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ── ML ────────────────────────────────────────────────────────────────────
    ml_enabled: bool = True
    ml_sensitivity: float = 2.5
    ml_fill_prediction_threshold: int = 80
    ml_collection_confidence_min: float = 0.5

    # ── Firebase (Phase 2) ────────────────────────────────────────────────────
    # Option A: path to downloaded service account JSON file
    firebase_service_account_path: Optional[str] = None
    # Option B: entire JSON as a string (better for Docker / env-only deploys)
    firebase_credentials_json: Optional[str] = None
    # Your Firebase project ID (used to validate tokens)
    firebase_project_id: Optional[str] = None

    # ── IoT API Keys ──────────────────────────────────────────────────────────
    # Prefix makes keys recognisable and prevents accidental use of other secrets
    api_key_prefix: str = "wsk_live_"
    iot_api_key: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def validate_production_secrets(self) -> None:
        """Raise at startup if insecure defaults are used in production."""
        if self.is_production():
            if self.secret_key == "your-super-secret-key-change-this-in-production":
                raise RuntimeError(
                    "SECRET_KEY must be changed before running in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )

    def firebase_configured(self) -> bool:
        """Returns True if Firebase credentials are available."""
        return bool(self.firebase_service_account_path or self.firebase_credentials_json)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()