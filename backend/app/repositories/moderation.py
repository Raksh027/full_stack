from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.orm import (
    AuditLog,
    Profile,
    User,
    UserAuth,
    UserReport,
    VerificationRequest,
)


class ReportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, row: UserReport) -> UserReport:
        self._session.add(row)
        await self._session.flush()
        return row

    async def get(self, report_id: UUID) -> UserReport | None:
        return await self._session.get(UserReport, report_id)

    async def open_duplicate(
        self,
        reporter_id: UUID,
        reported_user_id: UUID,
        reason_code: str,
        *,
        related_content_type: str | None = None,
        related_content_id: UUID | None = None,
    ) -> UserReport | None:
        stmt = (
            select(UserReport)
            .where(
                UserReport.reporter_id == reporter_id,
                UserReport.reported_user_id == reported_user_id,
                UserReport.reason_code == reason_code,
                UserReport.status.in_(("OPEN", "IN_REVIEW")),
            )
            .order_by(UserReport.created_at.desc())
        )
        if related_content_type == "event" and related_content_id is not None:
            stmt = stmt.where(
                UserReport.related_content_type == "event",
                UserReport.related_content_id == related_content_id,
            )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    def _filtered(
        self,
        *,
        status: str | None,
        severity: str | None,
        assigned: UUID | None,
        reported_user_id: UUID | None,
    ) -> Select:
        stmt = select(UserReport)
        if status:
            stmt = stmt.where(UserReport.status == status)
        if severity:
            stmt = stmt.where(UserReport.severity == severity)
        if assigned:
            stmt = stmt.where(UserReport.assigned_reviewer_id == assigned)
        if reported_user_id:
            stmt = stmt.where(UserReport.reported_user_id == reported_user_id)
        return stmt

    async def list_page(
        self,
        *,
        status: str | None,
        severity: str | None,
        assigned: UUID | None,
        reported_user_id: UUID | None,
        limit: int,
        offset: int,
    ) -> tuple[list[UserReport], int]:
        base = self._filtered(
            status=status,
            severity=severity,
            assigned=assigned,
            reported_user_id=reported_user_id,
        )
        total = await self._session.scalar(select(func.count()).select_from(base.subquery()))
        result = await self._session.execute(
            base.order_by(UserReport.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars()), int(total or 0)

    async def list_for_user(self, user_id: UUID, limit: int = 20) -> list[UserReport]:
        result = await self._session.execute(
            select(UserReport)
            .where((UserReport.reported_user_id == user_id) | (UserReport.reporter_id == user_id))
            .order_by(UserReport.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def list_for_event(self, event_id: UUID, limit: int = 50) -> list[UserReport]:
        result = await self._session.execute(
            select(UserReport)
            .where(
                UserReport.related_content_type == "event",
                UserReport.related_content_id == event_id,
            )
            .order_by(UserReport.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())


class AdminUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def search(
        self,
        *,
        query: str | None,
        status: str | None,
        verification_status: str | None,
        created_after: datetime | None,
        created_before: datetime | None,
        limit: int,
        offset: int,
    ) -> tuple[list[User], int]:
        stmt = select(User).options(selectinload(User.auth), selectinload(User.profile))
        if status:
            stmt = stmt.where(User.status == status)
        if verification_status:
            stmt = stmt.join(Profile).where(Profile.verification_status == verification_status)
        if created_after:
            stmt = stmt.where(User.created_at >= created_after)
        if created_before:
            stmt = stmt.where(User.created_at <= created_before)
        if query:
            term = f"%{query.strip()}%"
            stmt = stmt.outerjoin(User.auth).outerjoin(User.profile)
            stmt = stmt.where(
                or_(
                    UserAuth.email.ilike(term),
                    Profile.display_name.ilike(term),
                    cast(User.id, String).ilike(term),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.distinct().subquery())
        total = await self._session.scalar(count_stmt)
        result = await self._session.execute(
            stmt.distinct().order_by(User.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars()), int(total or 0)


class AdminAuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_page(
        self,
        *,
        action: str | None,
        actor_id: UUID | None,
        target_id: UUID | None = None,
        limit: int,
        offset: int,
    ) -> tuple[list[AuditLog], int]:
        stmt = select(AuditLog)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        if actor_id:
            stmt = stmt.where(AuditLog.actor_id == actor_id)
        if target_id:
            stmt = stmt.where((AuditLog.target_id == target_id) | (AuditLog.user_id == target_id))
        total = await self._session.scalar(select(func.count()).select_from(stmt.subquery()))
        result = await self._session.execute(
            stmt.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars()), int(total or 0)


class DashboardRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def counts(self) -> dict[str, int]:
        pending = await self._session.scalar(
            select(func.count())
            .select_from(VerificationRequest)
            .where(VerificationRequest.status.in_(("PENDING", "IN_REVIEW")))
        )
        approved = await self._session.scalar(
            select(func.count())
            .select_from(VerificationRequest)
            .where(VerificationRequest.status == "APPROVED")
        )
        rejected = await self._session.scalar(
            select(func.count())
            .select_from(VerificationRequest)
            .where(VerificationRequest.status == "REJECTED")
        )
        open_reports = await self._session.scalar(
            select(func.count()).select_from(UserReport).where(UserReport.status == "OPEN")
        )
        suspended = await self._session.scalar(
            select(func.count()).select_from(User).where(User.status == "SUSPENDED")
        )
        banned = await self._session.scalar(
            select(func.count()).select_from(User).where(User.status == "BANNED")
        )
        return {
            "pendingVerifications": int(pending or 0),
            "approvedVerifications": int(approved or 0),
            "rejectedVerifications": int(rejected or 0),
            "openReports": int(open_reports or 0),
            "suspendedUsers": int(suspended or 0),
            "bannedUsers": int(banned or 0),
        }

    async def reports_by_severity(self) -> dict[str, int]:
        result = await self._session.execute(
            select(UserReport.severity, func.count())
            .where(UserReport.status.in_(("OPEN", "IN_REVIEW")))
            .group_by(UserReport.severity)
        )
        return {row[0]: int(row[1]) for row in result.all()}

    async def recent_actions(self, limit: int = 10) -> list[AuditLog]:
        result = await self._session.execute(
            select(AuditLog)
            .where(
                AuditLog.action.in_(
                    (
                        "USER_SUSPENDED",
                        "USER_BANNED",
                        "USER_RESTORED",
                        "REPORT_RESOLVED",
                        "REPORT_DISMISSED",
                        "VERIFICATION_APPROVED",
                        "VERIFICATION_REJECTED",
                        "EVENT_COVER_REMOVED",
                        "EVENT_HIDDEN",
                        "EVENT_RESTORED",
                    )
                )
            )
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())
