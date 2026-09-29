import json
from datetime import UTC, datetime, timedelta

import pytest

from app.config import Settings
from app.core.errors import AppError, ForbiddenError, ProviderTransientError
from app.services.billing_providers import (
    GooglePlayVerificationProvider,
    MockStoreVerificationProvider,
)


def _settings(**extra) -> Settings:
    return Settings(
        jwt_secret="replace-with-a-long-random-local-dev-secret",
        subscription_verify_mode="mock",
        google_play_package_name="com.boomboomapp.date",
        apple_bundle_id="com.boomboom.app",
        **extra,
    )


@pytest.mark.asyncio
async def test_mock_google_valid_token() -> None:
    provider = MockStoreVerificationProvider(_settings(), "GOOGLE")
    expires = (datetime.now(UTC) + timedelta(days=30)).isoformat()
    token = json.dumps(
        {
            "valid": True,
            "productId": "com.boomboom.premium.monthly",
            "applicationId": "com.boomboomapp.date",
            "status": "ACTIVE",
            "expiresAt": expires,
            "transactionId": "txn-1",
        }
    )
    result = await provider.verify(
        product_id="com.boomboom.premium.monthly",
        purchase_token=token,
        application_id="com.boomboomapp.date",
    )
    assert result.status == "ACTIVE"
    assert result.provider_ref == "txn-1"


@pytest.mark.asyncio
async def test_mock_invalid_and_wrong_product() -> None:
    provider = MockStoreVerificationProvider(_settings(), "GOOGLE")
    with pytest.raises(AppError):
        await provider.verify(
            product_id="com.boomboom.premium.monthly",
            purchase_token="mock_invalid",
            application_id=None,
        )
    token = json.dumps(
        {
            "valid": True,
            "productId": "other",
            "applicationId": "com.boomboomapp.date",
            "status": "ACTIVE",
            "transactionId": "txn-2",
        }
    )
    with pytest.raises(AppError) as exc:
        await provider.verify(
            product_id="com.boomboom.premium.monthly",
            purchase_token=token,
            application_id=None,
        )
    assert exc.value.code == "SUBSCRIPTION_PRODUCT_MISMATCH"


@pytest.mark.asyncio
async def test_mock_wrong_package() -> None:
    provider = MockStoreVerificationProvider(_settings(), "GOOGLE")
    token = json.dumps(
        {
            "valid": True,
            "productId": "com.boomboom.premium.monthly",
            "applicationId": "com.other.app",
            "status": "ACTIVE",
            "transactionId": "txn-3",
        }
    )
    with pytest.raises(ForbiddenError):
        await provider.verify(
            product_id="com.boomboom.premium.monthly",
            purchase_token=token,
            application_id=None,
        )


@pytest.mark.asyncio
async def test_mock_expired_and_revoked() -> None:
    settings = _settings()
    provider = MockStoreVerificationProvider(settings, "APPLE")
    expired = json.dumps(
        {
            "valid": True,
            "productId": "com.boomboom.premium.monthly",
            "applicationId": settings.apple_bundle_id,
            "status": "EXPIRED",
            "transactionId": "txn-exp",
        }
    )
    result = await provider.verify(
        product_id="com.boomboom.premium.monthly",
        purchase_token=expired,
        application_id=None,
    )
    assert result.status == "EXPIRED"
    revoked = json.dumps(
        {
            "valid": True,
            "productId": "com.boomboom.premium.monthly",
            "applicationId": settings.apple_bundle_id,
            "status": "REVOKED",
            "transactionId": "txn-rev",
        }
    )
    result = await provider.verify(
        product_id="com.boomboom.premium.monthly",
        purchase_token=revoked,
        application_id=None,
    )
    assert result.status == "REVOKED"


class _FakeResponse:
    def __init__(self, status_code: int, body: dict | None = None) -> None:
        self.status_code = status_code
        self._body = body or {}

    def json(self) -> dict:
        return self._body


class _FakeClient:
    def __init__(self, responses: list) -> None:
        self._responses = list(responses)
        self.calls = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, *args, **kwargs):
        self.calls += 1
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


async def _noop_sleep(_delay: float) -> None:
    return None


@pytest.mark.asyncio
async def test_google_api_retries_then_fails(monkeypatch) -> None:
    settings = _settings(google_play_service_account_json='{"client_email":"x"}')
    provider = GooglePlayVerificationProvider(settings, sleeper=_noop_sleep)

    async def _token(_info=None) -> str:
        return "access"

    provider._access_token = _token  # type: ignore[method-assign]
    client = _FakeClient([_FakeResponse(503), _FakeResponse(502), _FakeResponse(500)])
    monkeypatch.setattr(
        "app.services.billing_providers.httpx.AsyncClient", lambda **kwargs: client
    )
    with pytest.raises(ProviderTransientError):
        await provider.verify(
            product_id="com.boomboom.premium.monthly",
            purchase_token="play-token",
            application_id=None,
        )
    assert client.calls == 3


@pytest.mark.asyncio
async def test_google_api_succeeds_after_retry(monkeypatch) -> None:
    settings = _settings(google_play_service_account_json='{"client_email":"x"}')
    provider = GooglePlayVerificationProvider(settings, sleeper=_noop_sleep)

    async def _token(_info=None) -> str:
        return "access"

    provider._access_token = _token  # type: ignore[method-assign]
    client = _FakeClient(
        [
            _FakeResponse(503),
            _FakeResponse(
                200,
                {
                    "subscriptionState": "SUBSCRIPTION_STATE_EXPIRED",
                    "lineItems": [
                        {
                            "productId": "com.boomboom.premium.monthly",
                            "expiryTime": "2020-01-01T00:00:00Z",
                        }
                    ],
                },
            ),
        ]
    )
    monkeypatch.setattr(
        "app.services.billing_providers.httpx.AsyncClient", lambda **kwargs: client
    )
    result = await provider.verify(
        product_id="com.boomboom.premium.monthly",
        purchase_token="play-token",
        application_id=None,
    )
    assert result.status == "EXPIRED"
    assert client.calls == 2


@pytest.mark.asyncio
async def test_google_api_invalid_token_is_permanent(monkeypatch) -> None:
    settings = _settings(google_play_service_account_json='{"client_email":"x"}')
    provider = GooglePlayVerificationProvider(settings, sleeper=_noop_sleep)

    async def _token(_info=None) -> str:
        return "access"

    provider._access_token = _token  # type: ignore[method-assign]
    client = _FakeClient([_FakeResponse(404)])
    monkeypatch.setattr(
        "app.services.billing_providers.httpx.AsyncClient", lambda **kwargs: client
    )
    with pytest.raises(AppError) as exc:
        await provider.verify(
            product_id="com.boomboom.premium.monthly",
            purchase_token="missing",
            application_id=None,
        )
    assert exc.value.status_code == 400
    assert client.calls == 1
