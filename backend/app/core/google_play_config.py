from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from app.config import Settings

GOOGLE_PLAY_PRODUCT_IDS = (
    "com.boomboom.premium.monthly",
    "com.boomboom.premium.quarterly",
    "com.boomboom.premium.yearly",
)
ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher"


@dataclass(frozen=True)
class CredentialPresence:
    present: bool
    source: str


def resolve_google_play_credentials(settings: Settings) -> tuple[dict | None, CredentialPresence]:
    """Load service-account JSON from inline env or a file path. Never log the contents."""
    candidates = (
        settings.google_play_service_account_json,
        settings.google_play_service_account,
        settings.google_play_credentials,
    )
    for raw in candidates:
        value = (raw or "").strip()
        if not value:
            continue
        if value.startswith("{"):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return None, CredentialPresence(False, "invalid_inline_json")
            if not isinstance(parsed, dict):
                return None, CredentialPresence(False, "invalid_inline_json")
            return parsed, CredentialPresence(True, "inline_json")
        path = Path(value)
        if not path.is_file():
            return None, CredentialPresence(False, "missing_file")
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None, CredentialPresence(False, "unreadable_file")
        if not isinstance(parsed, dict):
            return None, CredentialPresence(False, "unreadable_file")
        return parsed, CredentialPresence(True, "file")
    return None, CredentialPresence(False, "missing")


def validate_google_play_staging_config(settings: Settings) -> list[str]:
    """Static checks only. Does not call Google APIs."""
    errors: list[str] = []
    if not settings.google_play_package_name.strip():
        errors.append("GOOGLE_PLAY_PACKAGE_NAME is empty.")
    _, creds = resolve_google_play_credentials(settings)
    if not creds.present:
        errors.append("Google Play service-account credentials are not available.")
    if settings.subscription_verify_mode != "live":
        errors.append("SUBSCRIPTION_VERIFY_MODE must be live for staging store tests.")
    if not settings.google_pubsub_project.strip():
        errors.append("GOOGLE_PUBSUB_PROJECT is empty.")
    if not settings.google_pubsub_topic.strip():
        errors.append("GOOGLE_PUBSUB_TOPIC is empty.")
    if not settings.google_pubsub_subscription.strip():
        errors.append("GOOGLE_PUBSUB_SUBSCRIPTION is empty.")
    if not settings.google_play_webhook_secret.strip():
        errors.append("GOOGLE_PLAY_WEBHOOK_SECRET is empty.")
    return errors
