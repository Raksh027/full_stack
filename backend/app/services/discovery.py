from __future__ import annotations

import hashlib
import logging
import math
import time
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from geoalchemy2.elements import WKTElement
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.discovery_rules import (
    audience_from_profile,
    birth_date_bounds,
    profile_genders_for_filter,
)
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.core.profile_rules import age_from_birth_date, format_location
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.core.security import decode_token
from app.models.orm import User
from app.repositories.discovery import (
    BlockRepository,
    DiscoveryQueryRepository,
    ImpressionRepository,
)
from app.repositories.profiles import ProfileQueryRepository
from app.schemas.discovery import DiscoveryQuery
from app.services.presenters import location_flag_fields

logger = logging.getLogger(__name__)


def _jitter_point(lat: float, lng: float, user_id: UUID) -> tuple[float, float]:
    digest = hashlib.sha256(str(user_id).encode("utf-8")).digest()
    angle = (digest[0] / 255.0) * 2 * math.pi
    meters = 50 + (digest[1] / 255.0) * 90
    d_lat = (meters * math.cos(angle)) / 111_320
    cos_lat = math.cos(math.radians(lat)) or 0.2
    d_lng = (meters * math.sin(angle)) / (111_320 * abs(cos_lat))
    return round(lat + d_lat, 6), round(lng + d_lng, 6)


