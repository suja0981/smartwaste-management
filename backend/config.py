"""
Configuration management for Smart Waste Management System
Loads environment variables from .env file and provides configuration
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Core API Settings
    api_title: str = "Smart Waste Management API"
    api_description: str = "AI-Powered CCTV Monitoring, IoT Sensors, Route Optimization & ML Predictions"
    api_version: str = "3.0.0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True
    environment: str = "development"

    # Security
    secret_key: str = "your-super-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Database
    database_url: str = "sqlite:///./smart_waste.db"

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000"

    # Logging
    log_level: str = "INFO"

    # ML Settings
    ml_enabled: bool = True
    ml_sensitivity: float = 2.5
    ml_fill_prediction_threshold: int = 80
    ml_collection_confidence_min: float = 0.5

    class Config:
        """Pydantic config"""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into list"""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    def get_database_url(self) -> str:
        """Get the database URL, handling different database types"""
        url = self.database_url
        
        # For SQLite, create the database directory if it doesn't exist
        if url.startswith("sqlite:"):
            # Extract the file path
            if ":///" in url:
                file_path = url.replace("sqlite:///", "")
            else:
                file_path = url.replace("sqlite://", "")
            
            # Create parent directories if needed
            dir_path = os.path.dirname(file_path)
            if dir_path and not os.path.exists(dir_path):
                os.makedirs(dir_path, exist_ok=True)
        
        return url

    def is_production(self) -> bool:
        """Check if running in production"""
        return self.environment.lower() == "production"

    def should_reload_on_change(self) -> bool:
        """Check if app should reload on code changes"""
        return self.api_reload and not self.is_production()


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance
    Using lru_cache to ensure settings are loaded only once
    """
    return Settings()


# Export settings instance for easy importing
settings = get_settings()
