from enum import StrEnum
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Force the asyncpg SQLAlchemy dialect. Render URLs are often postgres://."""
    value = (url or "").strip()
    if value.startswith("postgresql+"):
        return value
    if value.startswith("postgresql://"):
        return "postgresql+asyncpg://" + value.removeprefix("postgresql://")
    if value.startswith("postgres://"):
        return "postgresql+asyncpg://" + value.removeprefix("postgres://")
    return value


class AppEnv(StrEnum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: AppEnv = AppEnv.DEVELOPMENT
    app_name: str = "BoomBoom API"
    app_host: str = "0.0.0.0"
    app_port: int = 8080

    database_url: str = "postgresql+asyncpg://boomboom:boomboom_dev_only@localhost:5432/boomboom"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "replace-with-a-long-random-local-dev-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    cors_origins: str = ""

    otp_expire_seconds: int = 300
    otp_resend_seconds: int = 60
    otp_max_attempts: int = 5
    otp_length: int = 4
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "BoomBoom"

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_username.strip() and self.smtp_password.strip())

    log_level: str = "INFO"

    min_dating_age: int = 18
    max_dating_age: int = 99
    media_storage_path: str = "./storage/uploads"
    media_public_base_url: str = ""
    media_max_bytes: int = 8_000_000
    media_max_items: int = 6
    media_upload_expire_seconds: int = 900

    discovery_page_size: int = 20
    discovery_seen_hours: int = 168
    discovery_cursor_ttl_seconds: int = 3600

    firebase_credentials_json: str = ""
    firebase_project_id: str = ""

    verification_request_expire_days: int = 14
    verification_media_retention_days: int = 90
    moderation_suspend_hours: str = "24,168,0"

    subscription_verify_mode: str = "mock"
    google_play_package_name: str = "com.boomboomapp.date"
    google_play_service_account_json: str = ""
    google_play_service_account: str = ""
    google_play_credentials: str = ""
    google_play_webhook_secret: str = ""
    google_pubsub_project: str = ""
    google_pubsub_topic: str = ""
    google_pubsub_subscription: str = ""
    apple_bundle_id: str = "com.boomboom"
    apple_iap_issuer_id: str = ""
    apple_iap_key_id: str = ""
    apple_iap_private_key: str = ""
    apple_iap_webhook_secret: str = ""
    apple_iap_expected_environment: str = "auto"
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    public_app_origin: str = "https://boomboom.app"
    apple_team_id: str = ""
    android_sha256_cert_fingerprints: str = ""
    google_web_client_id: str = ""
    google_ios_client_id: str = ""
    facebook_app_id: str = ""
    facebook_app_secret: str = ""

    @property
    def apple_audiences(self) -> list[str]:
        values = {
            self.apple_bundle_id.strip(),
            "com.boomboom",
            "com.boomboom.app",
        }
        return [item for item in values if item]

    @field_validator("database_url")
    @classmethod
    def asyncpg_database_url(cls, value: str) -> str:
        return normalize_database_url(value)

    @field_validator("jwt_secret")
    @classmethod
    def secret_length(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == AppEnv.PRODUCTION

    @property
    def is_staging(self) -> bool:
        return self.app_env == AppEnv.STAGING

    def rate_limit_policy(self, name: str) -> tuple[int, int]:
        """Limit/window from server APP_ENV. Clients cannot override this."""
        from app.core.rate_limit import resolve_rate_limit_policy

        return resolve_rate_limit_policy(name, is_staging=self.is_staging)

    @property
    def cors_origin_list(self) -> list[str]:
        if not self.cors_origins.strip():
            return []
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    def validate_runtime(self) -> None:
        if self.is_production and "replace-with" in self.jwt_secret:
            raise RuntimeError("JWT_SECRET must be replaced before running in production")
        if (self.is_production or self.is_staging) and "boomboom_dev_only" in self.database_url:
            raise RuntimeError(
                "DATABASE_URL must not use local development credentials in staging/production"
            )
        if (self.is_production or self.is_staging) and self.subscription_verify_mode == "mock":
            raise RuntimeError(
                "SUBSCRIPTION_VERIFY_MODE=mock is not allowed in staging or production"
            )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_runtime()
    return settings
