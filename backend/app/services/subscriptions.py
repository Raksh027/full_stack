from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.billing_metrics import increment
from app.core.cache import CacheBackend
from app.core.entitlements import PREMIUM_CODES, EntitlementService
from app.core.errors import AppError, ConflictError, ForbiddenError, ProviderTransientError
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.security import hash_token
from app.models.orm import (
    AuditLog,
    BillingWebhookEvent,
    SubscriptionEvent,
    SubscriptionStatus,
    User,
    UserSubscription,
)
from app.repositories.subscriptions import (
    EntitlementRepository,
    ProductRepository,
    SubscriptionEventRepository,
    SubscriptionRepository,
    WebhookEventRepository,
)
from app.repositories.users import AuditLogRepository
from app.services.billing_providers import VerifiedPurchase, build_verification_provider
from app.services.notifications import NotificationService
from app.services.razorpay import RazorpayGateway

logger = logging.getLogger(__name__)

ENTITLED_STATUSES = frozenset(
    {
        SubscriptionStatus.ACTIVE.value,
        SubscriptionStatus.CANCELLED.value,
        SubscriptionStatus.GRACE_PERIOD.value,
        SubscriptionStatus.BILLING_RETRY.value,
    }
)


class SubscriptionService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        request_id: str,
        notifications: NotificationService | None = None,
        cache: CacheBackend | None = None,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._request_id = request_id
        self._notifications = notifications
        self._cache = cache
        self._products = ProductRepository(session)
        self._subs = SubscriptionRepository(session)
        self._ents = EntitlementRepository(session)
        self._events = SubscriptionEventRepository(session)
        self._webhooks = WebhookEventRepository(session)
        self._audit = AuditLogRepository(session)
        self._entitlements = EntitlementService(session)

    async def catalog(self, actor: User, platform: str | None) -> dict[str, Any]:
        await self._hit("subscription_catalog", actor.id)
        rows = await self._products.list_active(platform.upper() if platform else None)
        return {
            "items": [self._serialize_product(row) for row in rows],
            "priceNote": (
                "Store prices come from Apple or Google. Razorpay prices are listed on each plan."
            ),
        }

    async def me(self, actor: User) -> dict[str, Any]:
        await self._hit("subscription_me", actor.id)
        await self._expire_if_needed(actor.id)
        row = await self._subs.latest_for_user(actor.id)
        entitlements = await self.entitlements(actor)
        return {
            "subscription": self._serialize_sub(row) if row else None,
            "entitlements": entitlements["items"],
        }

    async def entitlements(self, actor: User) -> dict[str, Any]:
        await self._hit("entitlements", actor.id)
        await self._expire_if_needed(actor.id)
        rows = await self._ents.list_for_user(actor.id)
        return {
            "items": [
                {
                    "code": row.code,
                    "active": await self._entitlements.has(actor.id, row.code),
                    "expiresAt": row.expires_at.isoformat() if row.expires_at else None,
                    "source": row.source,
                    "productId": row.product_id,
                }
                for row in rows
            ]
        }

    async def history(self, actor: User, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        await self._hit("subscription_history", actor.id)
        rows, total = await self._subs.list_for_user(actor.id, min(limit, 50), offset)
        return {
            "items": [self._serialize_sub(row) for row in rows],
            "total": total,
            "limit": min(limit, 50),
            "offset": offset,
        }

    async def verify(self, actor: User, body) -> dict[str, Any]:
        await self._hit("subscription_verify", actor.id)
        return await self._verify_proof(
            actor,
            platform=body.platform,
            product_id=body.product_id,
            purchase_token=body.purchase_token,
            application_id=body.application_id,
            provider_event_id=None,
            force=True,
        )

    async def create_razorpay_order(self, actor: User, product_id: str) -> dict[str, Any]:
        await self._hit("subscription_order", actor.id)
        product = await self._products.get("RAZORPAY", product_id)
        if product is None or not product.active:
            raise AppError("SUBSCRIPTION_UNKNOWN_PRODUCT", "This product is not available.", 404)
        meta = product.metadata_json or {}
        try:
            amount = int(meta.get("amountPaise") or 0)
        except (TypeError, ValueError) as exc:
            raise AppError("VALIDATION_ERROR", "This plan cannot be billed.", 422) from exc
        currency = str(meta.get("currency") or "INR")
        if amount <= 0:
            raise AppError("VALIDATION_ERROR", "This plan cannot be billed.", 422)
        gateway = RazorpayGateway(self._settings)
        notes = {
            "userId": str(actor.id),
            "productId": product_id,
            "billingPeriod": product.billing_period,
            "amountPaise": str(amount),
        }
        receipt = f"bb_{actor.id.hex[:10]}_{self._request_id[:8]}"
        order = await gateway.create_order(
            amount=amount, currency=currency, receipt=receipt[:40], notes=notes
        )
        order_id = str(order.get("id") or "")
        if not order_id:
            raise AppError("SUBSCRIPTION_INVALID", "Could not start checkout.", 400)
        if self._cache is not None:
            await self._cache.set(
                f"rzp:order:{order_id}",
                json.dumps({**notes, "amount": amount, "currency": currency}),
                ex=3600,
            )
        auth = actor.auth
        profile = actor.profile
        return {
            "keyId": self._settings.razorpay_key_id.strip() or "rzp_test_mock",
            "orderId": order_id,
            "amount": amount,
            "currency": currency,
            "name": "BoomBoom",
            "description": product.display_name,
            "mockCheckout": not gateway.configured,
            "displayPrice": meta.get("displayPrice"),
            "prefill": {
                "email": auth.email if auth is not None else "",
                "name": (profile.display_name if profile is not None else "") or "",
            },
        }

    async def verify_razorpay(self, actor: User, body) -> dict[str, Any]:
        await self._hit("subscription_verify", actor.id)
        gateway = RazorpayGateway(self._settings)
        if not gateway.verify_checkout_signature(body.order_id, body.payment_id, body.signature):
            raise AppError("SUBSCRIPTION_INVALID", "Purchase could not be verified.", 400)
        if self._cache is not None:
            raw = await self._cache.get(f"rzp:order:{body.order_id}")
            if raw:
                cached = json.loads(raw)
                if cached.get("userId") != str(actor.id):
                    raise ForbiddenError("This order belongs to another account.")
                if cached.get("productId") != body.product_id:
                    raise AppError(
                        "SUBSCRIPTION_PRODUCT_MISMATCH",
                        "Product does not match this purchase.",
                        409,
                    )
        return await self._verify_proof(
            actor,
            platform="RAZORPAY",
            product_id=body.product_id,
            purchase_token=body.payment_id,
            application_id="razorpay",
            provider_event_id=None,
            force=True,
        )

    async def restore(self, actor: User, proofs: list) -> dict[str, Any]:
        await self._hit("subscription_restore", actor.id)
        results = []
        for proof in proofs:
            results.append(
                await self._verify_proof(
                    actor,
                    platform=proof.platform,
                    product_id=proof.product_id,
                    purchase_token=proof.purchase_token,
                    application_id=proof.application_id,
                    provider_event_id=None,
                    force=True,
                )
            )
        return {"items": results}

    async def apply_webhook(
        self,
        *,
        provider: str,
        event_id: str,
        event_type: str,
        platform: str,
        product_id: str,
        purchase_token: str,
        application_id: str | None,
        observed_at: datetime | None = None,
        skip_verify: bool = False,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        started = datetime.now(UTC)
        if not event_id:
            raise AppError("VALIDATION_ERROR", "Webhook event is incomplete.", 422)
        row, created = await self._webhooks.claim(
            provider=provider,
            event_id=event_id,
            event_type=event_type,
            platform=platform,
            product_id=product_id or None,
            provider_observed_at=observed_at,
        )
        if not created and row.status == "PROCESSED":
            increment("duplicate_event")
            return {"duplicate": True, "accepted": True}
        if not created and row.status == "FAILED_PERMANENT":
            increment("duplicate_event")
            return {"duplicate": True, "accepted": False, "reason": row.processing_result}
        await self._session.commit()

        def duration() -> int:
            return int((datetime.now(UTC) - started).total_seconds() * 1000)
        if skip_verify or not purchase_token:
            await self._webhooks.finish(
                row,
                status="PROCESSED",
                processing_result="ack_no_mutation",
                error_category=None,
                duration_ms=duration(),
            )
            await self._session.commit()
            self._log_webhook(provider, event_id, event_type, "ack_no_mutation", duration())
            return {"accepted": True, "matched": False, "test": skip_verify}
        existing = await self._lookup_subscription(platform, purchase_token)
        try:
            if existing is None and user_id is not None:
                user = await self._session.get(User, user_id)
                if user is None:
                    raise AppError("NOT_FOUND", "Account was not found.", 404)
                payload = await self._verify_proof(
                    user,
                    platform=platform,
                    product_id=product_id,
                    purchase_token=purchase_token,
                    application_id=application_id,
                    provider_event_id=event_id,
                    force=False,
                    observed_at=observed_at,
                )
                row = await self._session.get(BillingWebhookEvent, row.id)
                assert row is not None
                await self._webhooks.finish(
                    row,
                    status="PROCESSED",
                    processing_result="reconciled",
                    error_category=None,
                    duration_ms=duration(),
                )
                await self._session.commit()
                increment(
                    "razorpay_webhook_processed" if provider == "RAZORPAY" else "webhook_processed"
                )
                self._log_webhook(provider, event_id, event_type, "reconciled", duration())
                return {"accepted": True, "matched": True, "subscription": payload}
            if existing is None:
                await self._reconcile_unmatched(
                    platform=platform,
                    product_id=product_id,
                    purchase_token=purchase_token,
                    application_id=application_id,
                )
                await self._webhooks.finish(
                    row,
                    status="PROCESSED",
                    processing_result="unmatched",
                    error_category=None,
                    duration_ms=duration(),
                )
                await self._session.commit()
                self._log_webhook(provider, event_id, event_type, "unmatched", duration())
                return {"accepted": True, "matched": False}
            if (
                existing.provider_observed_at
                and observed_at
                and observed_at < existing.provider_observed_at
            ):
                increment("webhook_stale")
                await self._webhooks.finish(
                    row,
                    status="PROCESSED",
                    processing_result="stale",
                    error_category=None,
                    duration_ms=duration(),
                )
                await self._session.commit()
                self._log_webhook(provider, event_id, event_type, "stale", duration())
                return {"accepted": True, "matched": True, "stale": True}
            user = await self._session.get(User, existing.user_id)
            assert user is not None
            payload = await self._verify_proof(
                user,
                platform=platform,
                product_id=product_id or existing.product_id,
                purchase_token=purchase_token,
                application_id=application_id,
                provider_event_id=event_id,
                force=False,
                observed_at=observed_at,
            )
            row = await self._session.get(BillingWebhookEvent, row.id)
            assert row is not None
            result = "stale" if payload.get("stale") else "reconciled"
            await self._webhooks.finish(
                row,
                status="PROCESSED",
                processing_result=result,
                error_category=None,
                duration_ms=duration(),
            )
            await self._session.commit()
            metric = {
                "GOOGLE": "google_rtdn_processed",
                "APPLE": "apple_notification_processed",
                "RAZORPAY": "razorpay_webhook_processed",
            }.get(provider, "webhook_processed")
            increment(metric)
            self._log_webhook(provider, event_id, event_type, "reconciled", duration())
            return {"accepted": True, "matched": True, "subscription": payload}
        except ProviderTransientError:
            increment(_webhook_fail_metric(provider))
            increment("provider_timeout")
            await self._session.rollback()
            self._log_webhook(provider, event_id, event_type, "provider_timeout", duration())
            raise
        except AppError as exc:
            increment(_webhook_fail_metric(provider))
            await self._session.rollback()
            row = await self._webhooks.get(provider, event_id)
            if row is not None:
                await self._webhooks.finish(
                    row,
                    status="FAILED_PERMANENT",
                    processing_result=exc.code,
                    error_category=exc.code,
                    duration_ms=duration(),
                )
                await self._session.commit()
            self._log_webhook(provider, event_id, event_type, exc.code, duration())
            return {"accepted": False, "reason": exc.code}

    async def admin_list(self, status: str | None, platform: str | None, limit: int, offset: int):
        rows, total = await self._subs.list_page(
            status=status, platform=platform, limit=min(limit, 50), offset=offset
        )
        return {
            "items": [self._serialize_sub(row) for row in rows],
            "total": total,
            "limit": min(limit, 50),
            "offset": offset,
        }

    async def admin_user(self, user_id: UUID) -> dict[str, Any]:
        latest = await self._subs.latest_for_user(user_id)
        history, _ = await self._subs.list_for_user(user_id, 20, 0)
        events = await self._events.list_for_user(user_id, 40)
        ents = await self._ents.list_for_user(user_id)
        return {
            "subscription": self._serialize_sub(latest) if latest else None,
            "history": [self._serialize_sub(row) for row in history],
            "entitlements": [
                {
                    "code": row.code,
                    "active": row.active,
                    "expiresAt": row.expires_at.isoformat() if row.expires_at else None,
                }
                for row in ents
            ],
            "events": [
                {
                    "id": str(row.id),
                    "eventType": row.event_type,
                    "platform": row.platform,
                    "productId": row.product_id,
                    "createdAt": row.created_at.isoformat() if row.created_at else None,
                    "processingStatus": row.processing_status,
                    "reconciliationResult": row.reconciliation_result,
                }
                for row in events
            ],
        }

    async def _verify_proof(
        self,
        actor: User,
        *,
        platform: str,
        product_id: str,
        purchase_token: str,
        application_id: str | None,
        provider_event_id: str | None,
        force: bool = True,
        observed_at: datetime | None = None,
    ) -> dict[str, Any]:
        platform = platform.upper()
        if platform not in {"GOOGLE", "APPLE", "RAZORPAY"}:
            raise AppError("VALIDATION_ERROR", "Unsupported billing platform.", 422)
        product = await self._products.get(platform, product_id)
        if product is None or not product.active:
            raise AppError("SUBSCRIPTION_UNKNOWN_PRODUCT", "This product is not available.", 404)
        provider = build_verification_provider(self._settings, platform)
        try:
            verified = await provider.verify(
                product_id=product_id,
                purchase_token=purchase_token,
                application_id=application_id,
            )
        except AppError:
            increment("purchase_verification_failure")
            raise
        increment("purchase_verification_success")
        ref_hash = hash_token(verified.provider_ref)
        existing = await self._subs.get_by_ref(platform, ref_hash)
        if existing is not None and existing.user_id != actor.id:
            raise ConflictError(
                "SUBSCRIPTION_OWNED", "This purchase is already linked to another account."
            )
        now = datetime.now(UTC)
        observed = observed_at or verified.observed_at
        if (
            not force
            and existing is not None
            and existing.provider_observed_at
            and observed
            and observed < existing.provider_observed_at
        ):
            increment("webhook_stale")
            await self._session.commit()
            return {
                "subscription": self._serialize_sub(existing),
                "entitlements": (await self.entitlements(actor))["items"],
                "pending": existing.status in {"GRACE_PERIOD", "BILLING_RETRY"},
                "stale": True,
            }
        status = self._normalized_status(verified)
        if existing is None:
            existing = UserSubscription(
                user_id=actor.id,
                platform=platform,
                product_id=product_id,
                plan_code=product.plan_code,
                provider_ref_hash=ref_hash,
                provider_ref_hint=verified.provider_ref[-6:],
                status=status,
                auto_renewing=verified.auto_renewing,
                started_at=now,
                expires_at=verified.expires_at,
                cancelled_at=now if verified.cancelled else None,
                provider_observed_at=observed,
            )
            await self._subs.add(existing)
            event = "SUBSCRIPTION_PURCHASED"
        else:
            existing.status = status
            existing.auto_renewing = verified.auto_renewing
            existing.expires_at = verified.expires_at
            existing.product_id = product_id
            existing.plan_code = product.plan_code
            if verified.cancelled and existing.cancelled_at is None:
                existing.cancelled_at = now
            if observed and (
                existing.provider_observed_at is None or observed >= existing.provider_observed_at
            ):
                existing.provider_observed_at = observed
            event = self._event_for_status(status)
        entitled = status in ENTITLED_STATUSES and self._not_past(verified.expires_at)
        await self._sync_entitlements(actor.id, existing, entitled, verified)
        if provider_event_id is None or not await self._events.exists_provider_event(
            provider_event_id
        ):
            await self._events.add(
                SubscriptionEvent(
                    subscription_id=existing.id,
                    user_id=actor.id,
                    event_type=event,
                    provider_event_id=provider_event_id,
                    platform=platform,
                    product_id=product_id,
                    processing_status="PROCESSED",
                    reconciliation_result=status,
                )
            )
            await self._audit.add(
                AuditLog(
                    user_id=actor.id,
                    actor_id=actor.id,
                    action="SUBSCRIPTION_VERIFIED",
                    target_type="subscription",
                    target_id=existing.id,
                    request_id=self._request_id,
                    metadata_json={"status": status, "platform": platform, "productId": product_id},
                )
            )
            pending = []
            if self._notifications is not None:
                pending = await self._notifications.persist_subscription(
                    user_id=actor.id,
                    subscription_id=existing.id,
                    event=event,
                )
            await self._session.commit()
            if self._notifications is not None and pending:
                await self._notifications.enqueue(pending)
        else:
            await self._session.commit()
        logger.info(
            "subscription_verified request_id=%s platform=%s status=%s",
            self._request_id,
            platform,
            status,
        )
        return {
            "subscription": self._serialize_sub(existing),
            "entitlements": (await self.entitlements(actor))["items"],
            "pending": status in {"GRACE_PERIOD", "BILLING_RETRY"},
        }

    async def _sync_entitlements(
        self,
        user_id: UUID,
        subscription: UserSubscription,
        entitled: bool,
        verified: VerifiedPurchase,
    ) -> None:
        for code in PREMIUM_CODES:
            previous = await self._ents.get(user_id, code)
            await self._ents.upsert(
                user_id=user_id,
                code=code,
                active=entitled,
                expires_at=verified.expires_at,
                source=verified.platform,
                product_id=verified.product_id,
                subscription_id=subscription.id,
            )
            action = "ENTITLEMENT_GRANTED" if entitled else "ENTITLEMENT_REVOKED"
            if previous is None or previous.active != entitled:
                increment("entitlement_grant" if entitled else "entitlement_revoke")
                await self._events.add(
                    SubscriptionEvent(
                        subscription_id=subscription.id,
                        user_id=user_id,
                        event_type=action,
                        platform=verified.platform,
                        product_id=verified.product_id,
                        processing_status="PROCESSED",
                        reconciliation_result=action,
                    )
                )

    async def _expire_if_needed(self, user_id: UUID) -> None:
        row = await self._subs.latest_for_user(user_id)
        if row is None or row.expires_at is None:
            return
        if row.status not in ENTITLED_STATUSES:
            return
        if self._not_past(row.expires_at):
            return
        row.status = SubscriptionStatus.EXPIRED.value
        for code in PREMIUM_CODES:
            await self._ents.upsert(
                user_id=user_id,
                code=code,
                active=False,
                expires_at=row.expires_at,
                source=row.platform,
                product_id=row.product_id,
                subscription_id=row.id,
            )
        await self._events.add(
            SubscriptionEvent(
                subscription_id=row.id,
                user_id=user_id,
                event_type="SUBSCRIPTION_EXPIRED",
            )
        )
        await self._session.commit()

    def _normalized_status(self, verified: VerifiedPurchase) -> str:
        if verified.status in {item.value for item in SubscriptionStatus}:
            if verified.status == SubscriptionStatus.CANCELLED.value:
                return SubscriptionStatus.CANCELLED.value
            return verified.status
        return SubscriptionStatus.ACTIVE.value

    def _event_for_status(self, status: str) -> str:
        return {
            SubscriptionStatus.ACTIVE.value: "SUBSCRIPTION_RENEWED",
            SubscriptionStatus.CANCELLED.value: "SUBSCRIPTION_CANCELLED",
            SubscriptionStatus.EXPIRED.value: "SUBSCRIPTION_EXPIRED",
            SubscriptionStatus.REVOKED.value: "SUBSCRIPTION_REVOKED",
            SubscriptionStatus.GRACE_PERIOD.value: "SUBSCRIPTION_BILLING_ISSUE",
            SubscriptionStatus.BILLING_RETRY.value: "SUBSCRIPTION_BILLING_ISSUE",
        }.get(status, "SUBSCRIPTION_VERIFIED")

    def _not_past(self, expires: datetime | None) -> bool:
        if expires is None:
            return True
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        return expires > datetime.now(UTC)

    def _serialize_product(self, row) -> dict[str, Any]:
        meta = row.metadata_json or {}
        return {
            "id": str(row.id),
            "platform": row.platform,
            "productId": row.product_id,
            "planCode": row.plan_code,
            "displayName": row.display_name,
            "billingPeriod": row.billing_period,
            "active": row.active,
            "amountPaise": meta.get("amountPaise"),
            "currency": meta.get("currency"),
            "displayPrice": meta.get("displayPrice"),
        }

    def _serialize_sub(self, row: UserSubscription) -> dict[str, Any]:
        return {
            "id": str(row.id),
            "platform": row.platform,
            "productId": row.product_id,
            "planCode": row.plan_code,
            "planId": row.plan_code,
            "status": row.status,
            "active": row.status in ENTITLED_STATUSES and self._not_past(row.expires_at),
            "autoRenewing": row.auto_renewing,
            "startedAt": row.started_at.isoformat() if row.started_at else None,
            "expiresAt": row.expires_at.isoformat() if row.expires_at else None,
            "cancelledAt": row.cancelled_at.isoformat() if row.cancelled_at else None,
            "referenceHint": row.provider_ref_hint,
        }

    async def _lookup_subscription(self, platform: str, purchase_token: str):
        existing = await self._subs.get_by_ref(platform, hash_token(purchase_token))
        if existing is not None:
            return existing
        try:
            payload = json.loads(purchase_token)
        except json.JSONDecodeError:
            return None
        alt = payload.get("transactionId") or payload.get("purchaseToken")
        if not alt:
            return None
        return await self._subs.get_by_ref(platform, hash_token(str(alt)))

    async def _reconcile_unmatched(
        self,
        *,
        platform: str,
        product_id: str,
        purchase_token: str,
        application_id: str | None,
    ) -> None:
        provider = build_verification_provider(self._settings, platform)
        await provider.verify(
            product_id=product_id,
            purchase_token=purchase_token,
            application_id=application_id,
        )

    def _log_webhook(
        self, provider: str, event_id: str, event_type: str, result: str, duration_ms: int
    ) -> None:
        logger.info(
            "billing_webhook platform=%s event_id=%s event_type=%s result=%s duration_ms=%s",
            provider,
            event_id,
            event_type,
            result,
            duration_ms,
        )

    async def _hit(self, policy: str, user_id: UUID) -> None:
        limit, window = RATE_LIMIT_POLICIES[policy]
        await self._limiter.hit(f"{policy}:{user_id}", limit, window)


def _webhook_fail_metric(provider: str) -> str:
    return {
        "GOOGLE": "google_rtdn_failed",
        "APPLE": "apple_notification_failed",
        "RAZORPAY": "razorpay_webhook_failed",
    }.get(provider, "webhook_failed")
