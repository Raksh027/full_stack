from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.orm import (
    Interest,
    Location,
    Preference,
    Profile,
    ProfileInterest,
    ProfileMedia,
    User,
)


class ProfileQueryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_user_bundle(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(User)
            .options(
                selectinload(User.profile).selectinload(Profile.media),
                selectinload(User.profile)
                .selectinload(Profile.interests)
                .selectinload(ProfileInterest.interest),
                selectinload(User.preferences),
                selectinload(User.location),
                selectinload(User.auth),
            )
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_user_bundles(self, user_ids: list[UUID]) -> dict[UUID, User]:
        unique_ids = list(dict.fromkeys(user_ids))
        if not unique_ids:
            return {}
        result = await self._session.execute(
            select(User)
            .options(
                selectinload(User.profile).selectinload(Profile.media),
                selectinload(User.profile)
                .selectinload(Profile.interests)
                .selectinload(ProfileInterest.interest),
                selectinload(User.preferences),
                selectinload(User.location),
                selectinload(User.auth),
            )
            .where(User.id.in_(unique_ids))
        )
        return {user.id: user for user in result.scalars().unique()}

    async def get_profile(self, user_id: UUID) -> Profile | None:
        result = await self._session.execute(select(Profile).where(Profile.user_id == user_id))
        return result.scalar_one_or_none()


class InterestCatalogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self) -> list[Interest]:
        result = await self._session.execute(select(Interest).order_by(Interest.name))
        return list(result.scalars())

    async def get_by_ids(self, ids: list[UUID]) -> list[Interest]:
        if not ids:
            return []
        result = await self._session.execute(select(Interest).where(Interest.id.in_(ids)))
        return list(result.scalars())

    async def get_by_slugs_or_names(self, values: list[str]) -> list[Interest]:
        lowered = [value.strip().lower() for value in values if value.strip()]
        if not lowered:
            return []
        result = await self._session.execute(
            select(Interest).where(Interest.slug.in_(lowered) | Interest.name.in_(values))
        )
        return list(result.scalars())


class ProfileInterestRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def replace(self, profile_id: UUID, interest_ids: list[UUID]) -> None:
        existing = await self._session.execute(
            select(ProfileInterest).where(ProfileInterest.profile_id == profile_id)
        )
        for row in existing.scalars():
            await self._session.delete(row)
        await self._session.flush()
        seen: set[UUID] = set()
        for interest_id in interest_ids:
            if interest_id in seen:
                continue
            seen.add(interest_id)
            self._session.add(ProfileInterest(profile_id=profile_id, interest_id=interest_id))
        await self._session.flush()


class LocationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_user_id(self, user_id: UUID) -> Location | None:
        result = await self._session.execute(select(Location).where(Location.user_id == user_id))
        return result.scalar_one_or_none()

    async def add(self, location: Location) -> Location:
        self._session.add(location)
        await self._session.flush()
        return location


class PreferenceQueryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_user_id(self, user_id: UUID) -> Preference | None:
        result = await self._session.execute(
            select(Preference).where(Preference.user_id == user_id)
        )
        return result.scalar_one_or_none()


class MediaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_active(self, profile_id: UUID) -> list[ProfileMedia]:
        result = await self._session.execute(
            select(ProfileMedia)
            .where(ProfileMedia.profile_id == profile_id, ProfileMedia.deleted_at.is_(None))
            .order_by(ProfileMedia.sort_order, ProfileMedia.created_at)
        )
        return list(result.scalars())

    async def get(self, media_id: UUID) -> ProfileMedia | None:
        return await self._session.get(ProfileMedia, media_id)

    async def get_by_storage_key(self, storage_key: str) -> ProfileMedia | None:
        result = await self._session.execute(
            select(ProfileMedia).where(ProfileMedia.storage_key == storage_key)
        )
        return result.scalar_one_or_none()

    async def add(self, media: ProfileMedia) -> ProfileMedia:
        self._session.add(media)
        await self._session.flush()
        return media

    async def soft_delete(self, media: ProfileMedia) -> None:
        media.deleted_at = datetime.now(UTC)
        media.is_primary = False
        await self._session.flush()
