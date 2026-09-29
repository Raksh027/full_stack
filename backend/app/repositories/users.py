from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Preference, Profile, Session, User, UserAuth


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(User).join(UserAuth).where(UserAuth.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def add(self, user: User) -> User:
        self._session.add(user)
        await self._session.flush()
        return user


class UserAuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> UserAuth | None:
        result = await self._session.execute(
            select(UserAuth).where(UserAuth.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def add(self, auth: UserAuth) -> UserAuth:
        self._session.add(auth)
        await self._session.flush()
        return auth


class SessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, item: Session) -> Session:
        self._session.add(item)
        await self._session.flush()
        return item

    async def get_by_refresh_hash(self, token_hash: str) -> Session | None:
        result = await self._session.execute(
            select(Session).where(Session.refresh_token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, session_id: UUID) -> Session | None:
        return await self._session.get(Session, session_id)

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        result = await self._session.execute(select(Session).where(Session.user_id == user_id))
        now = datetime.now(UTC)
        for item in result.scalars():
            if item.revoked_at is None:
                item.revoked_at = now

    async def revoke_family(self, family_id: UUID) -> None:
        result = await self._session.execute(select(Session).where(Session.family_id == family_id))
        now = datetime.now(UTC)
        for item in result.scalars():
            if item.revoked_at is None:
                item.revoked_at = now


class ProfileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, profile: Profile) -> Profile:
        self._session.add(profile)
        await self._session.flush()
        return profile

    async def get_by_user_id(self, user_id: UUID) -> Profile | None:
        result = await self._session.execute(select(Profile).where(Profile.user_id == user_id))
        return result.scalar_one_or_none()


class PreferenceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, preference: Preference) -> Preference:
        self._session.add(preference)
        await self._session.flush()
        return preference


class AuditLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, log) -> None:
        self._session.add(log)
        await self._session.flush()
