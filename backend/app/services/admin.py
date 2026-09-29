from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.eligibility import parse_user_id
from app.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.rbac import has_permission
from app.core.report_rules import parse_severity, public_reason_label
from app.core.verification_rules import public_rejection_message
from app.models.orm import (
    AuditLog,
    EventStatus,
    Message,
    ReportStatus,
    SocialEvent,
    User,
    UserReport,
    UserRole,
    UserStatus,
    VerificationRequest,
)
from app.repositories.events import EventRepository
from app.repositories.moderation import (
    AdminAuditRepository,
    AdminUserRepository,
    DashboardRepository,
    ReportRepository,
)
from app.repositories.profiles import MediaRepository, ProfileQueryRepository
from app.repositories.users import AuditLogRepository, SessionRepository, UserRepository
from app.repositories.verification import VerificationMediaRepository, VerificationRequestRepository
from app.services.storage import LocalStorageProvider
from app.services.verification import VerificationReviewService

logger = logging.getLogger(__name__)


class AdminService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        storage: LocalStorageProvider,
        review: VerificationReviewService,
        request_id: str,
        ip: str | None,
        user_agent: str | None,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._storage = storage
        self._review = review
        self._request_id = request_id
        self._ip = ip
        self._user_agent = user_agent
        self._users = UserRepository(session)
        self._admin_users = AdminUserRepository(session)
        self._reports = ReportRepository(session)
        self._audit_query = AdminAuditRepository(session)
        self._audit = AuditLogRepository(session)
        self._dashboard = DashboardRepository(session)
        self._verifications = VerificationRequestRepository(session)
        self._vmedia = VerificationMediaRepository(session)
        self._profiles = ProfileQueryRepository(session)
        self._media = MediaRepository(session)
        self._sessions = SessionRepository(session)
        self._events = EventRepository(session)

    async def dashboard(self, actor: User) -> dict[str, Any]:
        counts = await self._dashboard.counts()
        recent = await self._dashboard.recent_actions(10)
        return {
            **counts,
            "reportsBySeverity": await self._dashboard.reports_by_severity(),
            "recentActions": [self._serialize_audit(row) for row in recent],
        }

    async def list_users(
        self,
        *,
        query: str | None,
        status: str | None,
        verification_status: str | None,
        created_after: str | None = None,
        created_before: str | None = None,
        limit: int,
        offset: int,
    ) -> dict[str, Any]:
        after = self._parse_dt(created_after)
        before = self._parse_dt(created_before)
        rows, total = await self._admin_users.search(
            query=query,
            status=status,
            verification_status=verification_status,
            created_after=after,
            created_before=before,
            limit=min(limit, 50),
            offset=offset,
        )
        return {
            "items": [await self._serialize_user_card(user) for user in rows],
            "total": total,
            "limit": min(limit, 50),
            "offset": offset,
        }

    async def user_detail(self, user_id: UUID) -> dict[str, Any]:
        user = await self._profiles.get_user_bundle(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        reports = await self._reports.list_for_user(user_id, 20)
        target_audits, _ = await self._audit_query.list_page(
            action=None, actor_id=None, target_id=user_id, limit=20, offset=0
        )
        media = []
        if user.profile:
            media = [
                {
                    "id": str(item.id),
                    "url": item.url,
                    "isPrimary": item.is_primary,
                    "moderationStatus": item.moderation_status,
                }
                for item in user.profile.media
                if item.deleted_at is None
            ]
        return {
            **(await self._serialize_user_card(user)),
            "bio": user.profile.bio if user.profile else None,
            "media": media,
            "reports": [self._serialize_report(row, include_reporter=True) for row in reports],
            "moderationHistory": [self._serialize_audit(row) for row in target_audits[:20]],
        }

    async def suspend(
        self, actor: User, user_id: UUID, hours: int | None, reason: str | None
    ) -> dict[str, Any]:
        await self._hit("admin_moderate", actor.id)
        user = await self._require_target(user_id)
        if user.role != UserRole.USER.value:
            raise ForbiddenError("Staff accounts cannot be suspended from this tool.")
        until = None
        if hours and hours > 0:
            until = datetime.now(UTC) + timedelta(hours=hours)
        if user.status == UserStatus.SUSPENDED.value and user.suspended_until == until:
            return await self._serialize_user_card(user)
        user.status = UserStatus.SUSPENDED.value
        user.suspended_until = until
        await self._sessions.revoke_all_for_user(user.id)
        await self._write_audit(
            actor, "USER_SUSPENDED", user.id, "user", {"hours": hours, "reason": reason}
        )
        await self._session.commit()
        logger.info("user_suspended request_id=%s target=%s", self._request_id, user.id)
        return await self._serialize_user_card(user)

    async def ban(self, actor: User, user_id: UUID, reason: str | None) -> dict[str, Any]:
        await self._hit("admin_moderate", actor.id)
        user = await self._require_target(user_id)
        if user.role != UserRole.USER.value:
            raise ForbiddenError("Staff accounts cannot be banned from this tool.")
        if user.status == UserStatus.BANNED.value:
            return await self._serialize_user_card(user)
        user.status = UserStatus.BANNED.value
        user.suspended_until = None
        await self._sessions.revoke_all_for_user(user.id)
        await self._write_audit(actor, "USER_BANNED", user.id, "user", {"reason": reason})
        await self._session.commit()
        logger.info("user_banned request_id=%s target=%s", self._request_id, user.id)
        return await self._serialize_user_card(user)

    async def restore(self, actor: User, user_id: UUID) -> dict[str, Any]:
        await self._hit("admin_moderate", actor.id)
        user = await self._require_target(user_id)
        if user.status == UserStatus.ACTIVE.value:
            return await self._serialize_user_card(user)
        if user.status not in {UserStatus.SUSPENDED.value, UserStatus.BANNED.value}:
            raise AppError("VALIDATION_ERROR", "This account cannot be restored.", 409)
        user.status = UserStatus.ACTIVE.value
        user.suspended_until = None
        await self._write_audit(actor, "USER_RESTORED", user.id, "user", None)
        await self._session.commit()
        return await self._serialize_user_card(user)

    async def verification_queue(
        self, status: str | None, limit: int, offset: int
    ) -> dict[str, Any]:
        rows, total = await self._verifications.queue(
            status=status, limit=min(limit, 50), offset=offset
        )
        items = []
        for row in rows:
            user = await self._profiles.get_user_bundle(row.user_id)
            items.append(self._serialize_verification(row, user))
        return {"items": items, "total": total, "limit": min(limit, 50), "offset": offset}

    async def verification_detail(self, request_id: UUID) -> dict[str, Any]:
        row = await self._verifications.get(request_id)
        if row is None:
            raise NotFoundError("Verification request not found.")
        user = await self._profiles.get_user_bundle(row.user_id)
        media = [
            {
                "id": str(item.id),
                "mediaType": item.media_type,
                "createdAt": item.created_at.isoformat() if item.created_at else None,
            }
            for item in row.media
            if item.deleted_at is None
        ]
        payload = self._serialize_verification(row, user)
        payload["media"] = media
        return payload

    async def verification_media_bytes(
        self, actor: User, request_id: UUID, media_id: UUID
    ) -> tuple[bytes, str]:
        media = await self._vmedia.get(media_id)
        if media is None or media.deleted_at is not None:
            raise NotFoundError("Verification media not found.")
        if media.verification_request_id != request_id:
            raise ForbiddenError("Media does not belong to this request.")
        data = await self._storage.read_bytes(media.storage_key)
        return data, "image/jpeg"

    async def review_verification(
        self, actor: User, request_id: UUID, action: str, reason: str | None, notes: str | None
    ):
        await self._hit("verification_review", actor.id)
        return await self._review.review(actor, request_id, action, reason, notes)

    async def list_reports(
        self,
        *,
        status: str | None,
        severity: str | None,
        assigned: UUID | None,
        limit: int,
        offset: int,
    ) -> dict[str, Any]:
        rows, total = await self._reports.list_page(
            status=status,
            severity=parse_severity(severity) if severity else None,
            assigned=assigned,
            reported_user_id=None,
            limit=min(limit, 50),
            offset=offset,
        )
        return {
            "items": [self._serialize_report(row, include_reporter=True) for row in rows],
            "total": total,
            "limit": min(limit, 50),
            "offset": offset,
        }

    async def report_detail(self, actor: User, report_id: UUID) -> dict[str, Any]:
        row = await self._reports.get(report_id)
        if row is None:
            raise NotFoundError("Report not found.")
        payload = self._serialize_report(row, include_reporter=True)
        payload["context"] = await self._report_context(row)
        return payload

    async def assign_report(
        self, actor: User, report_id: UUID, reviewer_id: str | None
    ) -> dict[str, Any]:
        if not has_permission(actor, "admin.reports.write"):
            raise ForbiddenError("Admin access required.")
        row = await self._reports.get(report_id)
        if row is None:
            raise NotFoundError("Report not found.")
        assigned = parse_user_id(reviewer_id, field="reviewerId") if reviewer_id else actor.id
        row.assigned_reviewer_id = assigned
        if row.status == ReportStatus.OPEN.value:
            row.status = ReportStatus.IN_REVIEW.value
        await self._write_audit(actor, "REPORT_ASSIGNED", row.id, "report", None)
        await self._session.commit()
        return self._serialize_report(row, include_reporter=True)

    async def resolve_report(
        self, actor: User, report_id: UUID, resolution_code: str, notes: str | None
    ) -> dict[str, Any]:
        return await self._close_report(
            actor, report_id, ReportStatus.RESOLVED.value, resolution_code, notes, "REPORT_RESOLVED"
        )

    async def dismiss_report(
        self, actor: User, report_id: UUID, notes: str | None
    ) -> dict[str, Any]:
        return await self._close_report(
            actor, report_id, ReportStatus.DISMISSED.value, "DISMISSED", notes, "REPORT_DISMISSED"
        )

    async def remove_media(
        self, actor: User, user_id: UUID, media_id: UUID, reason: str | None
    ) -> dict[str, Any]:
        if not has_permission(actor, "admin.users.moderate"):
            raise ForbiddenError("Admin access required.")
        user = await self._profiles.get_user_bundle(user_id)
        if user is None or user.profile is None:
            raise NotFoundError("Profile not found.")
        media = await self._media.get(media_id)
        if media is None or media.profile_id != user.profile.id or media.deleted_at is not None:
            raise NotFoundError("Media not found.")
        await self._media.soft_delete(media)
        await self._write_audit(actor, "MEDIA_REMOVED", media.id, "media", {"reason": reason})
        await self._session.commit()
        return {"removed": True, "id": str(media_id)}

    async def list_events(
        self,
        *,
        query: str | None,
        status: str | None,
        limit: int,
        offset: int,
    ) -> dict[str, Any]:
        if status:
            allowed = {item.value for item in EventStatus}
            if status not in allowed:
                raise AppError("VALIDATION_ERROR", "Invalid event status.", 422)
        rows, total = await self._events.admin_list(
            query=query,
            status=status,
            limit=min(limit, 50),
            offset=offset,
        )
        counts = await self._events.counts_going([row.id for row in rows])
        return {
            "items": [self._serialize_event_card(row, counts.get(row.id, 0)) for row in rows],
            "total": total,
            "limit": min(limit, 50),
            "offset": offset,
        }

    async def event_detail(self, event_id: UUID) -> dict[str, Any]:
        row = await self._events.get(event_id)
        if row is None:
            raise NotFoundError("Event not found.")
        count = await self._events.count_going(row.id)
        reports = await self._reports.list_for_event(row.id)
        payload = self._serialize_event_card(row, count)
        payload.update(
            {
                "description": row.description,
                "location": row.location,
                "latitude": row.latitude,
                "longitude": row.longitude,
                "coverImageUrl": row.cover_url,
                "coverStorageKey": row.cover_storage_key,
                "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
                "reports": [self._serialize_report(item, include_reporter=True) for item in reports],
            }
        )
        return payload

    async def hide_event(self, actor: User, event_id: UUID, reason: str | None) -> dict[str, Any]:
        await self._hit("admin_moderate", actor.id)
        if not has_permission(actor, "admin.events.moderate"):
            raise ForbiddenError("Admin access required.")
        row = await self._require_event(event_id)
        if row.status == EventStatus.HIDDEN.value:
            count = await self._events.count_going(row.id)
            return self._serialize_event_card(row, count)
        if row.status != EventStatus.PUBLISHED.value:
            raise ConflictError("EVENT_CANCELLED", "This event cannot be hidden.")
        row.status = EventStatus.HIDDEN.value
        await self._write_audit(
            actor, "EVENT_HIDDEN", row.id, "event", {"reason": reason, "hostId": str(row.host_user_id)}
        )
        await self._session.commit()
        loaded = await self._events.get(row.id)
        assert loaded is not None
        count = await self._events.count_going(loaded.id)
        return self._serialize_event_card(loaded, count)

    async def restore_event(self, actor: User, event_id: UUID, reason: str | None) -> dict[str, Any]:
        await self._hit("admin_moderate", actor.id)
        if not has_permission(actor, "admin.events.moderate"):
            raise ForbiddenError("Admin access required.")
        row = await self._require_event(event_id)
        if row.status == EventStatus.PUBLISHED.value:
            count = await self._events.count_going(row.id)
            return self._serialize_event_card(row, count)
        if row.status != EventStatus.HIDDEN.value:
            raise AppError("VALIDATION_ERROR", "Only a hidden event can be restored.", 409)
        row.status = EventStatus.PUBLISHED.value
        await self._write_audit(
            actor,
            "EVENT_RESTORED",
            row.id,
            "event",
            {"reason": reason, "hostId": str(row.host_user_id)},
        )
        await self._session.commit()
        loaded = await self._events.get(row.id)
        assert loaded is not None
        count = await self._events.count_going(loaded.id)
        return self._serialize_event_card(loaded, count)

    async def remove_event_cover(
        self, actor: User, event_id: UUID, reason: str | None
    ) -> dict[str, Any]:
        await self._hit("admin_moderate", actor.id)
        if not has_permission(actor, "admin.events.moderate"):
            raise ForbiddenError("Admin access required.")
        row = await self._require_event(event_id)
        previous = row.cover_storage_key
        row.cover_storage_key = None
        row.cover_url = None
        if previous:
            await self._storage.delete_object(previous)
        await self._write_audit(
            actor,
            "EVENT_COVER_REMOVED",
            row.id,
            "event",
            {"reason": reason, "hadCover": bool(previous)},
        )
        await self._session.commit()
        loaded = await self._events.get(row.id)
        assert loaded is not None
        count = await self._events.count_going(loaded.id)
        return self._serialize_event_card(loaded, count)

    async def _require_event(self, event_id: UUID) -> SocialEvent:
        row = await self._events.get(event_id)
        if row is None:
            raise NotFoundError("Event not found.")
        return row

    def _serialize_event_card(self, row: SocialEvent, attendee_count: int) -> dict[str, Any]:
        host = row.host
        profile = host.profile if host is not None else None
        host_name = (profile.display_name if profile is not None else None) or "Host"
        return {
            "id": str(row.id),
            "title": row.title,
            "status": row.status,
            "hostId": str(row.host_user_id),
            "hostName": host_name,
            "startsAt": row.starts_at.isoformat() if row.starts_at else None,
            "endsAt": row.ends_at.isoformat() if row.ends_at else None,
            "attendeeCount": attendee_count,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
            "coverImageUrl": row.cover_url,
        }

    async def list_audit(
        self, action: str | None, actor_id: UUID | None, limit: int, offset: int
    ) -> dict[str, Any]:
        rows, total = await self._audit_query.list_page(
            action=action, actor_id=actor_id, limit=min(limit, 50), offset=offset
        )
        return {
            "items": [self._serialize_audit(row) for row in rows],
            "total": total,
            "limit": min(limit, 50),
            "offset": offset,
        }

    async def _close_report(
        self,
        actor: User,
        report_id: UUID,
        status: str,
        resolution_code: str,
        notes: str | None,
        audit_action: str,
    ) -> dict[str, Any]:
        if not has_permission(actor, "admin.reports.write"):
            raise ForbiddenError("Admin access required.")
        row = await self._reports.get(report_id)
        if row is None:
            raise NotFoundError("Report not found.")
        if row.status in {ReportStatus.RESOLVED.value, ReportStatus.DISMISSED.value}:
            if row.status == status:
                return self._serialize_report(row, include_reporter=True)
            raise ConflictError("REPORT_CLOSED", "This report is already closed.")
        row.status = status
        row.resolution_code = resolution_code[:40]
        row.resolution_notes = (notes or "")[:2000] or None
        row.resolved_at = datetime.now(UTC)
        await self._write_audit(
            actor, audit_action, row.id, "report", {"resolutionCode": resolution_code}
        )
        await self._session.commit()
        return self._serialize_report(row, include_reporter=True)

    async def _report_context(self, row: UserReport) -> dict[str, Any]:
        context: dict[str, Any] = {"relatedContentType": row.related_content_type}
        if row.related_content_type == "message" and row.related_content_id:
            message = await self._session.get(Message, row.related_content_id)
            if message is not None:
                preview = (message.content or "")[:80]
                context["message"] = {
                    "id": str(message.id),
                    "conversationId": str(message.conversation_id),
                    "preview": preview,
                    "createdAt": message.created_at.isoformat() if message.created_at else None,
                }
        if row.related_content_type == "event" and row.related_content_id:
            event = await self._events.get(row.related_content_id)
            if event is not None:
                context["event"] = {
                    "id": str(event.id),
                    "title": event.title,
                    "status": event.status,
                    "hostId": str(event.host_user_id),
                }
        return context

    def _parse_dt(self, value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid date filter.", 422) from exc

    async def _require_target(self, user_id: UUID) -> User:
        user = await self._profiles.get_user_bundle(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        return user

    async def _serialize_user_card(self, user: User) -> dict[str, Any]:
        profile = user.profile
        auth = user.auth
        return {
            "id": str(user.id),
            "email": auth.email if auth else None,
            "displayName": profile.display_name if profile else None,
            "status": user.status,
            "role": user.role,
            "verificationStatus": profile.verification_status if profile else "UNVERIFIED",
            "suspendedUntil": user.suspended_until.isoformat() if user.suspended_until else None,
            "createdAt": user.created_at.isoformat() if user.created_at else None,
        }

    def _serialize_verification(
        self, row: VerificationRequest, user: User | None
    ) -> dict[str, Any]:
        profile = user.profile if user else None
        age = None
        submitted = row.submitted_at or row.created_at
        if submitted:
            now = datetime.now(UTC)
            stamp = submitted if submitted.tzinfo else submitted.replace(tzinfo=UTC)
            age = max(0, int((now - stamp).total_seconds()))
        return {
            "id": str(row.id),
            "userId": str(row.user_id),
            "displayName": profile.display_name if profile else None,
            "verificationType": row.verification_type,
            "status": row.status,
            "submittedAt": row.submitted_at.isoformat() if row.submitted_at else None,
            "reviewerId": str(row.reviewer_id) if row.reviewer_id else None,
            "rejectionReasonCode": row.rejection_reason_code,
            "rejectionMessage": public_rejection_message(row.rejection_reason_code),
            "ageSeconds": age,
        }

    def _serialize_report(self, row: UserReport, *, include_reporter: bool) -> dict[str, Any]:
        payload = {
            "id": str(row.id),
            "reportedUserId": str(row.reported_user_id),
            "reasonCode": row.reason_code,
            "reasonLabel": public_reason_label(row.reason_code),
            "status": row.status,
            "severity": row.severity,
            "assignedReviewerId": str(row.assigned_reviewer_id)
            if row.assigned_reviewer_id
            else None,
            "resolutionCode": row.resolution_code,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
            "resolvedAt": row.resolved_at.isoformat() if row.resolved_at else None,
            "relatedContentType": row.related_content_type,
            "relatedContentId": str(row.related_content_id) if row.related_content_id else None,
        }
        if include_reporter:
            payload["reporterId"] = str(row.reporter_id)
        return payload

    def _serialize_audit(self, row: AuditLog) -> dict[str, Any]:
        return {
            "id": str(row.id),
            "actorId": str(row.actor_id) if row.actor_id else None,
            "action": row.action,
            "targetType": row.target_type,
            "targetId": str(row.target_id) if row.target_id else None,
            "userId": str(row.user_id) if row.user_id else None,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
        }

    async def _write_audit(
        self,
        actor: User,
        action: str,
        target_id: UUID,
        target_type: str,
        metadata: dict | None,
    ) -> None:
        await self._audit.add(
            AuditLog(
                user_id=target_id if target_type == "user" else actor.id,
                actor_id=actor.id,
                action=action,
                target_type=target_type,
                target_id=target_id,
                request_id=self._request_id,
                ip_address=self._ip,
                user_agent=self._user_agent,
                metadata_json=metadata,
            )
        )

    async def _hit(self, policy: str, user_id: UUID) -> None:
        limit, window = RATE_LIMIT_POLICIES[policy]
        await self._limiter.hit(f"{policy}:{user_id}", limit, window)
