from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.orm import VerificationMedia, VerificationRequest, VerificationReview


class VerificationRequestRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, request_id: UUID) -> VerificationRequest | None:
        result = await self._session.execute(
            select(VerificationRequest)
            .options(
                selectinload(VerificationRequest.media),
                selectinload(VerificationRequest.reviews),
            )
            .where(VerificationRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def add(self, request: VerificationRequest) -> VerificationRequest:
        self._session.add(request)
        await self._session.flush()
        return request

    async def get_active(self, user_id: UUID, verification_type: str) -> VerificationRequest | None:
        result = await self._session.execute(
            select(VerificationRequest)
            .options(selectinload(VerificationRequest.media))
            .where(
                VerificationRequest.user_id == user_id,
                VerificationRequest.verification_type == verification_type,
                VerificationRequest.status.in_(("PENDING", "IN_REVIEW")),
            )
            .order_by(VerificationRequest.created_at.desc())
        )
        return result.scalars().first()

    async def latest_for_user(
        self, user_id: UUID, verification_type: str | None = None
    ) -> VerificationRequest | None:
        stmt = (
            select(VerificationRequest)
            .options(selectinload(VerificationRequest.media))
            .where(VerificationRequest.user_id == user_id)
            .order_by(VerificationRequest.created_at.desc())
        )
        if verification_type:
            stmt = stmt.where(VerificationRequest.verification_type == verification_type)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def list_for_user(self, user_id: UUID, limit: int = 20) -> list[VerificationRequest]:
        result = await self._session.execute(
            select(VerificationRequest)
            .where(VerificationRequest.user_id == user_id)
            .order_by(VerificationRequest.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def queue(
        self, *, status: str | None, limit: int, offset: int
    ) -> tuple[list[VerificationRequest], int]:
        stmt = select(VerificationRequest)
        if status:
            stmt = stmt.where(VerificationRequest.status == status)
        else:
            stmt = stmt.where(VerificationRequest.status.in_(("PENDING", "IN_REVIEW")))
        total = await self._session.scalar(select(func.count()).select_from(stmt.subquery()))
        result = await self._session.execute(
            stmt.options(selectinload(VerificationRequest.media))
            .order_by(VerificationRequest.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars()), int(total or 0)


class VerificationMediaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, media: VerificationMedia) -> VerificationMedia:
        self._session.add(media)
        await self._session.flush()
        return media

    async def get(self, media_id: UUID) -> VerificationMedia | None:
        return await self._session.get(VerificationMedia, media_id)

    async def get_by_storage_key(self, storage_key: str) -> VerificationMedia | None:
        result = await self._session.execute(
            select(VerificationMedia).where(VerificationMedia.storage_key == storage_key)
        )
        return result.scalar_one_or_none()


class VerificationReviewRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, review: VerificationReview) -> VerificationReview:
        self._session.add(review)
        await self._session.flush()
        return review
