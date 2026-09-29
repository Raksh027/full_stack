from app.config import Settings
from app.core.push import NoopPushProvider, RecordingPushProvider, build_push_provider


def _settings(**extra) -> Settings:
    values = {
        "jwt_secret": "replace-with-a-long-random-local-dev-secret",
        "firebase_credentials_json": "",
        "firebase_project_id": "",
    }
    values.update(extra)
    return Settings(**values)


def test_empty_credentials_use_noop() -> None:
    provider = build_push_provider(_settings())
    assert isinstance(provider, NoopPushProvider)


def test_missing_credential_path_uses_noop() -> None:
    provider = build_push_provider(
        _settings(
            firebase_credentials_json=r"C:\nonexistent\firebase-admin.json",
            firebase_project_id="boomboom-7712a",
        )
    )
    assert isinstance(provider, NoopPushProvider)


def test_invalid_inline_json_uses_noop() -> None:
    provider = build_push_provider(_settings(firebase_credentials_json="{not-json"))
    assert isinstance(provider, NoopPushProvider)


def test_recording_provider_does_not_need_firebase() -> None:
    provider = RecordingPushProvider()
    assert provider.sent == []
