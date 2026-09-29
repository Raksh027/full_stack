from __future__ import annotations

import json
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID, uuid4

import httpx

from geoalchemy2.elements import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.cache import CacheBackend
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.core.profile_rules import (
    GENDER_FILTERS,
    GENDERS,
    LOOKING_FOR,
    ONBOARDING_STEPS,
    ORIENTATIONS,
    VISIBILITY,
    age_from_birth_date,
    birth_date_from_age,
    format_location,
    parse_location_text,
    slugify,
)
from app.core.social_profile import allowed_avatar_url
from app.core.rate_limit import RATE_LIMIT_POLICIES, RateLimiter
from app.models.orm import AuditLog, Location, Preference, Profile, ProfileMedia, User
from app.repositories.interactions import LikeRepository
from app.repositories.profiles import (
    InterestCatalogRepository,
    LocationRepository,
    MediaRepository,
    PreferenceQueryRepository,
    ProfileInterestRepository,
    ProfileQueryRepository,
)
from app.repositories.users import AuditLogRepository, PreferenceRepository, ProfileRepository
from app.schemas.profile import (
    InterestsPut,
    LocationPatch,
    MediaCreate,
    MediaPatch,
    PreferencePut,
    ProfilePatch,
    UploadUrlRequest,
)
from app.services.storage import LocalStorageProvider, sniff_image_type


