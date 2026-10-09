#!/usr/bin/env python3
"""Check backend/.env.production without printing secret values.

Usage (from backend/):
    python scripts/validate_production_env.py
    python scripts/validate_production_env.py .env.production.example

Exit status is 0 only when every required variable is set to a non-placeholder
value. Credential file paths are checked for existence. File contents are never
read or printed.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent

REQUIRED = (
    "APP_ENV",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "JWT_SECRET",
    "FIREBASE_CREDENTIALS_FILE",
    "FIREBASE_PROJECT_ID",
    "GOOGLE_PLAY_SERVICE_ACCOUNT_FILE",
    "SMTP_HOST",
    "SMTP_USERNAME",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
    "SUBSCRIPTION_VERIFY_MODE",
    "GOOGLE_PLAY_PACKAGE_NAME",
    "GOOGLE_PLAY_WEBHOOK_SECRET",
    "GOOGLE_PUBSUB_PROJECT",
    "GOOGLE_PUBSUB_TOPIC",
    "GOOGLE_PUBSUB_SUBSCRIPTION",
    "APPLE_BUNDLE_ID",
    "APPLE_IAP_ISSUER_ID",
    "APPLE_IAP_KEY_ID",
    "APPLE_IAP_PRIVATE_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "GOOGLE_WEB_CLIENT_ID",
    "GOOGLE_IOS_CLIENT_ID",
    "FACEBOOK_APP_ID",
    "FACEBOOK_APP_SECRET",
    "PUBLIC_APP_ORIGIN",
    "APPLE_TEAM_ID",
    "ANDROID_SHA256_CERT_FINGERPRINTS",
    "CORS_ORIGINS",
    "MEDIA_PUBLIC_BASE_URL",
)

# At least one must be a real inline JSON document or an existing file.
PLAY_CREDENTIAL_ANY = (
    "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
    "GOOGLE_PLAY_SERVICE_ACCOUNT",
    "GOOGLE_PLAY_CREDENTIALS",
)

FILE_VARS = {"FIREBASE_CREDENTIALS_FILE", "GOOGLE_PLAY_SERVICE_ACCOUNT_FILE"}

PLACEHOLDER_MARKERS = (
    "change_me",
    "your-",
    "your_",
    "example",
    "placeholder",
    "replace-with",
    "aa:bb",
)


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("export "):
            key = key.removeprefix("export ").strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key] = value
    return values


def is_placeholder(value: str) -> bool:
    lowered = value.lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def resolve_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return BACKEND_DIR / path


def status_for(name: str, values: dict[str, str]) -> str:
    value = values.get(name, "").strip()
    if not value:
        return "missing"
    if is_placeholder(value):
        return "placeholder"
    if name == "JWT_SECRET" and len(value) < 32:
        return "too_short"
    if name == "APP_ENV" and value != "production":
        return "invalid"
    if name == "SUBSCRIPTION_VERIFY_MODE" and value != "live":
        return "invalid"
    if value.startswith("/run/secrets/"):
        return "configured"
    if name in FILE_VARS or (name in PLAY_CREDENTIAL_ANY and not value.startswith("{")):
        if not resolve_path(value).is_file():
            return "missing_file"
    return "configured"


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else BACKEND_DIR / ".env.production"
    if not path.is_file():
        print(f"{path.name}: missing")
        print("result: fail")
        return 1

    values = parse_env(path)
    failed = False
    for name in REQUIRED:
        state = status_for(name, values)
        print(f"{name}: {state}")
        if state != "configured":
            failed = True

    play_ok = False
    for name in PLAY_CREDENTIAL_ANY:
        state = status_for(name, values)
        print(f"{name}: {state}")
        if state == "configured":
            play_ok = True
    if not play_ok:
        failed = True

    print("result: fail" if failed else "result: ok")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
