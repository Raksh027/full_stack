from pathlib import Path

import pytest

from app.config import Settings
from app.core.errors import ProviderTransientError
from app.core.google_play_config import (
    GOOGLE_PLAY_PRODUCT_IDS,
    resolve_google_play_credentials,
    validate_google_play_staging_config,
)
from app.services.billing_providers import GooglePlayVerificationProvider


def test_product_ids_are_unchanged() -> None:
    assert GOOGLE_PLAY_PRODUCT_IDS == (
        "com.boomboom.premium.monthly",
        "com.boomboom.premium.quarterly",
        "com.boomboom.premium.yearly",
    )


def test_credentials_from_file_not_logged(tmp_path: Path) -> None:
    path = tmp_path / "play.json"
    path.write_text(
        '{"type":"service_account","client_email":"play@example.com"}',
        encoding="utf-8",
    )
    settings = Settings(
        jwt_secret="replace-with-a-long-random-local-dev-secret",
        google_play_credentials=str(path),
    )
    info, presence = resolve_google_play_credentials(settings)
    assert presence.present is True
    assert presence.source == "file"
    assert info is not None
    assert "private_key" not in str(presence)


def test_missing_credentials_are_safe() -> None:
    settings = Settings(jwt_secret="replace-with-a-long-random-local-dev-secret")
    info, presence = resolve_google_play_credentials(settings)
    assert info is None
    assert presence.present is False


def test_staging_static_validation_lists_gaps() -> None:
    settings = Settings(
        jwt_secret="replace-with-a-long-random-local-dev-secret",
        subscription_verify_mode="mock",
    )
    errors = validate_google_play_staging_config(settings)
    assert any("live" in item for item in errors)
    assert any("credentials" in item.lower() for item in errors)


@pytest.mark.asyncio
async def test_live_google_verify_fails_safely_without_credentials() -> None:
    settings = Settings(
        jwt_secret="replace-with-a-long-random-local-dev-secret",
        subscription_verify_mode="live",
        google_play_package_name="com.boomboomapp.date",
    )
    provider = GooglePlayVerificationProvider(settings)
    with pytest.raises(ProviderTransientError):
        await provider.verify(
            product_id="com.boomboom.premium.monthly",
            purchase_token="token",
            application_id="com.boomboomapp.date",
        )


def test_staging_refuses_mock_and_dev_database() -> None:
    with pytest.raises(RuntimeError):
        Settings(
            jwt_secret="replace-with-a-long-random-local-dev-secret",
            app_env="staging",
            subscription_verify_mode="mock",
            database_url="postgresql+asyncpg://boomboom:safe@db:5432/boomboom_staging",
        ).validate_runtime()
    with pytest.raises(RuntimeError):
        Settings(
            jwt_secret="replace-with-a-long-random-local-dev-secret",
            app_env="staging",
            subscription_verify_mode="live",
            database_url="postgresql+asyncpg://boomboom:boomboom_dev_only@localhost:5432/boomboom",
        ).validate_runtime()