class ProfileService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        limiter: RateLimiter,
        cache: CacheBackend,
        storage: LocalStorageProvider,
        request_id: str,
        ip: str | None,
        user_agent: str | None,
        public_base: str,
    ) -> None:
        self._session = session
        self._settings = settings
        self._limiter = limiter
        self._cache = cache
        self._storage = storage
        self._request_id = request_id
        self._ip = ip
        self._user_agent = user_agent
        self._public_base = public_base
        self._users = ProfileQueryRepository(session)
        self._profiles = ProfileRepository(session)
        self._preferences = PreferenceRepository(session)
        self._pref_query = PreferenceQueryRepository(session)
        self._interests = InterestCatalogRepository(session)
        self._profile_interests = ProfileInterestRepository(session)
        self._locations = LocationRepository(session)
        self._media = MediaRepository(session)
        self._audit = AuditLogRepository(session)

    async def get_own(self, user_id: UUID) -> dict[str, Any]:
        user = await self._ensure_bundle(user_id)
        return self._serialize_own(user)

    async def get_public(self, viewer_id: UUID, target_id: UUID) -> dict[str, Any]:
        user = await self._users.get_user_bundle(target_id)
        if user is None or user.deleted_at is not None:
            raise NotFoundError("Profile not found.")
        profile = user.profile
        if profile is None:
            raise NotFoundError("Profile not found.")
        if viewer_id != target_id and profile.visibility == "HIDDEN":
            raise NotFoundError("Profile not found.")
        payload = self._serialize_public(user)
        liked = False
        if viewer_id != target_id:
            existing = await LikeRepository(self._session).get(viewer_id, target_id)
            liked = existing is not None
        payload["liked"] = liked
        return payload

    async def patch_own(self, user_id: UUID, body: ProfilePatch) -> dict[str, Any]:
        await self._hit_profile_limit(user_id)
        user = await self._ensure_bundle(user_id)
        profile = user.profile
        assert profile is not None
        if body.display_name or body.name:
            profile.display_name = (body.display_name or body.name or "").strip()[:80]
        if body.bio is not None:
            profile.bio = body.bio[:500]
        if body.birth_date:
            profile.birth_date = self._parse_birth_date(body.birth_date)
        elif body.age is not None:
            profile.birth_date = birth_date_from_age(body.age)
        if profile.birth_date is not None:
            self._assert_age_eligible(profile.birth_date)
        if body.gender is not None:
            profile.gender = self._enum(body.gender, GENDERS, "gender")
        if body.orientation is not None:
            profile.orientation = self._enum(body.orientation, ORIENTATIONS, "orientation")
        if body.looking_for is not None:
            profile.looking_for = self._enum(body.looking_for, LOOKING_FOR, "lookingFor")
        if body.visibility is not None:
            profile.visibility = self._enum(body.visibility.upper(), VISIBILITY, "visibility")
        if body.location:
            city, country = parse_location_text(body.location)
            await self._upsert_location(user, city=city, country=country)
        if body.onboarding_step and body.onboarding_step in ONBOARDING_STEPS:
            user.onboarding_step = body.onboarding_step
        self._refresh_onboarding(user)
        await self._write_audit(user.id, "PROFILE_UPDATED")
        await self._session.commit()
        self._session.expire_all()
        return await self.get_own(user_id)

    async def get_preferences(self, user_id: UUID) -> dict[str, Any]:
        user = await self._ensure_bundle(user_id)
        return self._serialize_prefs(user.preferences)

    async def put_preferences(self, user_id: UUID, body: PreferencePut) -> dict[str, Any]:
        await self._hit_profile_limit(user_id)
        gender = body.gender
        if gender not in GENDER_FILTERS:
            raise AppError("VALIDATION_ERROR", "Invalid preferred gender.", 422)
        if body.orientation and body.orientation not in ORIENTATIONS:
            raise AppError("VALIDATION_ERROR", "Invalid preferred orientation.", 422)
        if body.looking_for and body.looking_for not in LOOKING_FOR:
            raise AppError("VALIDATION_ERROR", "Invalid looking-for preference.", 422)
        user = await self._ensure_bundle(user_id)
        prefs = user.preferences
        assert prefs is not None
        prefs.min_age = body.min_age
        prefs.max_age = body.max_age
        prefs.max_distance_km = body.max_distance_km
        prefs.gender_filter = gender
        prefs.orientation_filter = body.orientation
        prefs.looking_for_filter = body.looking_for
        prefs.verified_only = body.verified_only
        await self._write_audit(user_id, "PREFERENCES_UPDATED")
        await self._session.commit()
        return self._serialize_prefs(prefs)

    async def list_interests(self) -> list[dict[str, Any]]:
        cached = await self._cache.get("catalog:interests")
        if cached:
            return json.loads(cached)
        items = await self._interests.list_all()
        payload = [{"id": str(item.id), "name": item.name, "slug": item.slug} for item in items]
        await self._cache.set("catalog:interests", json.dumps(payload), ex=3600)
        return payload

    async def put_interests(self, user_id: UUID, body: InterestsPut) -> dict[str, Any]:
        await self._hit_profile_limit(user_id)
        user = await self._ensure_bundle(user_id)
        profile = user.profile
        assert profile is not None
        names = body.names or body.interests or []
        found: list = []
        if body.interest_ids:
            ids = [UUID(value) for value in body.interest_ids]
            found = await self._interests.get_by_ids(ids)
            if len(found) != len(set(ids)):
                raise AppError("VALIDATION_ERROR", "One or more interests are invalid.", 422)
        elif names:
            found = await self._interests.get_by_slugs_or_names(names)
            if len(found) != len({slugify(name) for name in names}):
                raise AppError("VALIDATION_ERROR", "One or more interests are invalid.", 422)
        await self._profile_interests.replace(profile.id, [item.id for item in found])
        if found and user.onboarding_step in {"gender", "orientation", "looking_for", "interests"}:
            user.onboarding_step = "photos"
        self._refresh_onboarding(user)
        await self._write_audit(user_id, "PROFILE_UPDATED", {"interests": len(found)})
        await self._session.commit()
        self._session.expire_all()
        return await self.get_own(user_id)

    async def patch_location(self, user_id: UUID, body: LocationPatch) -> dict[str, Any]:
        user = await self._ensure_bundle(user_id)
        city, country = body.city, body.country
        if body.location and not city:
            city, country = parse_location_text(body.location)
        await self._upsert_location(
            user,
            city=city,
            locality=body.locality,
            district=body.district,
            country=country,
            region=body.region,
            country_code=body.country_code,
            country_flag=body.country_flag,
            latitude=body.latitude,
            longitude=body.longitude,
        )
        self._refresh_onboarding(user)
        await self._write_audit(user_id, "LOCATION_UPDATED")
        await self._session.commit()
        loc = user.location
        from app.services.presenters import location_flag_fields

        flags = location_flag_fields(user)
        from app.core.profile_rules import place_name

        return {
            "locality": loc.locality if loc else None,
            "city": loc.city if loc else None,
            "district": loc.district if loc else None,
            "region": loc.region if loc else None,
            "country": loc.country if loc else None,
            "place": place_name(
                loc.locality if loc else None,
                loc.city if loc else None,
                loc.district if loc else None,
                loc.region if loc else None,
                loc.country if loc else None,
            ),
            "countryCode": flags.get("countryCode") or (loc.country_code if loc else None),
            "countryFlag": flags.get("countryFlag") or (loc.country_flag if loc else None),
            "location": format_location(
                loc.city if loc else None,
                loc.country if loc else None,
                loc.region if loc else None,
            ),
            "hasCoordinates": bool(loc and loc.geog is not None),
            "updatedAt": (
                loc.location_updated_at.isoformat() if loc and loc.location_updated_at else None
            ),
        }

    async def completion(self, user_id: UUID) -> dict[str, Any]:
        user = await self._ensure_bundle(user_id)
        return self._completion(user)

    async def create_upload_url(self, user_id: UUID, body: UploadUrlRequest) -> dict[str, Any]:
        await self._hit_profile_limit(user_id)
        user = await self._ensure_bundle(user_id)
        profile = user.profile
        assert profile is not None
        active = [m for m in (profile.media or []) if m.deleted_at is None]
        if len(active) >= self._settings.media_max_items:
            raise AppError("PROFILE_MEDIA_LIMIT", "Maximum number of photos reached.", 409)
        return await self._storage.create_upload_target(
            user_id, body.content_type, body.filename, body.byte_size
        )

    async def add_media(self, user_id: UUID, body: MediaCreate) -> dict[str, Any]:
        await self._hit_profile_limit(user_id)
        if not body.storage_key.startswith(f"{user_id}/"):
            raise ForbiddenError("This upload does not belong to the current user.")
        if "/verification/" in body.storage_key.replace("\\", "/"):
            raise ForbiddenError("Verification media cannot be attached to a profile.")
        if not await self._storage.object_exists(body.storage_key):
            raise AppError("PROFILE_MEDIA_INVALID", "Uploaded object was not found.", 400)
        existing = await self._media.get_by_storage_key(body.storage_key)
        if existing and existing.deleted_at is None:
            raise AppError("CONFLICT", "This media is already attached.", 409)
        data = await self._storage.read_bytes(body.storage_key)
        sniffed = sniff_image_type(data)
        if sniffed is None:
            raise AppError("PROFILE_MEDIA_INVALID", "File is not a supported image.", 422)
        user = await self._ensure_bundle(user_id)
        profile = user.profile
        assert profile is not None
        active = [m for m in profile.media if m.deleted_at is None]
        if len(active) >= self._settings.media_max_items:
            raise AppError("PROFILE_MEDIA_LIMIT", "Maximum number of photos reached.", 409)
        is_primary = body.is_primary or not active
        if is_primary:
            for item in active:
                item.is_primary = False
        media = ProfileMedia(
            profile_id=profile.id,
            url=self._storage.public_url(body.storage_key, self._public_base),
            storage_key=body.storage_key,
            media_type="image",
            sort_order=body.sort_order,
            is_primary=is_primary,
            moderation_status="APPROVED",
        )
        await self._media.add(media)
        if user.onboarding_step in {"photos"}:
            user.onboarding_step = "details"
        self._refresh_onboarding(user)
        payload = self._serialize_media(media, include_key=True)
        await self._write_audit(user_id, "PROFILE_MEDIA_ADDED")
        await self._session.commit()
        return payload

    async def import_remote_avatar(self, user_id: UUID, url: str) -> bool:
        """Save a provider profile photo when the account has no photos yet."""
        if not allowed_avatar_url(url):
            return False
        user = await self._ensure_bundle(user_id)
        profile = user.profile
        assert profile is not None
        active = [item for item in profile.media if item.deleted_at is None]
        if active:
            return False
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            response = await client.get(url)
        final_url = str(response.url)
        if response.status_code != 200 or not allowed_avatar_url(final_url):
            return False
        data = response.content
        sniffed = sniff_image_type(data)
        if sniffed is None or len(data) > self._settings.media_max_bytes:
            return False
        suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[sniffed]
        storage_key = f"{user_id}/{uuid4()}{suffix}"
        await self._storage.save_bytes(storage_key, data, sniffed)
        await self.add_media(
            user_id,
            MediaCreate(storageKey=storage_key, sortOrder=0, isPrimary=True),
        )
        return True

    async def patch_media(self, user_id: UUID, media_id: UUID, body: MediaPatch) -> dict[str, Any]:
        await self._hit_profile_limit(user_id)
        user = await self._ensure_bundle(user_id)
        media = await self._owned_media(user, media_id)
        if body.sort_order is not None:
            media.sort_order = body.sort_order
        if body.is_primary is True:
            for item in user.profile.media:
                if item.deleted_at is None:
                    item.is_primary = item.id == media.id
        payload = self._serialize_media(media, include_key=True)
        await self._session.commit()
        return payload

    async def delete_media(self, user_id: UUID, media_id: UUID) -> dict[str, Any]:
        await self._hit_profile_limit(user_id)
        user = await self._ensure_bundle(user_id)
        media = await self._owned_media(user, media_id)
        was_primary = media.is_primary
        await self._media.soft_delete(media)
        remaining = [item for item in user.profile.media if item.deleted_at is None]
        if was_primary and remaining:
            remaining.sort(key=lambda item: (item.sort_order, item.created_at))
            remaining[0].is_primary = True
        await self._write_audit(user_id, "PROFILE_MEDIA_DELETED")
        await self._session.commit()
        return {"deleted": True}

    async def purge_user_files(self, user_id: UUID) -> None:
        await self._storage.delete_user_prefix(user_id)

    async def _owned_media(self, user: User, media_id: UUID) -> ProfileMedia:
        assert user.profile is not None
        media = await self._media.get(media_id)
        if media is None or media.deleted_at is not None:
            raise NotFoundError("Media not found.")
        if media.profile_id != user.profile.id:
            raise ForbiddenError("You cannot modify another user's media.")
        return media

    async def _ensure_bundle(self, user_id: UUID) -> User:
        user = await self._users.get_user_bundle(user_id)
        if user is None:
            raise NotFoundError("Profile not found.")
        created = False
        if user.profile is None:
            await self._profiles.add(Profile(user_id=user.id))
            created = True
        if user.preferences is None:
            await self._preferences.add(Preference(user_id=user.id))
        if created:
            await self._write_audit(user.id, "PROFILE_CREATED")
            await self._session.commit()
            user = await self._users.get_user_bundle(user_id)
            assert user is not None
        return user

    async def _upsert_location(
        self,
        user: User,
        *,
        city: str | None = None,
        locality: str | None = None,
        district: str | None = None,
        country: str | None = None,
        region: str | None = None,
        country_code: str | None = None,
        country_flag: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> None:
        from sqlalchemy.exc import IntegrityError

        from app.core.mobile_maps import resolve_country_visual

        loc = user.location or await self._locations.get_by_user_id(user.id)
        if loc is None:
            loc = Location(user_id=user.id)
            try:
                async with self._session.begin_nested():
                    await self._locations.add(loc)
            except IntegrityError:
                loc = await self._locations.get_by_user_id(user.id)
                if loc is None:
                    raise
        user.location = loc
        if city is not None:
            loc.city = city
        if locality is not None:
            loc.locality = locality
        if district is not None:
            loc.district = district
        if country is not None:
            loc.country = country
        if region is not None:
            loc.region = region
        if country is not None or country_code is not None or country_flag is not None:
            _emoji, code, flag = resolve_country_visual(
                loc.country,
                country_code if country_code is not None else loc.country_code,
                country_flag if country_flag is not None else loc.country_flag,
            )
            loc.country_code = code or None
            loc.country_flag = flag or None
        if latitude is not None and longitude is not None:
            loc.geog = WKTElement(f"POINT({longitude} {latitude})", srid=4326)
        loc.location_updated_at = datetime.now(UTC)

    def _refresh_onboarding(self, user: User) -> None:
        completion = self._completion(user)
        if completion["percent"] >= 100:
            user.onboarding_completed = True
            user.onboarding_step = "completed"

    def _completion(self, user: User) -> dict[str, Any]:
        profile = user.profile
        loc = user.location
        media = [item for item in (profile.media if profile else []) if item.deleted_at is None]
        interests = list(profile.interests) if profile else []
        checks = {
            "basic": bool(profile and profile.display_name),
            "bio": bool(profile and profile.bio),
            "identity": bool(
                profile and profile.gender and profile.orientation and profile.looking_for
            ),
            "age": bool(profile and profile.birth_date),
            "interests": len(interests) >= 3,
            "preferences": user.preferences is not None,
            "location": bool(loc and (loc.city or loc.geog is not None)),
            "media": len(media) >= 2,
        }
        total = len(checks)
        done = sum(1 for value in checks.values() if value)
        missing = [key for key, value in checks.items() if not value]
        return {
            "percent": int(round((done / total) * 100)) if total else 0,
            "missing": missing,
            "components": checks,
            "onboardingCompleted": user.onboarding_completed,
            "onboardingStep": user.onboarding_step,
        }

    def _serialize_own(self, user: User) -> dict[str, Any]:
        payload = self._serialize_public(user)
        profile = user.profile
        completion = self._completion(user)
        payload.update(
            {
                "onboardingCompleted": user.onboarding_completed,
                "onboardingStep": user.onboarding_step,
                "completionPercent": completion["percent"],
                "completeness": completion["percent"],
                "birthDate": profile.birth_date.isoformat() if profile and profile.birth_date else None,
                "completion": completion,
                "visibility": profile.visibility if profile else "PUBLIC",
                "preferences": self._serialize_prefs(user.preferences),
                "hasCoordinates": bool(user.location and user.location.geog is not None),
            }
        )
        return payload

    def _serialize_public(self, user: User) -> dict[str, Any]:
        from app.services.presenters import profile_from_user

        profile = user.profile
        loc = user.location
        media = [
            self._serialize_media(item, include_key=False)
            for item in sorted(
                (item for item in (profile.media if profile else []) if item.deleted_at is None),
                key=lambda item: (not item.is_primary, item.sort_order, item.created_at),
            )
        ]
        payload = profile_from_user(user)
        payload.update(
            {
                "displayName": profile.display_name if profile else None,
                "orientation": payload.get("sexualOrientation") or "",
                "lookingFor": payload.get("relationshipGoal") or "",
                "photoUrls": [item["url"] for item in payload.get("photos") or []],
                "media": media,
                "location": format_location(
                    loc.city if loc else None,
                    loc.country if loc else None,
                    loc.region if loc else None,
                ),
                "region": loc.region if loc else None,
                "distance": 0,
                "verificationStatus": profile.verification_status if profile else "UNVERIFIED",
                "isPremium": False,
                "lastSeen": user.last_active_at.isoformat() if user.last_active_at else None,
            }
        )
        return payload

    def _serialize_media(self, media: ProfileMedia, include_key: bool = False) -> dict[str, Any]:
        payload = {
            "id": str(media.id),
            "url": media.url,
            "mediaType": media.media_type,
            "sortOrder": media.sort_order,
            "isPrimary": media.is_primary,
            "moderationStatus": media.moderation_status,
        }
        if include_key:
            payload["storageKey"] = media.storage_key
        return payload

    def _serialize_prefs(self, prefs: Preference | None) -> dict[str, Any]:
        if prefs is None:
            return {
                "minAge": 18,
                "maxAge": 40,
                "maxDistanceKm": 50,
                "gender": "Everyone",
                "verifiedOnly": False,
                "interests": [],
            }
        return {
            "minAge": prefs.min_age,
            "maxAge": prefs.max_age,
            "maxDistanceKm": prefs.max_distance_km,
            "gender": prefs.gender_filter,
            "orientation": prefs.orientation_filter,
            "lookingFor": prefs.looking_for_filter,
            "verifiedOnly": prefs.verified_only,
            "interests": [],
        }

    def _parse_birth_date(self, value: str) -> date:
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise AppError("VALIDATION_ERROR", "Invalid date of birth.", 422) from exc
        self._assert_age_eligible(parsed)
        return parsed

    def _assert_age_eligible(self, birth_date: date) -> None:
        age = age_from_birth_date(birth_date)
        if age < self._settings.min_dating_age:
            raise AppError(
                "AGE_RESTRICTED",
                "You must be 18 or older to use dating features.",
                403,
            )
        if age > self._settings.max_dating_age:
            raise AppError("VALIDATION_ERROR", "Age is outside the allowed range.", 422)

    def _enum(self, value: str, allowed: frozenset[str], field: str) -> str:
        if value not in allowed:
            raise AppError("VALIDATION_ERROR", f"Invalid {field}.", 422)
        return value

    async def _hit_profile_limit(self, user_id: UUID) -> None:
        limit, window = RATE_LIMIT_POLICIES["profile_changes"]
        await self._limiter.hit(f"profile:{user_id}", limit, window)

    async def _write_audit(
        self, user_id: UUID | None, action: str, metadata: dict | None = None
    ) -> None:
        await self._audit.add(
            AuditLog(
                user_id=user_id,
                action=action,
                ip_address=self._ip,
                user_agent=self._user_agent,
                request_id=self._request_id,
                metadata_json=metadata,
            )
        )
