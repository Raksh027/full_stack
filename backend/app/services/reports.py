from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.eligibility import parse_user_id, require_not_self
from app.core.errors import AppError, NotFoundError
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.report_rules import SEVERITY_FOR_REASON, parse_reason_code, public_reason_label
from app.models.orm import AuditLog, EventStatus, User, UserReport, UserStatus
from app.repositories.events import EventRepository
from app.repositories.moderation import ReportRepository
from app.repositories.users import AuditLogRepository, UserRepository

logger = logging.getLogger(__name__)


class ReportService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        request_id: str,
        ip: str | None,
        user_agent: str | None,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._request_id = request_id
        self._ip = ip
        self._user_agent = user_agent
        self._reports = ReportRepository(session)
        self._users = UserRepository(session)
        self._events = EventRepository(session)
        self._audit = AuditLogRepository(session)

    async def create(self, actor: User, body) -> dict[str, Any]:
        limit, window = RATE_LIMIT_POLICIES["reports"]
        await self._limiter.hit(f"reports:{actor.id}", limit, window)
        target_id = parse_user_id(body.reported_user_id)
        require_not_self(actor.id, target_id, "report")
        target = await self._users.get_by_id(target_id)
        if target is None or target.deleted_at is not None:
            raise NotFoundError("User not found.")
        if target.status == UserStatus.DELETED.value:
            raise NotFoundError("User not found.")
        reason = parse_reason_code(body.reason_code or body.reason)
        description = (body.description or body.details or "").strip()[:1000] or None
        content_type = (body.related_content_type or "").strip().lower() or None
        content_id = None
        if body.message_id:
            content_type = content_type or "message"
            content_id = parse_user_id(body.message_id, field="messageId")
        elif body.conversation_id:
            content_type = content_type or "conversation"
            content_id = parse_user_id(body.conversation_id, field="conversationId")
        elif body.related_content_id:
            content_id = parse_user_id(body.related_content_id, field="relatedContentId")
        if content_type == "event":
            if content_id is None:
                raise AppError("VALIDATION_ERROR", "An event id is required.", 422)
            event = await self._events.get(content_id)
            if event is None or event.status == EventStatus.HIDDEN.value:
                raise NotFoundError("Event not found.")
            if event.host_user_id != target_id:
                raise AppError("VALIDATION_ERROR", "The reported user must be the event host.", 422)
        existing = await self._reports.open_duplicate(
            actor.id,
            target_id,
            reason,
            related_content_type=content_type,
            related_content_id=content_id if content_type == "event" else None,
        )
        if existing is not None:
            return self._serialize_owner(existing, created=False)
        row = UserReport(
            reporter_id=actor.id,
            reported_user_id=target_id,
            reason_code=reason,
            description=description,
            related_content_type=content_type,
            related_content_id=content_id,
            severity=SEVERITY_FOR_REASON.get(reason, "MEDIUM"),
        )
        await self._reports.add(row)
        metadata = {"reasonCode": reason}
        if content_type == "event" and content_id is not None:
            metadata["eventId"] = str(content_id)
        await self._audit.add(
            AuditLog(
                user_id=target_id,
                actor_id=actor.id,
                action="REPORT_CREATED",
                target_type="report",
                target_id=row.id,
                request_id=self._request_id,
                ip_address=self._ip,
                user_agent=self._user_agent,
                metadata_json=metadata,
            )
        )
        await self._session.commit()
        logger.info("report_created request_id=%s report=%s", self._request_id, row.id)
        return self._serialize_owner(row, created=True)

    def _serialize_owner(self, row: UserReport, created: bool) -> dict[str, Any]:
        return {
            "id": str(row.id),
            "status": row.status,
            "reasonCode": row.reason_code,
            "reasonLabel": public_reason_label(row.reason_code),
            "created": created,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
        }
