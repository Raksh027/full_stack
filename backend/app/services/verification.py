from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.eligibility import account_is_active
from app.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.verification_retention import VerificationRetentionPolicy
from app.core.verification_rules import (
    ACTIVE_REQUEST_STATUSES,
    RETRYABLE_REQUEST_STATUSES,
    account_can_verify,
    default_expiry,
    is_verification_storage_key,
    next_action_for,
    owns_storage_key,
    parse_reason_code,
    parse_review_action,
    parse_verification_type,
    profile_status_from_request,
    public_rejection_message,
    public_user_status,
    require_reviewer,
)
from app.models.orm import (
    AuditLog,
    Profile,
    User,
    UserRole,
    VerificationMedia,
    VerificationRequest,
    VerificationRequestStatus,
    VerificationReview,
    VerificationReviewAction,
    VerificationStatus,
    VerificationType,
)
from app.repositories.profiles import ProfileQueryRepository
from app.repositories.users import AuditLogRepository, ProfileRepository
from app.repositories.verification import (
    VerificationMediaRepository,
    VerificationRequestRepository,
    VerificationReviewRepository,
)
from app.services.notifications import NotificationService
from app.services.storage import LocalStorageProvider, sniff_image_type
from app.services.verification_provider import VerificationProvider

logger = logging.getLogger(__name__)


