from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import httpx

from app.config import Settings
from app.core.billing_metrics import increment
from app.core.errors import AppError, ProviderTransientError
from app.services.billing_providers import VerifiedPurchase

logger = logging.getLogger(__name__)

RAZORPAY_API = "https://api.razorpay.com/v1"
PERIOD_DAYS = {"P1M": 30, "P3M": 90, "P6M": 183, "P1Y": 365}


def period_delta(billing_period: str) -> timedelta:
    return timedelta(days=PERIOD_DAYS.get(billing_period, 30))


def _period_for_product(product_id: str) -> str:
    value = product_id.lower()
    if "year" in value:
        return "P1Y"
    if "semiannual" in value or "six" in value:
        return "P6M"
    if "quarter" in value:
        return "P3M"
    return "P1M"


class RazorpayGateway:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def configured(self) -> bool:
        return bool(
            self._settings.razorpay_key_id.strip() and self._settings.razorpay_key_secret.strip()
        )

    def checkout_signature(self, order_id: str, payment_id: str) -> str:
        secret = self._settings.razorpay_key_secret.encode()
        payload = f"{order_id}|{payment_id}".encode()
        return hmac.new(secret, payload, hashlib.sha256).hexdigest()

    def verify_checkout_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        if not order_id or not payment_id or not signature:
            return False
        if not self.configured:
            return signature == "mock" and payment_id.startswith("pay_mock")
        expected = self.checkout_signature(order_id, payment_id)
        return hmac.compare_digest(expected, signature)

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        secret = self._settings.razorpay_webhook_secret.strip()
        if not secret or not signature:
            return False
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def create_order(
        self,
        *,
        amount: int,
        currency: str,
        receipt: str,
        notes: dict[str, str],
    ) -> dict[str, Any]:
        if not self.configured:
            return {
                "id": f"order_mock_{uuid4().hex[:16]}",
                "amount": amount,
                "currency": currency,
                "status": "created",
                "receipt": receipt,
                "notes": notes,
            }
        payload = {
            "amount": amount,
            "currency": currency,
            "receipt": receipt,
            "notes": notes,
            "payment_capture": 1,
        }
        data = await self._request("POST", "/orders", json=payload)
        return data

    async def fetch_payment(self, payment_id: str) -> dict[str, Any]:
        if not self.configured:
            if not payment_id.startswith("pay_mock"):
                raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
            return {
                "id": payment_id,
                "status": "captured",
                "captured": True,
                "notes": {},
            }
        return await self._request("GET", f"/payments/{payment_id}")

    async def _request(
        self, method: str, path: str, json: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        auth = (self._settings.razorpay_key_id, self._settings.razorpay_key_secret)
        last_error: Exception | None = None
        for _attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    response = await client.request(
                        method,
                        f"{RAZORPAY_API}{path}",
                        auth=auth,
                        json=json,
                    )
            except httpx.TimeoutException:
                increment("provider_timeout")
                last_error = ProviderTransientError("Razorpay timed out.")
                continue
            except httpx.HTTPError:
                last_error = ProviderTransientError("Razorpay is unavailable.")
                continue
            if response.status_code >= 500:
                last_error = ProviderTransientError("Razorpay is unavailable.")
                continue
            if response.status_code >= 400:
                logger.warning("razorpay_http status=%s path=%s", response.status_code, path)
                raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
            data = response.json()
            if not isinstance(data, dict):
                raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
            return data
        raise last_error or ProviderTransientError("Razorpay is unavailable.")


class RazorpayVerificationProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._gateway = RazorpayGateway(settings)

    async def verify(
        self,
        *,
        product_id: str,
        purchase_token: str,
        application_id: str | None,
    ) -> VerifiedPurchase:
        del application_id
        payment = await self._gateway.fetch_payment(purchase_token)
        status = str(payment.get("status") or "")
        captured = bool(payment.get("captured")) or status == "captured"
        if not captured:
            raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
        notes = payment.get("notes") or {}
        note_product = str(notes.get("productId") or notes.get("product_id") or "")
        if note_product and note_product != product_id:
            raise AppError(
                "SUBSCRIPTION_PRODUCT_MISMATCH", "Product does not match this purchase.", 409
            )
        amount = payment.get("amount")
        expected_amount = notes.get("amountPaise")
        if expected_amount not in (None, "") and amount not in (None, ""):
            if int(amount) != int(expected_amount):
                raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
        period = str(notes.get("billingPeriod") or _period_for_product(product_id))
        expires = datetime.now(UTC) + period_delta(period)
        return VerifiedPurchase(
            platform="RAZORPAY",
            product_id=product_id,
            provider_ref=str(payment.get("id") or purchase_token),
            status="ACTIVE",
            expires_at=expires,
            auto_renewing=False,
            cancelled=False,
            application_id="razorpay",
            observed_at=datetime.now(UTC),
        )
