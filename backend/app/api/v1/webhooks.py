import hmac
import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request

from app.api.v1.responses import success
from app.config import Settings, get_settings
from app.core.errors import UnauthorizedError
from app.dependencies.subscriptions import get_subscription_service
from app.services.apple_jws import AppleJwsError, AppleJwsVerifier, expected_apple_environment
from app.services.google_rtdn import RtdnPermanentError, parse_pubsub_envelope
from app.services.razorpay import RazorpayGateway
from app.services.subscriptions import SubscriptionService

router = APIRouter(prefix="/webhooks", tags=["Subscriptions"])


def _require_secret(provided: str | None, expected: str) -> None:
    if not expected or not provided:
        raise UnauthorizedError("Webhook authentication failed.")
    if not hmac.compare_digest(provided, expected):
        raise UnauthorizedError("Webhook authentication failed.")


def _optional_secret(provided: str | None, expected: str) -> None:
    if not expected:
        return
    _require_secret(provided, expected)


@router.post("/google-play")
async def google_play(
    request: Request,
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
    settings: Annotated[Settings, Depends(get_settings)],
    x_webhook_secret: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    token = x_webhook_secret or (authorization or "").removeprefix("Bearer ").strip()
    _optional_secret(token, settings.google_play_webhook_secret)
    body = await request.json()
    try:
        parsed = parse_pubsub_envelope(
            body,
            expected_package=settings.google_play_package_name,
            expected_subscription=settings.google_pubsub_subscription,
        )
    except RtdnPermanentError as exc:
        return success(request, {"accepted": False, "reason": exc.code, "duplicate": False})
    return success(
        request,
        await service.apply_webhook(
            provider="GOOGLE",
            event_id=parsed.message_id,
            event_type=parsed.event_type,
            platform="GOOGLE",
            product_id=parsed.product_id,
            purchase_token=parsed.purchase_token,
            application_id=parsed.package_name,
            observed_at=parsed.observed_at,
            skip_verify=parsed.test_notification,
        ),
    )


@router.post("/apple")
async def apple(
    request: Request,
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
    settings: Annotated[Settings, Depends(get_settings)],
    x_webhook_secret: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    token = x_webhook_secret or (authorization or "").removeprefix("Bearer ").strip()
    body = await request.json()
    signed = body.get("signedPayload")
    expected_env = expected_apple_environment(
        settings.app_env.value, settings.apple_iap_expected_environment
    )
    if signed:
        try:
            notification = AppleJwsVerifier().verify_notification(
                str(signed),
                expected_bundle_id=settings.apple_bundle_id,
                expected_environment=expected_env,
            )
        except AppleJwsError as exc:
            return success(request, {"accepted": False, "reason": exc.code})
        if not notification.notification_uuid:
            return success(request, {"accepted": False, "reason": "missing_notification_uuid"})
        skip = notification.notification_type == "TEST" and not notification.transaction_id
        return success(
            request,
            await service.apply_webhook(
                provider="APPLE",
                event_id=notification.notification_uuid,
                event_type=notification.notification_type,
                platform="APPLE",
                product_id=notification.product_id,
                purchase_token=notification.original_transaction_id or notification.transaction_id,
                application_id=notification.bundle_id,
                observed_at=notification.observed_at,
                skip_verify=skip,
            ),
        )
    if settings.subscription_verify_mode != "mock":
        return success(request, {"accepted": False, "reason": "signed_payload_required"})
    _require_secret(token, settings.apple_iap_webhook_secret)
    event_id = str(body.get("notificationUUID") or body.get("eventId") or "")
    return success(
        request,
        await service.apply_webhook(
            provider="APPLE",
            event_id=event_id,
            event_type=str(body.get("notificationType") or body.get("eventType") or "UNKNOWN"),
            platform="APPLE",
            product_id=str(body.get("productId") or ""),
            purchase_token=str(body.get("transactionId") or body.get("purchaseToken") or ""),
            application_id=settings.apple_bundle_id,
            skip_verify=False,
        ),
    )


@router.post("/razorpay")
async def razorpay(
    request: Request,
    service: Annotated[SubscriptionService, Depends(get_subscription_service)],
    settings: Annotated[Settings, Depends(get_settings)],
    x_razorpay_signature: Annotated[str | None, Header(alias="X-Razorpay-Signature")] = None,
):
    raw = await request.body()
    gateway = RazorpayGateway(settings)
    if settings.razorpay_webhook_secret.strip():
        if not gateway.verify_webhook_signature(raw, x_razorpay_signature or ""):
            raise UnauthorizedError("Webhook authentication failed.")
    elif settings.subscription_verify_mode != "mock":
        raise UnauthorizedError("Webhook authentication failed.")
    try:
        body = json.loads(raw.decode() or "{}")
    except json.JSONDecodeError:
        return success(request, {"accepted": False, "reason": "invalid_json"})
    if not isinstance(body, dict):
        return success(request, {"accepted": False, "reason": "invalid_json"})
    event_id = str(body.get("id") or "")
    event_type = str(body.get("event") or "")
    payload = body.get("payload") if isinstance(body.get("payload"), dict) else {}
    payment_wrap = payload.get("payment") if isinstance(payload.get("payment"), dict) else {}
    payment = payment_wrap.get("entity") if isinstance(payment_wrap.get("entity"), dict) else {}
    notes = payment.get("notes") if isinstance(payment.get("notes"), dict) else {}
    user_raw = str(notes.get("userId") or notes.get("user_id") or "")
    try:
        user_id = UUID(user_raw) if user_raw else None
    except ValueError:
        user_id = None
    mutate = event_type in {"payment.captured", "order.paid"}
    return success(
        request,
        await service.apply_webhook(
            provider="RAZORPAY",
            event_id=event_id,
            event_type=event_type or "UNKNOWN",
            platform="RAZORPAY",
            product_id=str(notes.get("productId") or notes.get("product_id") or ""),
            purchase_token=str(payment.get("id") or ""),
            application_id="razorpay",
            skip_verify=not mutate,
            user_id=user_id,
        ),
    )