class VerificationService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        storage: LocalStorageProvider,
        provider: VerificationProvider,
        request_id: str,
        ip: str | None,
        user_agent: str | None,
        notifications: NotificationService | None = None,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._storage = storage
        self._provider = provider
        self._request_id = request_id
        self._ip = ip
        self._user_agent = user_agent
        self._notifications = notifications
        self._users = ProfileQueryRepository(session)
        self._profiles = ProfileRepository(session)
        self._requests = VerificationRequestRepository(session)
        self._media = VerificationMediaRepository(session)
        self._reviews = VerificationReviewRepository(session)
        self._audit = AuditLogRepository(session)
        self._retention = VerificationRetentionPolicy(
            media_retention_days=settings.verification_media_retention_days
        )

    async def get_status(self, actor: User) -> dict[str, Any]:
        await self._hit("verification_status", actor.id)
        user = await self._load_user(actor.id)
        latest = await self._requests.latest_for_user(actor.id)
        profile = user.profile
        profile_status = (
            profile.verification_status if profile else VerificationStatus.UNVERIFIED.value
        )
        request_status = latest.status if latest else None
        if latest and latest.status in ACTIVE_REQUEST_STATUSES and self._expired(latest):
            latest.status = VerificationRequestStatus.EXPIRED.value
            await self._sync_profile(user, latest.status)
            await self._write_audit(actor.id, "VERIFICATION_EXPIRED", {"requestId": str(latest.id)})
            await self._session.commit()
            request_status = latest.status
        status = public_user_status(profile_status, request_status)
        return self._serialize_public(user, latest, status)

    async def start(self, actor: User, verification_type: str | None) -> dict[str, Any]:
        await self._hit("verification_start", actor.id)
        user = await self._load_user(actor.id)
        account_can_verify(user)
        vtype = parse_verification_type(verification_type)
        profile = user.profile
        assert profile is not None
        if profile.verification_status == VerificationStatus.VERIFIED.value:
            latest = await self._requests.latest_for_user(actor.id, vtype)
            return self._serialize_public(user, latest, "APPROVED")
        active = await self._requests.get_active(actor.id, vtype)
        if active is not None:
            return self._serialize_public(user, active, active.status)
        latest = await self._requests.latest_for_user(actor.id, vtype)
        if latest and latest.status in RETRYABLE_REQUEST_STATUSES:
            await self._hit("verification_retry", actor.id)
        session = await self._provider.create_verification_session(actor.id, vtype)
        request = VerificationRequest(
            user_id=actor.id,
            verification_type=vtype,
            status=VerificationRequestStatus.PENDING.value,
            expires_at=default_expiry(self._settings.verification_request_expire_days),
            provider_session_id=str(session.get("sessionId") or ""),
        )
        await self._requests.add(request)
        profile.verification_status = VerificationStatus.PENDING.value
        await self._write_audit(
            actor.id,
            "VERIFICATION_STARTED",
            {"requestId": str(request.id), "verificationType": vtype},
        )
        await self._session.commit()
        logger.info(
            "verification_started request_id=%s user=%s type=%s",
            self._request_id,
            actor.id,
            vtype,
        )
        return self._serialize_public(user, request, request.status)

    async def create_upload_url(
        self, actor: User, content_type: str, filename: str, byte_size: int
    ) -> dict[str, Any]:
        await self._hit("verification_submit", actor.id)
        user = await self._load_user(actor.id)
        account_can_verify(user)
        request = await self._requests.get_active(
            actor.id, VerificationType.SELFIE_VERIFICATION.value
        )
        if request is None:
            raise AppError(
                "VERIFICATION_NOT_STARTED", "Start verification before uploading media.", 409
            )
        if request.status != VerificationRequestStatus.PENDING.value:
            raise AppError(
                "VERIFICATION_NOT_EDITABLE", "This request can no longer accept media.", 409
            )
        return await self._storage.create_upload_target(
            actor.id,
            content_type,
            filename,
            byte_size,
            purpose="verification",
        )

    async def submit(self, actor: User, storage_keys: list[str], media_type: str) -> dict[str, Any]:
        await self._hit("verification_submit", actor.id)
        user = await self._load_user(actor.id)
        account_can_verify(user)
        keys = [key.strip() for key in storage_keys if key and key.strip()]
        if not keys:
            raise AppError("VALIDATION_ERROR", "A verification photo is required.", 422)
        request = await self._requests.get_active(
            actor.id, VerificationType.SELFIE_VERIFICATION.value
        )
        if request is None:
            raise AppError("VERIFICATION_NOT_STARTED", "Start verification before submitting.", 409)
        if request.status != VerificationRequestStatus.PENDING.value:
            return self._serialize_public(user, request, request.status)
        now = datetime.now(UTC)
        for key in keys:
            await self._attach_media(actor.id, request, key, media_type)
        media_refs = [item.storage_key for item in request.media if item.deleted_at is None]
        if request.provider_session_id:
            try:
                await self._provider.submit_verification(request.provider_session_id, media_refs)
            except Exception as exc:
                logger.info("verification_provider_submit_failed request_id=%s", self._request_id)
                raise AppError(
                    "VERIFICATION_PROVIDER_ERROR", "Verification could not be submitted.", 502
                ) from exc
        request.submitted_at = now
        request.status = VerificationRequestStatus.IN_REVIEW.value
        await self._sync_profile(user, request.status)
        await self._write_audit(
            actor.id,
            "VERIFICATION_SUBMITTED",
            {"requestId": str(request.id), "mediaCount": len(media_refs)},
        )
        pending = []
        if self._notifications is not None:
            pending = await self._notifications.persist_verification(
                user_id=actor.id,
                request_id=request.id,
                event="VERIFICATION_SUBMITTED",
            )
        await self._session.commit()
        if self._notifications is not None and pending:
            await self._notifications.enqueue(pending)
        logger.info("verification_submitted request_id=%s request=%s", self._request_id, request.id)
        return self._serialize_public(user, request, request.status)

    async def cancel(self, actor: User) -> dict[str, Any]:
        await self._hit("verification_cancel", actor.id)
        user = await self._load_user(actor.id)
        request = await self._requests.get_active(
            actor.id, VerificationType.SELFIE_VERIFICATION.value
        )
        if request is None:
            latest = await self._requests.latest_for_user(actor.id)
            status = public_user_status(
                user.profile.verification_status if user.profile else None,
                latest.status if latest else None,
            )
            return self._serialize_public(user, latest, status)
        if request.provider_session_id:
            try:
                await self._provider.cancel_verification(request.provider_session_id)
            except Exception:
                logger.info("verification_provider_cancel_failed request_id=%s", self._request_id)
        request.status = VerificationRequestStatus.CANCELLED.value
        await self._sync_profile(user, request.status)
        await self._write_audit(actor.id, "VERIFICATION_CANCELLED", {"requestId": str(request.id)})
        await self._session.commit()
        return self._serialize_public(user, request, request.status)

    async def get_own_media_bytes(self, actor: User, media_id: UUID) -> tuple[bytes, str]:
        media = await self._media.get(media_id)
        if media is None or media.deleted_at is not None:
            raise NotFoundError("Verification media not found.")
        request = await self._requests.get(media.verification_request_id)
        if request is None or request.user_id != actor.id:
            raise ForbiddenError("You cannot access this verification media.")
        data = await self._storage.read_bytes(media.storage_key)
        return data, "image/jpeg"

    async def _attach_media(
        self, user_id: UUID, request: VerificationRequest, storage_key: str, media_type: str
    ) -> VerificationMedia:
        if not owns_storage_key(user_id, storage_key):
            raise ForbiddenError("This upload does not belong to the current user.")
        if not is_verification_storage_key(storage_key):
            raise ForbiddenError("Profile media cannot be used for verification.")
        existing = await self._media.get_by_storage_key(storage_key)
        if existing is not None:
            if existing.verification_request_id == request.id:
                return existing
            raise ForbiddenError("This upload is already attached to another request.")
        if not await self._storage.object_exists(storage_key):
            raise AppError("VERIFICATION_MEDIA_INVALID", "Uploaded object was not found.", 400)
        data = await self._storage.read_bytes(storage_key)
        if sniff_image_type(data) is None:
            raise AppError("VERIFICATION_MEDIA_INVALID", "File is not a supported image.", 422)
        media = VerificationMedia(
            verification_request_id=request.id,
            media_type=media_type[:32] or "selfie",
            storage_key=storage_key,
            metadata_json={"byteSize": len(data)},
        )
        await self._media.add(media)
        request.media.append(media)
        return media

    async def _load_user(self, user_id: UUID) -> User:
        user = await self._users.get_user_bundle(user_id)
        if user is None or not account_is_active(user):
            raise NotFoundError("Profile not found.")
        if user.profile is None:
            await self._profiles.add(Profile(user_id=user.id))
            user = await self._users.get_user_bundle(user_id)
            assert user is not None
        return user

    async def _sync_profile(self, user: User, request_status: str) -> None:
        profile = user.profile
        if profile is None:
            return
        current = profile.verification_status
        profile.verification_status = profile_status_from_request(request_status, current)

    def _expired(self, request: VerificationRequest) -> bool:
        if request.expires_at is None:
            return False
        expires = request.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        return datetime.now(UTC) >= expires

    def _serialize_public(
        self, user: User, request: VerificationRequest | None, status: str
    ) -> dict[str, Any]:
        profile = user.profile
        verified = bool(
            profile and profile.verification_status == VerificationStatus.VERIFIED.value
        )
        payload: dict[str, Any] = {
            "userId": str(user.id),
            "status": status,
            "verificationType": request.verification_type
            if request
            else VerificationType.SELFIE_VERIFICATION.value,
            "isVerified": verified,
            "verificationStatus": profile.verification_status if profile else "UNVERIFIED",
            "nextAction": next_action_for(status),
            "requestId": str(request.id) if request else None,
            "submittedAt": request.submitted_at.isoformat()
            if request and request.submitted_at
            else None,
            "rejectionReasonCode": None,
            "rejectionMessage": None,
        }
        if request and request.status == VerificationRequestStatus.REJECTED.value:
            payload["rejectionReasonCode"] = request.rejection_reason_code
            payload["rejectionMessage"] = public_rejection_message(request.rejection_reason_code)
        return payload

    async def _hit(self, policy: str, user_id: UUID) -> None:
        limit, window = RATE_LIMIT_POLICIES[policy]
        await self._limiter.hit(f"{policy}:{user_id}", limit, window)

    async def _write_audit(
        self,
        user_id: UUID | None,
        action: str,
        metadata: dict | None = None,
        *,
        actor_id: UUID | None = None,
        target_type: str | None = None,
        target_id: UUID | None = None,
    ) -> None:
        await self._audit.add(
            AuditLog(
                user_id=user_id,
                actor_id=actor_id,
                action=action,
                target_type=target_type,
                target_id=target_id,
                ip_address=self._ip,
                user_agent=self._user_agent,
                request_id=self._request_id,
                metadata_json=metadata,
            )
        )


