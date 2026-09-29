from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import httpx
import jwt

from app.config import Settings
from app.core.billing_metrics import increment
from app.core.errors import AppError, ForbiddenError, ProviderTransientError
from app.core.google_play_config import ANDROID_PUBLISHER_SCOPE, resolve_google_play_credentials
from app.services.apple_jws import AppleJwsVerifier, expected_apple_environment

logger = logging.getLogger(__name__)


@dataclass
class VerifiedPurchase:
    platform: str
    product_id: str
    provider_ref: str
    status: str
    expires_at: datetime | None
    auto_renewing: bool
    cancelled: bool
    application_id: str
    observed_at: datetime | None = None


class PurchaseVerificationProvider(Protocol):
    async def verify(
        self,
        *,
        product_id: str,
        purchase_token: str,
        application_id: str | None,
    ) -> VerifiedPurchase: ...


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class MockStoreVerificationProvider:
    """Development-only store stand-in. Tokens are structured, not Play/App Store tokens."""

    def __init__(self, settings: Settings, platform: str) -> None:
        self._settings = settings
        self._platform = platform

    async def verify(
        self,
        *,
        product_id: str,
        purchase_token: str,
        application_id: str | None,
    ) -> VerifiedPurchase:
        if purchase_token in {"", "invalid", "mock_invalid"}:
            raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
        try:
            payload = json.loads(purchase_token)
        except json.JSONDecodeError as exc:
            raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400) from exc
        if payload.get("valid") is False:
            raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
        token_product = payload.get("productId")
        if token_product != product_id:
            raise AppError(
                "SUBSCRIPTION_PRODUCT_MISMATCH", "Product does not match this purchase.", 409
            )
        expected_app = (
            self._settings.google_play_package_name
            if self._platform == "GOOGLE"
            else self._settings.apple_bundle_id
        )
        app_id = payload.get("applicationId") or expected_app
        if application_id and application_id != expected_app:
            raise ForbiddenError("Application identity does not match.")
        if app_id != expected_app:
            raise ForbiddenError("Application identity does not match.")
        status = str(payload.get("status") or "ACTIVE")
        expires = _parse_dt(payload.get("expiresAt"))
        if status == "EXPIRED" or (expires is not None and expires <= datetime.now(UTC)):
            status = "EXPIRED"
        return VerifiedPurchase(
            platform=self._platform,
            product_id=product_id,
            provider_ref=str(
                payload.get("transactionId") or payload.get("purchaseToken") or purchase_token
            ),
            status=status,
            expires_at=expires,
            auto_renewing=bool(payload.get("autoRenewing", True)),
            cancelled=bool(payload.get("cancelled", False)),
            application_id=app_id,
            observed_at=_parse_dt(payload.get("observedAt")) or datetime.now(UTC),
        )