class DiscoveryService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        request_id: str,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._request_id = request_id
        self._users = ProfileQueryRepository(session)
        self._query = DiscoveryQueryRepository(session)
        self._blocks = BlockRepository(session)
        self._impressions = ImpressionRepository(session)

    async def feed(self, viewer: User, query: DiscoveryQuery) -> dict[str, Any]:
        started = time.perf_counter()
        limit, window = RATE_LIMIT_POLICIES["discovery"]
        await self._limiter.hit(f"discovery:{viewer.id}", limit, window)
        bundle = await self._users.get_user_bundle(viewer.id)
        if bundle is None:
            raise NotFoundError("Profile not found.")
        viewer.last_active_at = datetime.now(UTC)
        await self._session.flush()

        origin = bundle.location.geog if bundle.location is not None else None
        if origin is None:
            logger.info(
                "discovery_global reason=no_location request_id=%s",
                self._request_id,
            )

        prefs = bundle.preferences
        min_age = query.min_age if query.min_age is not None else (prefs.min_age if prefs else 18)
        max_age = query.max_age if query.max_age is not None else (prefs.max_age if prefs else 40)
        if min_age > max_age:
            raise AppError("VALIDATION_ERROR", "minAge must be less than or equal to maxAge.", 422)
        audience = audience_from_profile(
            bundle.profile.gender if bundle.profile else None,
            bundle.profile.orientation if bundle.profile else None,
        )
        gender = (
            query.gender
            or audience.get("gender_filter")
            or (prefs.gender_filter if prefs else "Everyone")
        )
        looking_for = query.looking_for
        orientations = audience.get("orientations")
        radius_km = (
            query.max_distance_km
            if query.max_distance_km is not None
            else (prefs.max_distance_km if prefs else 50)
        )
        verified_only = (
            query.verified_only
            if query.verified_only is not None
            else bool(prefs and prefs.verified_only)
        )
        interest_names = []
        if query.interests:
            interest_names = [part.strip() for part in query.interests.split(",") if part.strip()]
        viewer_interest_ids = [
            link.interest_id for link in (bundle.profile.interests if bundle.profile else [])
        ]
        oldest, youngest = birth_date_bounds(min_age, max_age)
        genders = profile_genders_for_filter(gender)
        cursor_score, cursor_uid = self._decode_cursor(query.cursor, viewer.id)
        excluded = await self._blocks.excluded_user_ids(viewer.id)
        page_limit = min(query.limit, self._settings.discovery_page_size)
        worldwide = float(radius_km) >= 100
        feed_kwargs = dict(
            viewer_id=viewer.id,
            origin=origin,
            radius_m=float(radius_km) * 1000.0,
            oldest_birth=oldest,
            youngest_birth=youngest,
            genders=genders,
            orientations=list(orientations) if orientations else None,
            looking_for=looking_for,
            viewer_gender=bundle.profile.gender if bundle.profile else None,
            viewer_looking_for=None,
            verified_only=verified_only,
            city=query.city,
            nationality=query.nationality,
            interest_names=interest_names,
            viewer_interest_ids=viewer_interest_ids,
            excluded_ids=excluded,
            cursor_score=cursor_score,
            cursor_user_id=cursor_uid,
            limit=page_limit + 1,
        )
        rows = await self._query.feed_rows(
            **feed_kwargs,
            nearby_only=origin is not None and not worldwide,
        )
        if not rows and worldwide and origin is not None and cursor_uid is None:
            rows = await self._query.feed_rows(**feed_kwargs, nearby_only=False)
        has_more = len(rows) > page_limit
        rows = rows[:page_limit]
        user_ids = [row.id for row in rows]
        media_map = await self._query.media_by_profile_users(user_ids)
        interest_map = await self._query.interests_by_users(user_ids)
        items = [self._serialize_row(row, media_map, interest_map) for row in rows]
        next_cursor = None
        if has_more and rows:
            last = rows[-1]
            next_cursor = self._encode_cursor(viewer.id, int(last.score), last.id)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "discovery_feed request_id=%s count=%s has_more=%s duration_ms=%s",
            self._request_id,
            len(items),
            has_more,
            elapsed_ms,
        )
        await self._session.commit()
        return {"items": items, "nextCursor": next_cursor, "hasMore": has_more}

    async def map_feed(
        self,
        viewer: User,
        *,
        latitude: float,
        longitude: float,
        radius_km: float,
        cursor: str | None,
        limit: int,
    ) -> dict[str, Any]:
        """People around a map origin. Does not hide already-seen discovery cards."""
        started = time.perf_counter()
        limit_hits, window = RATE_LIMIT_POLICIES["discovery"]
        await self._limiter.hit(f"discovery:{viewer.id}", limit_hits, window)
        bundle = await self._users.get_user_bundle(viewer.id)
        if bundle is None:
            raise NotFoundError("Profile not found.")
        viewer.last_active_at = datetime.now(UTC)
        await self._session.flush()

        origin = WKTElement(f"POINT({longitude} {latitude})", srid=4326)
        prefs = bundle.preferences
        min_age = prefs.min_age if prefs else 18
        max_age = prefs.max_age if prefs else 40
        if min_age > max_age:
            raise AppError("VALIDATION_ERROR", "minAge must be less than or equal to maxAge.", 422)
        audience = audience_from_profile(
            bundle.profile.gender if bundle.profile else None,
            bundle.profile.orientation if bundle.profile else None,
        )
        gender = audience.get("gender_filter") or (prefs.gender_filter if prefs else "Everyone")
        looking_for = prefs.looking_for_filter if prefs else None
        orientations = audience.get("orientations")
        verified_only = bool(prefs and prefs.verified_only)
        viewer_interest_ids = [
            link.interest_id for link in (bundle.profile.interests if bundle.profile else [])
        ]
        oldest, youngest = birth_date_bounds(min_age, max_age)
        genders = profile_genders_for_filter(gender)
        cursor_score, cursor_uid = self._decode_cursor(cursor, viewer.id)
        excluded = await self._blocks.excluded_user_ids(viewer.id)
        page_limit = min(max(limit, 1), 50)
        rows = await self._query.feed_rows(
            viewer_id=viewer.id,
            origin=origin,
            radius_m=float(radius_km) * 1000.0,
            oldest_birth=oldest,
            youngest_birth=youngest,
            genders=genders,
            orientations=list(orientations) if orientations else None,
            looking_for=looking_for,
            viewer_gender=bundle.profile.gender if bundle.profile else None,
            viewer_looking_for=bundle.profile.looking_for if bundle.profile else None,
            verified_only=verified_only,
            city=None,
            interest_names=[],
            viewer_interest_ids=viewer_interest_ids,
            excluded_ids=excluded,
            cursor_score=cursor_score,
            cursor_user_id=cursor_uid,
            limit=page_limit + 1,
            nearby_only=True,
        )
        has_more = len(rows) > page_limit
        rows = rows[:page_limit]
        user_ids = [row.id for row in rows]
        media_map = await self._query.media_by_profile_users(user_ids)
        interest_map = await self._query.interests_by_users(user_ids)
        items = [self._serialize_row(row, media_map, interest_map) for row in rows]
        next_cursor = None
        if has_more and rows:
            last = rows[-1]
            next_cursor = self._encode_cursor(viewer.id, int(last.score), last.id)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "discovery_map request_id=%s count=%s has_more=%s duration_ms=%s",
            self._request_id,
            len(items),
            has_more,
            elapsed_ms,
        )
        await self._session.commit()
        return {"items": items, "nextCursor": next_cursor, "hasMore": has_more}

    async def record_impressions(self, viewer_id: UUID, user_ids: list[str]) -> dict[str, Any]:
        parsed: list[UUID] = []
        for value in user_ids:
            try:
                parsed.append(UUID(value))
            except ValueError as exc:
                raise AppError("VALIDATION_ERROR", "Invalid user id.", 422) from exc
        await self._impressions.record(viewer_id, parsed)
        await self._session.commit()
        return {"recorded": len(parsed)}

    async def block(self, viewer_id: UUID, target_id: str) -> dict[str, Any]:
        try:
            blocked_id = UUID(target_id)
        except ValueError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid user id.", 422) from exc
        if blocked_id == viewer_id:
            raise AppError("VALIDATION_ERROR", "You cannot block yourself.", 422)
        target = await self._users.get_user_bundle(blocked_id)
        if target is None:
            raise NotFoundError("User not found.")
        await self._blocks.add(viewer_id, blocked_id)
        from app.services.interactions import InteractionService

        interactions = InteractionService(
            session=self._session,
            settings=self._settings,
            limiter=self._limiter,
            request_id=self._request_id,
        )
        await interactions.apply_block(viewer_id, blocked_id)
        await self._session.commit()
        return {"blocked": True}

    async def unblock(self, viewer_id: UUID, target_id: str) -> dict[str, Any]:
        try:
            blocked_id = UUID(target_id)
        except ValueError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid user id.", 422) from exc
        await self._blocks.remove(viewer_id, blocked_id)
        await self._session.commit()
        return {"blocked": False}

    async def list_blocks(self, viewer_id: UUID) -> list[dict[str, Any]]:
        ids = await self._blocks.list_blocked_ids(viewer_id)
        items: list[dict[str, Any]] = []
        for user_id in ids:
            bundle = await self._users.get_user_bundle(user_id)
            if bundle is None or bundle.profile is None:
                continue
            from app.services.presenters import like_profile_from_user

            items.append(like_profile_from_user(bundle))
        return items

    def _serialize_row(self, row, media_map, interest_map) -> dict[str, Any]:
        media = media_map.get(row.id, [])
        photos = [item.url for item in media]
        age = age_from_birth_date(row.birth_date) if row.birth_date else 0
        distance_km = round(float(row.distance_m or 0) / 1000.0, 1)
        last_active = row.last_active_at
        recently = False
        if last_active is not None:
            if last_active.tzinfo is None:
                last_active = last_active.replace(tzinfo=UTC)
            recently = (datetime.now(UTC) - last_active) <= timedelta(minutes=20)
        return {
            "id": str(row.id),
            "name": row.display_name or "",
            "displayName": row.display_name,
            "age": age,
            "bio": row.bio or "",
            "gender": row.gender or "",
            "orientation": row.orientation or "",
            "sexualOrientation": row.orientation or None,
            "showOrientation": True,
            "relationshipGoal": row.looking_for or None,
            "lookingFor": row.looking_for or "",
            "languages": [],
            "workCategory": None,
            "lifestyle": {},
            "jobTitle": None,
            "company": None,
            "school": None,
            "heightCm": None,
            "commonInterests": [],
            "isNew": False,
            "interests": interest_map.get(row.id, []),
            "photos": [
                {"id": str(item.id), "url": item.url, "position": index}
                for index, item in enumerate(media)
            ],
            "photoUrls": photos,
            "media": [
                {
                    "id": str(item.id),
                    "url": item.url,
                    "sortOrder": item.sort_order,
                    "isPrimary": item.is_primary,
                }
                for item in media
            ],
            "location": format_location(row.city, row.country, row.region),
            "city": row.city,
            "country": row.country,
            **location_flag_fields(
                onboarding_completed=row.onboarding_completed,
                country=row.country,
                country_code=getattr(row, "country_code", None),
                country_flag=getattr(row, "country_flag", None),
            ),
            "distance": distance_km,
            "distanceKm": distance_km,
            **self._public_coordinates(row),
            "isVerified": row.verification_status == "VERIFIED",
            "verificationStatus": row.verification_status,
            "isOnline": recently,
            "isPremium": False,
            "lastSeen": last_active.isoformat() if last_active and not recently else None,
        }

    def _public_coordinates(self, row) -> dict[str, Any]:
        lat = getattr(row, "latitude", None)
        lng = getattr(row, "longitude", None)
        if lat is None or lng is None:
            return {}
        jitter_lat, jitter_lng = _jitter_point(float(lat), float(lng), row.id)
        return {"latitude": jitter_lat, "longitude": jitter_lng}

    def _encode_cursor(self, viewer_id: UUID, score: int, user_id: UUID) -> str:
        expires = datetime.now(UTC) + timedelta(seconds=self._settings.discovery_cursor_ttl_seconds)
        return jwt.encode(
            {
                "typ": "discovery",
                "sub": str(viewer_id),
                "s": score,
                "u": str(user_id),
                "exp": int(expires.timestamp()),
            },
            self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
        )

    def _decode_cursor(self, cursor: str | None, viewer_id: UUID) -> tuple[int | None, UUID | None]:
        if not cursor:
            return None, None
        try:
            payload = decode_token(self._settings, cursor)
        except ExpiredSignatureError as exc:
            raise AppError("VALIDATION_ERROR", "Discovery cursor expired.", 400) from exc
        except InvalidTokenError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid discovery cursor.", 400) from exc
        if payload.get("typ") != "discovery" or payload.get("sub") != str(viewer_id):
            raise ForbiddenError("Invalid discovery cursor.")
        try:
            return int(payload["s"]), UUID(str(payload["u"]))
        except (KeyError, ValueError) as exc:
            raise AppError("VALIDATION_ERROR", "Invalid discovery cursor.", 400) from exc