class VerificationReviewService:
    def __init__(self, verification: VerificationService) -> None:
        self._inner = verification

    async def review(
        self,
        actor: User,
        request_id: UUID,
        action: str,
        reason_code: str | None,
        notes: str | None,
    ) -> dict[str, Any]:
        require_reviewer(actor)
        parsed = parse_review_action(action)
        request = await self._inner._requests.get(request_id)
        if request is None:
            raise NotFoundError("Verification request not found.")
        user = await self._inner._load_user(request.user_id)
        claimed = await self._claim(request_id, actor)
        request = await self._inner._requests.get(request_id)
        assert request is not None
        if parsed == VerificationReviewAction.START_REVIEW.value:
            if not claimed and request.reviewer_id != actor.id:
                raise ConflictError(
                    "VERIFICATION_CLAIMED",
                    "Another reviewer already claimed this request.",
                )
            await self._inner._reviews.add(
                VerificationReview(
                    verification_request_id=request.id,
                    reviewer_id=actor.id,
                    action=parsed,
                    notes=(notes or "")[:500] or None,
                )
            )
            await self._inner._write_audit(
                request.user_id,
                "VERIFICATION_REVIEW_STARTED",
                {"requestId": str(request.id)},
                actor_id=actor.id,
                target_type="verification",
                target_id=request.id,
            )
            await self._inner._sync_profile(user, request.status)
            await self._inner._session.commit()
            return {"requestId": str(request.id), "status": request.status}
        if request.status not in ACTIVE_REQUEST_STATUSES:
            raise AppError(
                "VERIFICATION_NOT_REVIEWABLE", "This request is not awaiting review.", 409
            )
        if request.reviewer_id not in {None, actor.id} and actor.role != UserRole.ADMIN.value:
            raise ConflictError(
                "VERIFICATION_CLAIMED",
                "Another reviewer already claimed this request.",
            )
        now = datetime.now(UTC)
        request.reviewed_at = now
        request.reviewer_id = actor.id
        request.lock_version = int(request.lock_version or 0) + 1
        event = "VERIFICATION_APPROVED"
        notify_type = "VERIFICATION_APPROVED"
        if parsed == VerificationReviewAction.APPROVE.value:
            request.status = VerificationRequestStatus.APPROVED.value
            request.rejection_reason_code = None
        elif parsed == VerificationReviewAction.REJECT.value:
            code = parse_reason_code(reason_code)
            request.status = VerificationRequestStatus.REJECTED.value
            request.rejection_reason_code = code
            event = "VERIFICATION_REJECTED"
            notify_type = "VERIFICATION_REJECTED"
        else:
            raise AppError("VALIDATION_ERROR", "Invalid review action.", 422)
        await self._inner._reviews.add(
            VerificationReview(
                verification_request_id=request.id,
                reviewer_id=actor.id,
                action=parsed,
                reason_code=request.rejection_reason_code,
                notes=(notes or "")[:2000] or None,
            )
        )
        await self._inner._sync_profile(user, request.status)
        await self._inner._write_audit(
            request.user_id,
            event,
            {"requestId": str(request.id), "reasonCode": request.rejection_reason_code},
            actor_id=actor.id,
            target_type="verification",
            target_id=request.id,
        )
        pending = []
        if self._inner._notifications is not None:
            pending = await self._inner._notifications.persist_verification(
                user_id=request.user_id,
                request_id=request.id,
                event=notify_type,
            )
        await self._inner._session.commit()
        if self._inner._notifications is not None and pending:
            await self._inner._notifications.enqueue(pending)
        logger.info(
            "verification_reviewed request_id=%s action=%s", self._inner._request_id, parsed
        )
        return {
            "requestId": str(request.id),
            "status": request.status,
            "isVerified": user.profile.verification_status == VerificationStatus.VERIFIED.value
            if user.profile
            else False,
        }

    async def _claim(self, request_id: UUID, actor: User) -> bool:
        result = await self._inner._session.execute(
            update(VerificationRequest)
            .where(
                VerificationRequest.id == request_id,
                VerificationRequest.status == VerificationRequestStatus.PENDING.value,
            )
            .values(
                status=VerificationRequestStatus.IN_REVIEW.value,
                reviewer_id=actor.id,
                lock_version=VerificationRequest.lock_version + 1,
            )
        )
        await self._inner._session.flush()
        return bool(result.rowcount)