class GooglePlayVerificationProvider:
    def __init__(self, settings: Settings, sleeper=None) -> None:
        self._settings = settings
        self._sleep = sleeper or asyncio.sleep

    async def verify(
        self,
        *,
        product_id: str,
        purchase_token: str,
        application_id: str | None,
    ) -> VerifiedPurchase:
        package = self._settings.google_play_package_name
        if application_id and application_id != package:
            raise ForbiddenError("Application identity does not match.")
        info, presence = resolve_google_play_credentials(self._settings)
        if info is None or not presence.present:
            raise ProviderTransientError("Google Play verification is not configured.")
        token = await self._access_token(info)
        url = (
            "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
            f"{package}/purchases/subscriptionsv2/tokens/{purchase_token}"
        )
        body = await self._get_json(url, token)
        line = (body.get("lineItems") or [{}])[0]
        offer = line.get("productId") or product_id
        if product_id and offer != product_id:
            raise AppError(
                "SUBSCRIPTION_PRODUCT_MISMATCH", "Product does not match this purchase.", 409
            )
        expiry = _parse_dt(line.get("expiryTime") or body.get("expiryTime"))
        state = str(body.get("subscriptionState") or "")
        status = _google_state(state, expiry)
        return VerifiedPurchase(
            platform="GOOGLE",
            product_id=str(offer or product_id),
            provider_ref=purchase_token,
            status=status,
            expires_at=expiry,
            auto_renewing="CANCELED" not in state,
            cancelled="CANCELED" in state,
            application_id=package,
            observed_at=_parse_dt(body.get("startTime")) or datetime.now(UTC),
        )

    async def _get_json(self, url: str, access_token: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    response = await client.get(
                        url, headers={"Authorization": f"Bearer {access_token}"}
                    )
            except httpx.TimeoutException:
                increment("provider_timeout")
                last_error = ProviderTransientError("Google Play Developer API timed out.")
                await self._sleep(0.05 * (2**attempt))
                continue
            except httpx.HTTPError:
                last_error = ProviderTransientError("Google Play Developer API is unavailable.")
                await self._sleep(0.05 * (2**attempt))
                continue
            if response.status_code >= 500:
                last_error = ProviderTransientError("Google Play Developer API is unavailable.")
                await self._sleep(0.05 * (2**attempt))
                continue
            if response.status_code >= 400:
                raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
            return response.json()
        raise last_error or ProviderTransientError("Google Play Developer API is unavailable.")

    async def _access_token(self, info: dict[str, Any] | None = None) -> str:
        from google.oauth2 import service_account

        payload = info
        if payload is None:
            payload, presence = resolve_google_play_credentials(self._settings)
            if payload is None or not presence.present:
                raise ProviderTransientError("Google Play verification is not configured.")
        creds = service_account.Credentials.from_service_account_info(
            payload, scopes=[ANDROID_PUBLISHER_SCOPE]
        )
        creds.refresh(__import__("google.auth.transport.requests", fromlist=["Request"]).Request())
        return creds.token


class AppleAppStoreVerificationProvider:
    def __init__(
        self,
        settings: Settings,
        sleeper=None,
        verifier: AppleJwsVerifier | None = None,
    ) -> None:
        self._settings = settings
        self._sleep = sleeper or asyncio.sleep
        self._verifier = verifier or AppleJwsVerifier()

    async def verify(
        self,
        *,
        product_id: str,
        purchase_token: str,
        application_id: str | None,
    ) -> VerifiedPurchase:
        bundle = self._settings.apple_bundle_id
        if application_id and application_id != bundle:
            raise ForbiddenError("Application identity does not match.")
        if not self._settings.apple_iap_private_key.strip():
            raise ProviderTransientError("App Store verification is not configured.")
        jwt_token = self._app_store_jwt()
        expected_env = expected_apple_environment(
            self._settings.app_env.value, self._settings.apple_iap_expected_environment
        )
        base = (
            "https://api.storekit.itunes.apple.com"
            if expected_env == "Production"
            else "https://api.storekit-sandbox.itunes.apple.com"
        )
        body = await self._get_json(
            f"{base}/inApps/v1/transactions/{purchase_token}", jwt_token
        )
        signed = body.get("signedTransactionInfo")
        if not signed:
            raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
        claims = self._verifier.verify_compact(str(signed))
        if claims.get("bundleId") != bundle:
            raise ForbiddenError("Application identity does not match.")
        txn_env = str(claims.get("environment") or expected_env)
        if txn_env != expected_env:
            raise AppError("APPLE_JWS_INVALID", "Transaction environment does not match.", 400)
        token_product = claims.get("productId")
        if product_id and token_product != product_id:
            raise AppError(
                "SUBSCRIPTION_PRODUCT_MISMATCH", "Product does not match this purchase.", 409
            )
        expires_ms = claims.get("expiresDate")
        expires = datetime.fromtimestamp(int(expires_ms) / 1000, tz=UTC) if expires_ms else None
        revoked = claims.get("revocationDate") is not None
        status = (
            "REVOKED"
            if revoked
            else ("EXPIRED" if expires and expires <= datetime.now(UTC) else "ACTIVE")
        )
        return VerifiedPurchase(
            platform="APPLE",
            product_id=str(token_product or product_id),
            provider_ref=str(claims.get("originalTransactionId") or purchase_token),
            status=status,
            expires_at=expires,
            auto_renewing=not revoked,
            cancelled=bool(claims.get("revocationDate")),
            application_id=bundle,
            observed_at=datetime.fromtimestamp(int(claims["signedDate"]) / 1000, tz=UTC)
            if claims.get("signedDate")
            else datetime.now(UTC),
        )

    async def _get_json(self, url: str, access_token: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    response = await client.get(
                        url, headers={"Authorization": f"Bearer {access_token}"}
                    )
            except httpx.TimeoutException:
                increment("provider_timeout")
                last_error = ProviderTransientError("App Store Server API timed out.")
                await self._sleep(0.05 * (2**attempt))
                continue
            except httpx.HTTPError:
                last_error = ProviderTransientError("App Store Server API is unavailable.")
                await self._sleep(0.05 * (2**attempt))
                continue
            if response.status_code >= 500:
                last_error = ProviderTransientError("App Store Server API is unavailable.")
                await self._sleep(0.05 * (2**attempt))
                continue
            if response.status_code >= 400:
                raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
            return response.json()
        raise last_error or ProviderTransientError("App Store Server API is unavailable.")

    def _app_store_jwt(self) -> str:
        now = datetime.now(UTC)
        return jwt.encode(
            {
                "iss": self._settings.apple_iap_issuer_id,
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(minutes=20)).timestamp()),
                "aud": "appstoreconnect-v1",
                "bid": self._settings.apple_bundle_id,
            },
            self._settings.apple_iap_private_key.replace("\\n", "\n"),
            algorithm="ES256",
            headers={"kid": self._settings.apple_iap_key_id, "typ": "JWT"},
        )


def _google_state(state: str, expiry: datetime | None) -> str:
    mapping = {
        "SUBSCRIPTION_STATE_ACTIVE": "ACTIVE",
        "SUBSCRIPTION_STATE_CANCELED": "CANCELLED",
        "SUBSCRIPTION_STATE_EXPIRED": "EXPIRED",
        "SUBSCRIPTION_STATE_IN_GRACE_PERIOD": "GRACE_PERIOD",
        "SUBSCRIPTION_STATE_IN_ACCOUNT_HOLD": "BILLING_RETRY",
        "SUBSCRIPTION_STATE_PAUSED": "PAUSED",
        "SUBSCRIPTION_STATE_REVOKED": "REVOKED",
    }
    mapped = mapping.get(state)
    if mapped:
        return mapped
    if expiry and expiry <= datetime.now(UTC):
        return "EXPIRED"
    return "ACTIVE"


def build_verification_provider(settings: Settings, platform: str) -> PurchaseVerificationProvider:
    if platform == "RAZORPAY":
        from app.services.razorpay import RazorpayVerificationProvider

        return RazorpayVerificationProvider(settings)
    if settings.subscription_verify_mode == "mock":
        return MockStoreVerificationProvider(settings, platform)
    if platform == "GOOGLE":
        return GooglePlayVerificationProvider(settings)
    return AppleAppStoreVerificationProvider(settings)


def decode_signed_payload(value: str) -> dict[str, Any]:
    return AppleJwsVerifier().verify_compact(value)
