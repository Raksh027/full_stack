from datetime import UTC, datetime
from uuid import UUID

from geoalchemy2.functions import ST_Distance, ST_DWithin, ST_X, ST_Y
from geoalchemy2.types import Geometry
from sqlalchemy import and_, case, cast, exists, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.country_iso import nationality_match_values
from app.models.orm import (
    DiscoveryImpression,
    Interest,
    Location,
    Preference,
    Profile,
    ProfileInterest,
    ProfileMedia,
    User,
    UserBlock,
    UserStatus,
)


class BlockRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, blocker_id: UUID, blocked_id: UUID) -> None:
        existing = await self._session.execute(
            select(UserBlock).where(
                UserBlock.blocker_id == blocker_id,
                UserBlock.blocked_id == blocked_id,
            )
        )
        if existing.scalar_one_or_none() is None:
            self._session.add(UserBlock(blocker_id=blocker_id, blocked_id=blocked_id))
            await self._session.flush()

    async def remove(self, blocker_id: UUID, blocked_id: UUID) -> None:
        result = await self._session.execute(
            select(UserBlock).where(
                UserBlock.blocker_id == blocker_id,
                UserBlock.blocked_id == blocked_id,
            )
        )
        row = result.scalar_one_or_none()
        if row is not None:
            await self._session.delete(row)
            await self._session.flush()

    async def list_blocked_ids(self, blocker_id: UUID) -> list[UUID]:
        result = await self._session.execute(
            select(UserBlock.blocked_id).where(UserBlock.blocker_id == blocker_id)
        )
        return list(result.scalars())

    async def excluded_user_ids(self, user_id: UUID) -> list[UUID]:
        blocked = select(UserBlock.blocked_id).where(UserBlock.blocker_id == user_id)
        blockers = select(UserBlock.blocker_id).where(UserBlock.blocked_id == user_id)
        result = await self._session.execute(blocked.union(blockers))
        return list(result.scalars())

    async def is_blocked_either_way(self, left: UUID, right: UUID) -> bool:
        result = await self._session.execute(
            select(UserBlock.id)
            .where(
                or_(
                    and_(UserBlock.blocker_id == left, UserBlock.blocked_id == right),
                    and_(UserBlock.blocker_id == right, UserBlock.blocked_id == left),
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None


class ImpressionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(self, viewer_id: UUID, viewed_ids: list[UUID]) -> None:
        now = datetime.now(UTC)
        for viewed_id in viewed_ids:
            if viewed_id == viewer_id:
                continue
            self._session.add(
                DiscoveryImpression(
                    viewer_id=viewer_id,
                    viewed_user_id=viewed_id,
                    created_at=now,
                )
            )
        await self._session.flush()

    async def recent_ids(self, viewer_id: UUID, since: datetime) -> list[UUID]:
        result = await self._session.execute(
            select(DiscoveryImpression.viewed_user_id).where(
                DiscoveryImpression.viewer_id == viewer_id,
                DiscoveryImpression.created_at >= since,
            )
        )
        return list(result.scalars())


class DiscoveryQueryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def feed_rows(
        self,
        *,
        viewer_id: UUID,
        origin,
        radius_m: float,
        oldest_birth,
        youngest_birth,
        genders: list[str] | None,
        orientations: list[str] | None,
        looking_for: str | None,
        viewer_gender: str | None,
        viewer_looking_for: str | None,
        verified_only: bool,
        city: str | None,
        nationality: str | None = None,
        interest_names: list[str],
        viewer_interest_ids: list[UUID],
        excluded_ids: list[UUID],
        cursor_score: int | None,
        cursor_user_id: UUID | None,
        limit: int,
        nearby_only: bool = True,
    ) -> list:
        distance_m = ST_Distance(Location.geog, origin) if origin is not None else literal(0)
        if viewer_interest_ids:
            overlap = (
                select(func.count())
                .select_from(ProfileInterest)
                .where(
                    ProfileInterest.profile_id == Profile.id,
                    ProfileInterest.interest_id.in_(viewer_interest_ids),
                )
                .correlate(Profile)
                .scalar_subquery()
            )
        else:
            overlap = literal(0)
        viewer_count = max(len(viewer_interest_ids), 1)
        interest_norm = func.least(overlap / float(viewer_count), 1.0)
        distance_norm = 1.0 - func.least(distance_m / float(radius_m), 1.0)
        has_bio = case((func.length(func.coalesce(Profile.bio, "")) > 0, 1.0), else_=0.0)
        has_orient = case((Profile.orientation.is_not(None), 1.0), else_=0.0)
        has_looking = case((Profile.looking_for.is_not(None), 1.0), else_=0.0)
        onboarded = case((User.onboarding_completed.is_(True), 1.0), else_=0.0)
        completeness = (has_bio + has_orient + has_looking + onboarded) / 4.0
        hours = func.extract("epoch", func.now() - User.last_active_at) / 3600.0
        activity = case(
            (User.last_active_at.is_(None), 0.1),
            (hours <= 1, 1.0),
            (hours <= 24, 0.6),
            (hours <= 168, 0.3),
            else_=0.1,
        )
        verified = case((Profile.verification_status == "VERIFIED", 1.0), else_=0.0)
        millipoints = (
            (
                0.30 * interest_norm
                + 0.25 * distance_norm
                + 0.20 * completeness
                + 0.15 * activity
                + 0.10 * verified
            )
            * 10000
        ).label("score")

        has_photo = exists(
            select(ProfileMedia.id).where(
                ProfileMedia.profile_id == Profile.id,
                ProfileMedia.deleted_at.is_(None),
            )
        )
        conditions = [
            User.id != viewer_id,
            User.status == UserStatus.ACTIVE.value,
            User.deleted_at.is_(None),
            Profile.visibility == "PUBLIC",
            Profile.display_name.is_not(None),
            Profile.birth_date.is_not(None),
            Profile.gender.is_not(None),
            Profile.birth_date > oldest_birth,
            Profile.birth_date <= youngest_birth,
            has_photo,
        ]
        if origin is not None and nearby_only:
            conditions.append(Location.geog.is_not(None))
            conditions.append(ST_DWithin(Location.geog, origin, radius_m))
        if genders:
            conditions.append(Profile.gender.in_(genders))
        if orientations:
            conditions.append(func.lower(Profile.orientation).in_([item.lower() for item in orientations]))
        if looking_for:
            conditions.append(Profile.looking_for == looking_for)
        if verified_only:
            conditions.append(Profile.verification_status == "VERIFIED")
        if city:
            conditions.append(Location.city.ilike(city.strip()))
        if nationality:
            aliases = nationality_match_values(nationality)
            if aliases:
                lowered = [item.lower() for item in aliases]
                conditions.append(
                    or_(
                        func.lower(Profile.nationality).in_(lowered),
                        func.lower(Location.country).in_(lowered),
                    )
                )
        if excluded_ids:
            conditions.append(User.id.notin_(excluded_ids))
        if viewer_gender:
            conditions.append(
                or_(
                    Preference.gender_filter.is_(None),
                    Preference.gender_filter == "Everyone",
                    Preference.gender_filter.in_(_filters_that_include(viewer_gender)),
                )
            )
        if viewer_looking_for:
            conditions.append(
                or_(
                    Preference.looking_for_filter.is_(None),
                    Preference.looking_for_filter == viewer_looking_for,
                )
            )
        if interest_names:
            conditions.append(
                exists(
                    select(ProfileInterest.profile_id).where(
                        ProfileInterest.profile_id == Profile.id,
                        ProfileInterest.interest_id.in_(
                            select(Interest.id).where(Interest.name.in_(interest_names))
                        ),
                    )
                )
            )
        if cursor_score is not None and cursor_user_id is not None:
            conditions.append(
                or_(
                    millipoints < cursor_score,
                    and_(millipoints == cursor_score, User.id > cursor_user_id),
                )
            )

        stmt = (
            select(
                User.id,
                Profile.display_name,
                Profile.bio,
                Profile.birth_date,
                Profile.gender,
                Profile.orientation,
                Profile.looking_for,
                Profile.verification_status,
                Location.city,
                Location.region,
                Location.country,
                Location.country_code,
                Location.country_flag,
                User.last_active_at,
                User.onboarding_completed,
                distance_m.label("distance_m"),
                ST_Y(cast(Location.geog, Geometry)).label("latitude"),
                ST_X(cast(Location.geog, Geometry)).label("longitude"),
                millipoints,
            )
            .select_from(User)
            .join(Profile, Profile.user_id == User.id)
            .outerjoin(Location, Location.user_id == User.id)
            .outerjoin(Preference, Preference.user_id == User.id)
            .where(*conditions)
            .order_by(millipoints.desc(), User.id.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.all())

    async def media_by_profile_users(self, user_ids: list[UUID]) -> dict[UUID, list]:
        if not user_ids:
            return {}
        result = await self._session.execute(
            select(Profile.user_id, ProfileMedia)
            .join(ProfileMedia, ProfileMedia.profile_id == Profile.id)
            .where(Profile.user_id.in_(user_ids), ProfileMedia.deleted_at.is_(None))
            .order_by(ProfileMedia.is_primary.desc(), ProfileMedia.sort_order)
        )
        grouped: dict[UUID, list] = {uid: [] for uid in user_ids}
        for user_id, media in result.all():
            grouped[user_id].append(media)
        return grouped

    async def interests_by_users(self, user_ids: list[UUID]) -> dict[UUID, list[str]]:
        if not user_ids:
            return {}
        result = await self._session.execute(
            select(Profile.user_id, Interest.name)
            .join(ProfileInterest, ProfileInterest.profile_id == Profile.id)
            .join(Interest, Interest.id == ProfileInterest.interest_id)
            .where(Profile.user_id.in_(user_ids))
        )
        grouped: dict[UUID, list[str]] = {uid: [] for uid in user_ids}
        for user_id, name in result.all():
            grouped[user_id].append(name)
        return grouped


def _filters_that_include(gender: str) -> list[str]:
    if gender == "Woman":
        return ["Women"]
    if gender == "Man":
        return ["Men"]
    if gender == "Non-Binary":
        return ["Non-binary", "Non-Binary"]
    return []
