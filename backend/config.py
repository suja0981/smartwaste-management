"""
Configuration — Phase 2 update.
Added Firebase service account path + IoT API key prefix.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache
import os


class Settings(BaseSettings):
    # ── Core API ──────────────────────────────────────────────────────────────
    api_title: str = "Smart Waste Management API"
    api_description: str = "AI-Powered CCTV Monitoring, IoT Sensors, Route Optimization & ML Predictions"
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
    # SQLite (default): "sqlite:///./smart_waste.db"
    # PostgreSQL: "postgresql://user:password@localhost:5432/smart_waste"
    # PostgreSQL (psycopg): "postgresql+psycopg://user:password@localhost:5432/smart_waste"
    database_url: str = "sqlite:///./smart_waste.db"

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000"

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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def firebase_configured(self) -> bool:
        """Returns True if Firebase credentials are available."""
        return bool(self.firebase_service_account_path or self.firebase_credentials_json)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()