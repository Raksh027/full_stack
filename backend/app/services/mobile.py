from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import httpx
from geoalchemy2.functions import ST_Distance
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.cache import CacheBackend
from app.core.discovery_rules import audience_from_profile
from app.core.entitlements import EntitlementService
from app.core.errors import AppError, ConflictError, NotFoundError, UnauthorizedError
from app.core.paging import page_items, parse_offset_cursor
from app.core.mobile_maps import (
    REPORT_REASONS,
    country_flag,
    resolve_country_visual,
    gender_to_app,
    gender_to_store,
    genders_for_filter,
    goal_to_store,
    height_label,
    orientation_to_app,
    travel_tags_for,
)
from app.core.tonight_rules import (
    default_looking_for,
    normalize_tonight_activity,
    stored_activity_values,
)
from app.core.travel_rules import (
    arriving_in_viewer_place,
    iso_travel_date,
    journey_status,
    normalize_companion,
    normalize_hide_from,
    normalize_travel_style,
    normalize_trip_type,
    parse_travel_date,
    passes_creation_filters,
    require_journey_fields,
    usable_cover,
    usable_photo,
    viewer_home_names,
)
from app.core.profile_rules import age_from_birth_date, slugify, zodiac_from_birth_date
from app.core.account_delete import normalize_delete_reason
from app.core.social_auth import social_email
from app.core.social_profile import (
    allowed_avatar_url,
    birth_date_iso,
    display_name,
    facebook_picture_url,
    google_people_fields,
    map_provider_gender,
)
from app.models.orm import (
    AuditLog,
    DiscoverySwipe,
    EntitlementCode,
    Interest,
    Like,
    Location,
    ProfileView,
    TonightPost,
    TravelJourney,
    User,
    UserAuth,
)
from app.repositories.profiles import InterestCatalogRepository, ProfileQueryRepository
from app.schemas.profile import InterestsPut, LocationPatch, MediaCreate, ProfilePatch, UploadUrlRequest
from app.schemas.reports import ReportCreate
from app.schemas.subscriptions import PurchaseProof, RazorpayVerifyBody
from app.services.auth import AuthService
from app.services.chat import ChatService
from app.services.discovery import DiscoveryService
from app.services.interactions import InteractionService
from app.services.notifications import NotificationService
from app.services.presenters import (
    apply_orientation_audience,
    default_discovery_preferences,
    default_notification_settings,
    passes_tonight_audience,
    passes_viewer_filters,
    like_profile_from_user,
    match_user_from_user,
    message_to_app,
    profile_from_user,
)
from app.services.profile import ProfileService
from app.services.reports import ReportService
from app.services.subscriptions import SubscriptionService

logger = logging.getLogger(__name__)


def _journey_country_flag(body: dict[str, Any], side: str) -> tuple[str, str]:
    name_key = "fromCountry" if side == "from" else "toCountry"
    code_key = "fromCountryCode" if side == "from" else "toCountryCode"
    flag_key = "fromCountryFlag" if side == "from" else "toCountryFlag"
    _emoji, code, flag = resolve_country_visual(
        body.get(name_key),
        body.get(code_key),
        body.get(flag_key),
    )
    return code, flag


class MobileService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        cache: CacheBackend,
        auth: AuthService,
        profiles: ProfileService,
        discovery: DiscoveryService,
        interactions: InteractionService,
        chat: ChatService,
        notifications: NotificationService,
        reports: ReportService | None = None,
        subscriptions: SubscriptionService | None = None,
        request_base: str = "",
    ) -> None:
        self._session = session
        self._settings = settings
        self._cache = cache
        self.auth = auth
        self.profiles = profiles
        self.discovery = discovery
        self.interactions = interactions
        self.chat = chat
        self.notifications = notifications
        self.reports = reports
        self.subscriptions = subscriptions
        self._request_base = request_base.rstrip("/")
        self._users = ProfileQueryRepository(session)
        self._interests = InterestCatalogRepository(session)
        self._entitlements = EntitlementService(session)

    async def session_user(self, user_id: UUID) -> dict[str, Any]:
        public = await self.auth.me(user_id)
        payload = public.model_dump(by_alias=True)
        user = await self._users.get_user_bundle(user_id)
        provider = "email"
        if user and user.auth and getattr(user.auth, "provider", None):
            provider = user.auth.provider
        premium = await self._entitlements.has(user_id, EntitlementCode.PREMIUM.value)
        return {
            **payload,
            "provider": provider if provider in {"email", "google", "apple", "facebook"} else "email",
            "isOnboarded": bool(user.onboarding_completed) if user else False,
            "isPremium": premium,
            "isEmailVerified": bool(payload.get("emailVerified")),
        }

    EMAIL_CHANGE_DAYS = 30

    def _email_change_pending_key(self, user_id: UUID) -> str:
        return f"email-change:{user_id}"

    def _email_change_lock(self, auth: UserAuth) -> dict[str, Any]:
        now = datetime.now(UTC)
        changed_at = auth.email_changed_at
        if changed_at is None:
            return {
                "canChange": True,
                "nextChangeAt": None,
                "daysRemaining": 0,
                "cooldownDays": self.EMAIL_CHANGE_DAYS,
            }
        if changed_at.tzinfo is None:
            changed_at = changed_at.replace(tzinfo=UTC)
        next_at = changed_at + timedelta(days=self.EMAIL_CHANGE_DAYS)
        remaining_s = int((next_at - now).total_seconds())
        if remaining_s <= 0:
            return {
                "canChange": True,
                "nextChangeAt": next_at.isoformat(),
                "daysRemaining": 0,
                "cooldownDays": self.EMAIL_CHANGE_DAYS,
            }
        days = max(1, (remaining_s + 86_399) // 86_400)
        return {
            "canChange": False,
            "nextChangeAt": next_at.isoformat(),
            "daysRemaining": days,
            "cooldownDays": self.EMAIL_CHANGE_DAYS,
        }

    async def email_change_status(self, user: User) -> dict[str, Any]:
        bundle = await self._users.get_user_bundle(user.id)
        if bundle is None or bundle.auth is None:
            raise AppError("AUTH_REQUIRED", "Account email is not available.", 400)
        lock = self._email_change_lock(bundle.auth)
        return {
            "email": bundle.auth.email,
            **lock,
        }

    async def request_email_change(self, user: User, email: str) -> dict[str, Any]:
        bundle = await self._users.get_user_bundle(user.id)
        if bundle is None or bundle.auth is None:
            raise AppError("AUTH_REQUIRED", "Account email is not available.", 400)
        auth = bundle.auth
        lock = self._email_change_lock(auth)
        if not lock["canChange"]:
            days = lock["daysRemaining"]
            raise AppError(
                "EMAIL_CHANGE_LOCKED",
                f"You can change your email again in {days} day{'s' if days != 1 else ''}.",
                429,
            )
        next_email = email.strip().lower()
        current = (auth.email or "").strip().lower()
        if next_email == current:
            raise AppError(
                "EMAIL_UNCHANGED",
                "That is already your current email.",
                400,
            )
        taken = await self.auth._auths.get_by_email(next_email)
        if taken is not None and taken.user_id != user.id:
            raise ConflictError(
                "EMAIL_TAKEN",
                "This email is already used by another account.",
            )
        await self.auth._otp.issue(next_email, "email_change")
        await self._cache.set(
            self._email_change_pending_key(user.id),
            next_email,
            ex=self._settings.otp_expire_seconds,
        )
        return {"otpSent": True, "email": next_email}

    async def verify_email_change(self, user: User, email: str, code: str) -> dict[str, Any]:
        bundle = await self._users.get_user_bundle(user.id)
        if bundle is None or bundle.auth is None:
            raise AppError("AUTH_REQUIRED", "Account email is not available.", 400)
        auth = bundle.auth
        lock = self._email_change_lock(auth)
        if not lock["canChange"]:
            days = lock["daysRemaining"]
            raise AppError(
                "EMAIL_CHANGE_LOCKED",
                f"You can change your email again in {days} day{'s' if days != 1 else ''}.",
                429,
            )
        next_email = email.strip().lower()
        pending = await self._cache.get(self._email_change_pending_key(user.id))
        if pending is None or pending.strip().lower() != next_email:
            raise AppError(
                "EMAIL_CHANGE_NOT_REQUESTED",
                "Request a new OTP for this email first.",
                400,
            )
        await self.auth._otp.verify(next_email, "email_change", code)
        taken = await self.auth._auths.get_by_email(next_email)
        if taken is not None and taken.user_id != user.id:
            raise ConflictError(
                "EMAIL_TAKEN",
                "This email is already used by another account.",
            )
        previous = auth.email
        now = datetime.now(UTC)
        auth.email = next_email
        auth.email_verified_at = now
        auth.email_changed_at = now
        await self._session.commit()
        await self._cache.delete(self._email_change_pending_key(user.id))
        if previous:
            await self.auth._otp.clear_destination(previous)
        await self.auth._otp.clear_destination(next_email)
        return await self.session_user(user.id)

    async def auth_response(self, tokens, *, is_new_user: bool = False) -> dict[str, Any]:
        pair = tokens.model_dump(by_alias=True) if hasattr(tokens, "model_dump") else tokens
        user = await self.session_user(UUID(str(pair["userId"])))
        return {
            **pair,
            "tokens": {
                "accessToken": pair["accessToken"],
                "refreshToken": pair["refreshToken"],
            },
            "user": user,
            "isNewUser": is_new_user,
        }

    async def request_login_otp(self, email: str) -> dict[str, Any]:
        existing = await self.auth._auths.get_by_email(email)
        if existing is None:
            await self.auth.register(email, uuid4().hex + "Aa1!")
            return {}
        purpose = "signup" if existing.email_verified_at is None else "login"
        if purpose == "login":
            await self.auth._otp.issue(email.lower(), "login")
            await self.auth._session.commit()
            return {}
        await self.auth.resend_otp(email, "signup")
        return {}

    async def verify_login_otp(self, email: str, code: str) -> dict[str, Any]:
        auth = await self.auth._auths.get_by_email(email)
        if auth is None:
            raise AppError("AUTH_OTP_INVALID", "Invalid OTP.", 400)
        is_new = auth.email_verified_at is None
        last_error: AppError | None = None
        for purpose in ("login", "signup"):
            try:
                await self.auth._otp.verify(email.lower(), purpose, code)
                last_error = None
                break
            except AppError as exc:
                last_error = exc
        if last_error is not None:
            raise last_error
        if auth.email_verified_at is None:
            auth.email_verified_at = datetime.now(UTC)
        user = await self.auth._users.get_by_id(auth.user_id)
        self.auth._assert_login_allowed(user)
        assert user is not None
        user.last_active_at = datetime.now(UTC)
        tokens = await self.auth._issue_tokens(user.id)
        await self.auth._session.commit()
        return await self.auth_response(tokens, is_new_user=is_new)

    async def login_with_password(self, email: str, password: str) -> dict[str, Any]:
        tokens = await self.auth.login(email, password, None)
        return await self.auth_response(tokens, is_new_user=False)

    async def register_with_password(self, email: str, password: str) -> dict[str, Any]:
        await self.auth.register(email, password)
        return {}

    async def sign_in_with_google(
        self,
        id_token: str,
        access_token: str | None = None,
        birth_date: str | None = None,
        gender: str | None = None,
    ) -> dict[str, Any]:
        claims = await self._verify_google_token(id_token)
        result = await self._upsert_social_user(
            social_email("google", claims),
            "google",
            claims.get("email_verified"),
        )
        people = await self._google_people(access_token)
        picture = str(claims.get("picture") or "").strip()
        name = display_name(str(claims.get("name") or "")) or display_name(
            str(claims.get("given_name") or ""),
            str(claims.get("family_name") or ""),
        )
        return await self._seed_social_profile(
            result,
            name=name,
            birth_date=birth_date or people.get("birthDate") or str(claims.get("birthdate") or "") or None,
            gender=gender or people.get("gender") or str(claims.get("gender") or "") or None,
            picture_url=picture if allowed_avatar_url(picture) else None,
        )

    async def sign_in_with_apple(self, identity_token: str, full_name: dict | None) -> dict[str, Any]:
        claims = await self._verify_apple_token(identity_token)
        result = await self._upsert_social_user(social_email("apple", claims), "apple", True)
        given = family = None
        if full_name:
            given = full_name.get("givenName")
            family = full_name.get("familyName")
        return await self._seed_social_profile(result, name=display_name(given, family))

    async def sign_in_with_facebook(
        self,
        access_token: str,
        birth_date: str | None = None,
        gender: str | None = None,
    ) -> dict[str, Any]:
        profile = await self._verify_facebook_token(access_token)
        result = await self._upsert_social_user(
            social_email("facebook", profile),
            "facebook",
            True,
        )
        extra = await self._facebook_profile_fields(access_token)
        picture = facebook_picture_url(profile)
        name = display_name(str(profile.get("name") or "")) or display_name(
            str(profile.get("first_name") or ""),
            str(profile.get("last_name") or ""),
        )
        return await self._seed_social_profile(
            result,
            name=name,
            birth_date=birth_date
            or extra.get("birthday")
            or str(profile.get("birthday") or "")
            or None,
            gender=gender or extra.get("gender") or str(profile.get("gender") or "") or None,
            picture_url=picture,
        )

    async def _seed_social_profile(
        self,
        result: dict[str, Any],
        *,
        name: str | None = None,
        birth_date: str | None = None,
        gender: str | None = None,
        picture_url: str | None = None,
    ) -> dict[str, Any]:
        """Fill empty create-profile fields from the provider. Never overwrites edits."""
        try:
            user_id = UUID(result["user"]["id"])
            bundle = await self._users.get_user_bundle(user_id)
            profile = bundle.profile if bundle else None
            fields: dict[str, str] = {}
            if name and not (profile and profile.display_name):
                fields["name"] = name
            iso_birth = birth_date_iso(
                birth_date,
                min_age=self._settings.min_dating_age,
                max_age=self._settings.max_dating_age,
            )
            if iso_birth and not (profile and profile.birth_date):
                fields["birthDate"] = iso_birth
            mapped_gender = map_provider_gender(gender)
            if mapped_gender and not (profile and profile.gender):
                fields["gender"] = mapped_gender
            if fields:
                await self.profiles.patch_own(user_id, ProfilePatch.model_validate(fields))
            has_photo = bool(profile and any(item.deleted_at is None for item in profile.media))
            if picture_url and not has_photo:
                await self.profiles.import_remote_avatar(user_id, picture_url)
        except Exception:
            logger.warning("social_profile_seed_failed", exc_info=True)
        return result

    async def _upsert_social_user(self, email: str, provider: str, verified: Any) -> dict[str, Any]:
        existing = await self.auth._auths.get_by_email(email)
        is_new = existing is None
        if existing is None:
            await self.auth.register(email, uuid4().hex + "Aa1!", send_otp=False)
            existing = await self.auth._auths.get_by_email(email)
            assert existing is not None
        existing.provider = provider
        existing.email_verified_at = datetime.now(UTC)
        user = await self.auth._users.get_by_id(existing.user_id)
        self.auth._assert_login_allowed(user)
        assert user is not None
        user.last_active_at = datetime.now(UTC)
        tokens = await self.auth._issue_tokens(user.id)
        await self.auth._session.commit()
        return await self.auth_response(tokens, is_new_user=is_new)

    async def _verify_google_token(self, id_token: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
            )
        if response.status_code != 200:
            raise UnauthorizedError("Google token is invalid.")
        claims = response.json()
        allowed = {
            item
            for item in (
                getattr(self._settings, "google_web_client_id", ""),
                getattr(self._settings, "google_ios_client_id", ""),
            )
            if item
        }
        if allowed and claims.get("aud") not in allowed:
            raise UnauthorizedError("Google token audience is invalid.")
        return claims

    async def _verify_apple_token(self, identity_token: str) -> dict[str, Any]:
        import jwt
        from jwt import PyJWKClient

        try:
            jwks = PyJWKClient("https://appleid.apple.com/auth/keys")
            signing_key = jwks.get_signing_key_from_jwt(identity_token)
            audiences = self._settings.apple_audiences
            return jwt.decode(
                identity_token,
                signing_key.key,
                algorithms=["RS256"],
                audience=audiences or None,
                issuer="https://appleid.apple.com",
                options={"verify_aud": bool(audiences)},
            )
        except UnauthorizedError:
            raise
        except Exception as exc:
            raise UnauthorizedError("Apple token is invalid.") from exc

    async def _verify_facebook_token(self, access_token: str) -> dict[str, Any]:
        if not access_token.strip():
            raise UnauthorizedError("Facebook token is invalid.")
        async with httpx.AsyncClient(timeout=8) as client:
            app_id = getattr(self._settings, "facebook_app_id", "") or ""
            app_secret = getattr(self._settings, "facebook_app_secret", "") or ""
            if app_id.strip() and app_secret.strip():
                debug = await client.get(
                    "https://graph.facebook.com/debug_token",
                    params={
                        "input_token": access_token,
                        "access_token": f"{app_id}|{app_secret}",
                    },
                )
                if debug.status_code != 200:
                    raise UnauthorizedError("Facebook token is invalid.")
                data = debug.json().get("data") or {}
                if not data.get("is_valid") or str(data.get("app_id") or "") != app_id:
                    raise UnauthorizedError("Facebook token is invalid.")
            response = await client.get(
                "https://graph.facebook.com/me",
                params={
                    "fields": "id,name,email,first_name,last_name,birthday,gender,picture.type(large)",
                    "access_token": access_token,
                },
            )
        if response.status_code != 200:
            raise UnauthorizedError("Facebook token is invalid.")
        profile = response.json()
        if not profile.get("id"):
            raise UnauthorizedError("Facebook token is invalid.")
        return profile

    async def _google_people(self, access_token: str | None) -> dict[str, str | None]:
        token = (access_token or "").strip()
        if not token:
            return {}
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                response = await client.get(
                    "https://people.googleapis.com/v1/people/me",
                    params={"personFields": "birthdays,genders"},
                    headers={"Authorization": f"Bearer {token}"},
                )
            if response.status_code != 200:
                return {}
            return google_people_fields(
                response.json(),
                min_age=self._settings.min_dating_age,
                max_age=self._settings.max_dating_age,
            )
        except Exception:
            logger.info("google_people_profile_unavailable")
            return {}

    async def _facebook_profile_fields(self, access_token: str) -> dict[str, str | None]:
        """Birthday and gender need extra Facebook permissions, so a miss is ignored."""
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                response = await client.get(
                    "https://graph.facebook.com/me",
                    params={"fields": "birthday,gender", "access_token": access_token},
                )
            if response.status_code != 200:
                return {}
            payload = response.json()
            return {
                "birthday": str(payload.get("birthday") or "") or None,
                "gender": str(payload.get("gender") or "") or None,
            }
        except Exception:
            logger.info("facebook_profile_fields_unavailable")
            return {}

    async def delete_account(
        self, user: User, reason: str | None = None, details: str | None = None
    ) -> dict[str, Any]:
        reason_code, reason_note = normalize_delete_reason(reason, details)
        db_user = await self._users.get_user_bundle(user.id)
        if db_user is None:
            raise NotFoundError("Account not found.")
        email = db_user.auth.email if db_user.auth else None
        user_id = db_user.id
        self._session.add(
            AuditLog(
                user_id=user_id,
                actor_id=user_id,
                action="ACCOUNT_PERMANENTLY_DELETED",
                target_type="user",
                target_id=user_id,
                ip_address=self.auth._ip,
                user_agent=self.auth._user_agent,
                request_id=self.auth._request_id,
                metadata_json={"reason": reason_code, "details": reason_note},
            )
        )
        await self._session.flush()
        await self._session.delete(db_user)
        await self._session.commit()
        try:
            await self.profiles.purge_user_files(user_id)
        except Exception:
            logger.warning("account_file_purge_failed user_id=%s", user_id, exc_info=True)
        if email:
            await self.auth._otp.clear_destination(email)
        return {"deleted": True, "permanent": True}

    async def my_profile(self, user_id: UUID) -> dict[str, Any]:
        user = await self._users.get_user_bundle(user_id)
        if user is None:
            raise NotFoundError("Profile not found.")
        payload = profile_from_user(user, include_private=True)
        completion = await self.profiles.completion(user_id)
        payload["completeness"] = int(completion.get("percent") or 0)
        payload["birthDate"] = (
            user.profile.birth_date.isoformat() if user.profile and user.profile.birth_date else None
        )
        return payload

    async def public_profile(self, viewer_id: UUID, target_id: UUID) -> dict[str, Any]:
        await self.profiles.get_public(viewer_id, target_id)
        target = await self._users.get_user_bundle(target_id)
        if target is None:
            raise NotFoundError("Profile not found.")
        viewer = await self._users.get_user_bundle(viewer_id)
        common = self._common_interests(viewer, target)
        payload = profile_from_user(target, common_interests=common)
        liked_ids = await self._liked_target_ids(viewer_id, [target_id])
        payload["liked"] = target_id in liked_ids
        return payload

    async def patch_profile(self, user_id: UUID, body: dict[str, Any]) -> dict[str, Any]:
        patch = ProfilePatch.model_validate(
            {
                "name": body.get("name"),
                "bio": body.get("bio"),
                "birthDate": body.get("birthDate"),
                "gender": gender_to_store(body.get("gender")),
                "orientation": body.get("sexualOrientation") or body.get("orientation"),
                "lookingFor": goal_to_store(body.get("relationshipGoal") or body.get("lookingFor")),
            }
        )
        if any(value is not None for value in patch.model_dump().values()):
            await self.profiles.patch_own(user_id, patch)
        user = await self._users.get_user_bundle(user_id)
        if user is None or user.profile is None:
            raise NotFoundError("Profile not found.")
        profile = user.profile
        if "showOrientation" in body:
            profile.show_orientation = bool(body.get("showOrientation"))
        if "languages" in body and isinstance(body["languages"], list):
            profile.languages = [str(item) for item in body["languages"]]
        if "workCategory" in body:
            profile.work_category = body.get("workCategory")
        if "jobTitle" in body:
            profile.job_title = body.get("jobTitle")
        if "company" in body:
            profile.company = body.get("company")
        if "school" in body:
            profile.school = body.get("school")
        if "heightCm" in body:
            profile.height_cm = body.get("heightCm")
        if "nationality" in body:
            profile.nationality = body.get("nationality")
        if isinstance(body.get("lifestyle"), dict):
            current = dict(profile.lifestyle or {})
            current.update(body["lifestyle"])
            profile.lifestyle = current
        if "interests" in body and isinstance(body["interests"], list):
            await self._replace_interests(user_id, [str(item) for item in body["interests"]])
        if user.preferences is not None:
            extras = (
                dict(user.preferences.filters)
                if isinstance(user.preferences.filters, dict)
                else {}
            )
            apply_orientation_audience(extras, profile)
            audience = audience_from_profile(profile.gender, profile.orientation)
            if audience.get("gender_filter"):
                user.preferences.gender_filter = str(audience["gender_filter"])
            orients = audience.get("orientations")
            user.preferences.orientation_filter = (
                orients[0] if isinstance(orients, list) and orients else None
            )
            user.preferences.filters = extras
        await self._session.commit()
        return await self.my_profile(user_id)

    async def _replace_interests(self, user_id: UUID, names: list[str]) -> None:
        found = await self._interests.get_by_slugs_or_names(names)
        found_slugs = {item.slug for item in found}
        for name in names:
            slug = slugify(name)
            if slug in found_slugs or not slug:
                continue
            interest = Interest(slug=slug, name=name.replace("_", " ").title())
            self._session.add(interest)
            await self._session.flush()
            found.append(interest)
            found_slugs.add(slug)
        await self.profiles.put_interests(
            user_id,
            InterestsPut(interestIds=[str(item.id) for item in found]),
        )

    async def complete_onboarding(self, user_id: UUID) -> dict[str, Any]:
        user = await self._users.get_user_bundle(user_id)
        if user is None:
            raise NotFoundError("Profile not found.")
        user.onboarding_completed = True
        user.onboarding_step = "completed"
        await self._session.commit()
        return await self.my_profile(user_id)

    async def request_photo_upload(self, user_id: UUID, content_type: str, file_size: int) -> dict[str, Any]:
        ticket = await self.profiles.create_upload_url(
            user_id,
            UploadUrlRequest(
                contentType=content_type,
                filename="photo.jpg",
                byteSize=max(file_size, 1),
            ),
        )
        photo_id = str(uuid4())
        await self._cache.set(
            f"photo-ticket:{user_id}:{photo_id}",
            ticket["storageKey"],
            ex=self._settings.media_upload_expire_seconds,
        )
        upload_url = ticket["uploadUrl"]
        if upload_url.startswith("/"):
            upload_url = f"{self._request_base}{upload_url}"
        return {
            "photoId": photo_id,
            "uploadUrl": upload_url,
            "headers": ticket.get("headers") or {},
            "expiresAt": ticket.get("expiresAt"),
        }

    async def confirm_photo(self, user_id: UUID, photo_id: str) -> dict[str, Any]:
        storage_key = await self._cache.get(f"photo-ticket:{user_id}:{photo_id}")
        if not storage_key:
            raise AppError("PROFILE_MEDIA_INVALID", "Upload ticket expired.", 400)
        media = await self.profiles.add_media(
            user_id,
            MediaCreate(storageKey=storage_key, sortOrder=0, isPrimary=False),
        )
        await self._cache.delete(f"photo-ticket:{user_id}:{photo_id}")
        return {"id": media["id"], "url": media["url"], "position": media.get("sortOrder", 0)}

    async def delete_photo(self, user_id: UUID, photo_id: str) -> None:
        await self.profiles.delete_media(user_id, UUID(photo_id))

    async def reorder_photos(self, user_id: UUID, photo_ids: list[str]) -> None:
        for index, photo_id in enumerate(photo_ids):
            from app.schemas.profile import MediaPatch

            await self.profiles.patch_media(user_id, UUID(photo_id), MediaPatch(sortOrder=index))

    async def update_location(self, user_id: UUID, body: Any) -> dict[str, Any]:
        result = await self.profiles.patch_location(
            user_id,
            LocationPatch(
                latitude=body.latitude,
                longitude=body.longitude,
                city=getattr(body, "city", None),
                locality=getattr(body, "locality", None),
                district=getattr(body, "district", None),
                region=getattr(body, "region", None),
                country=getattr(body, "country", None),
                countryCode=getattr(body, "country_code", None),
                countryFlag=getattr(body, "country_flag", None),
            ),
        )
        return {
            "locality": result.get("locality"),
            "city": result.get("city"),
            "district": result.get("district"),
            "region": result.get("region"),
            "country": result.get("country"),
            "place": result.get("place"),
            "countryCode": result.get("countryCode"),
            "countryFlag": result.get("countryFlag"),
        }

    async def discovery_feed(
        self,
        user: User,
        cursor: str | None,
        limit: int,
        segment: str | None = None,
    ) -> dict[str, Any]:
        from app.schemas.discovery import DiscoveryQuery

        prefs = await self.get_discovery_preferences(user.id)
        if segment == "verified":
            prefs = {**prefs, "verifiedOnly": True}
        viewer = await self._users.get_user_bundle(user.id)
        interested = prefs.get("interestedIn") or []
        if interested == ["woman"]:
            gender = "Women"
        elif interested == ["man"]:
            gender = "Men"
        elif interested:
            gender = "Everyone"
        else:
            gender = None
        goals = prefs.get("relationshipGoals") or []
        looking_for = goal_to_store(goals[0]) if len(goals) == 1 else None
        interest_names = ",".join(
            str(item) for item in (prefs.get("interests") or []) if item
        ) or None
        radius = float(prefs.get("maxDistanceKm") or 50)
        items: list[dict[str, Any]] = []
        next_cursor = cursor
        for _ in range(4):
            query = DiscoveryQuery(
                minAge=prefs["minAge"],
                maxAge=prefs["maxAge"],
                maxDistanceKm=min(max(radius, 1), 500),
                verifiedOnly=prefs["verifiedOnly"],
                gender=gender,
                lookingFor=looking_for,
                interests=interest_names,
                nationality=prefs.get("nationality") or None,
                limit=limit,
                cursor=next_cursor,
            )
            raw = await self.discovery.feed(user, query)
            for row in raw.get("items") or []:
                target = await self._users.get_user_bundle(UUID(str(row["id"])))
                if target is None:
                    continue
                payload = profile_from_user(
                    target,
                    distance_km=row.get("distanceKm", row.get("distance")),
                    common_interests=self._common_interests(viewer, target),
                )
                if not passes_viewer_filters(prefs, payload):
                    continue
                if segment == "new" and not payload.get("isNew"):
                    continue
                if segment == "active" and not payload.get("isOnline"):
                    continue
                if segment == "verified" and not payload.get("isVerified"):
                    continue
                items.append(payload)
                if len(items) >= limit:
                    break
            next_cursor = raw.get("nextCursor")
            if len(items) >= limit or not next_cursor:
                break
        return {"items": items[:limit], "nextCursor": next_cursor}

    async def discovery_map(
        self,
        user: User,
        *,
        latitude: float,
        longitude: float,
        radius_km: float,
        cursor: str | None,
        limit: int,
        kind: str | None = None,
        online_only: bool = False,
    ) -> dict[str, Any]:
        wanted = (kind or "all").strip()
        if wanted not in {"all", "nearby", "freeTonight", "crossedPaths"}:
            wanted = "all"
        tonight_ids = await self._live_tonight_user_ids()
        viewer = await self._users.get_user_bundle(user.id)
        prefs = await self.get_discovery_preferences(user.id)
        items: list[dict[str, Any]] = []
        next_cursor = cursor
        for _ in range(6):
            raw = await self.discovery.map_feed(
                user,
                latitude=latitude,
                longitude=longitude,
                radius_km=radius_km,
                cursor=next_cursor,
                limit=limit,
            )
            for row in raw.get("items") or []:
                target = await self._users.get_user_bundle(UUID(str(row["id"])))
                if target is None:
                    continue
                payload = profile_from_user(
                    target,
                    distance_km=row.get("distanceKm", row.get("distance")),
                    common_interests=self._common_interests(viewer, target),
                )
                if row.get("latitude") is not None and row.get("longitude") is not None:
                    payload["latitude"] = row.get("latitude")
                    payload["longitude"] = row.get("longitude")
                km = float(payload.get("distanceKm") or 0)
                payload["mapKind"] = (
                    "freeTonight"
                    if target.id in tonight_ids
                    else "crossedPaths"
                    if km <= 2
                    else "nearby"
                )
                if not passes_viewer_filters(prefs, payload):
                    continue
                if online_only and not payload.get("isOnline"):
                    continue
                if wanted != "all" and payload.get("mapKind") != wanted:
                    continue
                items.append(payload)
                if len(items) >= limit:
                    break
            next_cursor = raw.get("nextCursor")
            if len(items) >= limit or not next_cursor:
                break
        return {"items": items[:limit], "nextCursor": next_cursor}

    async def _live_tonight_user_ids(self) -> set[UUID]:
        now = datetime.now(UTC)
        result = await self._session.execute(
            select(TonightPost.user_id).where(
                (TonightPost.expires_at.is_(None)) | (TonightPost.expires_at > now)
            )
        )
        return set(result.scalars())

    def _common_interests(self, viewer: User | None, target: User | None) -> list[str]:
        if viewer is None or target is None or viewer.profile is None or target.profile is None:
            return []
        left = {
            link.interest.slug
            for link in viewer.profile.interests
            if link.interest is not None
        }
        return [
            link.interest.slug
            for link in target.profile.interests
            if link.interest is not None and link.interest.slug in left
        ]

    async def swipe(self, actor: User, target_user_id: str, action: str) -> dict[str, Any]:
        if action not in {"like", "pass", "superlike"}:
            raise AppError("VALIDATION_ERROR", "Invalid swipe action.", 422)
        target_id = UUID(target_user_id)
        swipe = DiscoverySwipe(actor_id=actor.id, target_id=target_id, action=action)
        self._session.add(swipe)
        await self.discovery.record_impressions(actor.id, [target_user_id])
        match_payload = None
        liked_user = None
        like_id = None
        if action in {"like", "superlike"}:
            result = await self.interactions.like(
                actor, target_user_id, superlike=action == "superlike"
            )
            liked_user = result.get("user")
            like_id = result.get("likeId")
            if result.get("matched") and result.get("matchId"):
                other = await self._users.get_user_bundle(target_id)
                match_payload = {
                    "id": result["matchId"],
                    "conversationId": result["conversationId"],
                    "user": like_profile_from_user(other) if other else liked_user,
                    "matchedAt": datetime.now(UTC).isoformat(),
                    "isNew": True,
                }
        await self._cache.set(
            f"last-swipe:{actor.id}",
            f"{action}|{target_user_id}",
            ex=86400,
        )
        remaining = None
        return {
            "match": match_payload,
            "user": liked_user,
            "likeId": like_id,
            "remainingLikes": remaining,
            "remainingSuperlikes": remaining,
        }

    async def rewind_last_swipe(self, actor: User) -> dict[str, Any]:
        raw = await self._cache.get(f"last-swipe:{actor.id}")
        if not raw:
            raise NotFoundError("No swipe to rewind.")
        action, target_id = raw.split("|", 1)
        if action in {"like", "superlike"}:
            await self.interactions.unlike(actor, target_id)
        result = await self._session.execute(
            select(DiscoverySwipe)
            .where(DiscoverySwipe.actor_id == actor.id, DiscoverySwipe.target_id == UUID(target_id))
            .order_by(DiscoverySwipe.created_at.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if row is not None:
            await self._session.delete(row)
            await self._session.commit()
        await self._cache.delete(f"last-swipe:{actor.id}")
        target = await self._users.get_user_bundle(UUID(target_id))
        if target is None:
            raise NotFoundError("Profile not found.")
        return profile_from_user(target)

    async def list_matches(self, actor: User, limit: int, cursor: str | None) -> dict[str, Any]:
        raw = await self.interactions.list_matches(actor, limit, cursor)
        items = []
        for row in raw.get("items") or []:
            other = await self._users.get_user_bundle(UUID(str(row["user"]["id"])))
            if other is None:
                continue
            created = row.get("createdAt")
            items.append(
                {
                    "id": row["id"],
                    "conversationId": row.get("conversationId"),
                    "user": like_profile_from_user(other),
                    "matchedAt": created,
                    "isNew": True,
                }
            )
        return {"items": items, "nextCursor": raw.get("nextCursor")}

    async def list_likes_sent(self, actor: User, limit: int, cursor: str | None) -> dict[str, Any]:
        raw = await self.interactions.list_outgoing(actor, limit, cursor)
        return await self._map_like_page(raw, liked_at_key="likedAt")

    async def list_likes_received(self, actor: User, limit: int, cursor: str | None) -> dict[str, Any]:
        raw = await self.interactions.list_incoming(actor, limit, cursor, gate=False)
        items = []
        for row in raw.get("items") or []:
            other = await self._users.get_user_bundle(UUID(str(row["user"]["id"])))
            if other is None:
                continue
            like = await self.interactions._likes.get(UUID(str(row["user"]["id"])), actor.id)
            items.append(
                {
                    "id": row["id"],
                    "user": like_profile_from_user(other),
                    "isSuperlike": bool(like.is_superlike) if like else False,
                    "likedAt": row.get("createdAt"),
                }
            )
        return {"items": items, "nextCursor": raw.get("nextCursor")}

    async def _map_like_page(self, raw: dict[str, Any], liked_at_key: str) -> dict[str, Any]:
        items = []
        for row in raw.get("items") or []:
            other = await self._users.get_user_bundle(UUID(str(row["user"]["id"])))
            if other is None:
                continue
            items.append(
                {
                    "id": row["id"],
                    "user": like_profile_from_user(other),
                    liked_at_key: row.get("createdAt"),
                }
            )
        return {"items": items, "nextCursor": raw.get("nextCursor")}

    async def respond_to_like(self, actor: User, like_id: str, action: str) -> dict[str, Any]:
        like = await self._session.get(Like, UUID(like_id))
        if like is None or like.target_id != actor.id:
            raise NotFoundError("Like not found.")
        if action == "pass":
            await self.interactions._likes.delete(like.actor_id, like.target_id)
            await self._session.commit()
            return {"match": None}
        result = await self.swipe(actor, str(like.actor_id), "like")
        return {"match": result.get("match")}

    async def record_view(self, viewer: User, target_id: str) -> None:
        viewed = UUID(target_id)
        if viewed == viewer.id:
            return
        row = ProfileView(viewer_id=viewer.id, viewed_id=viewed)
        self._session.add(row)
        await self._session.flush()
        pending =         await self.notifications.persist_view(
            view_id=row.id,
            viewer_id=viewer.id,
            viewed_id=viewed,
        )
        await self._session.commit()
        if pending:
            await self.notifications.enqueue(pending)

    async def list_views(self, actor: User, limit: int, cursor: str | None) -> dict[str, Any]:
        offset = parse_offset_cursor(cursor)
        result = await self._session.execute(
            select(ProfileView)
            .where(ProfileView.viewed_id == actor.id)
            .order_by(ProfileView.created_at.desc(), ProfileView.id.desc())
            .offset(offset)
            .limit(limit + 1)
        )
        rows = list(result.scalars())
        has_more = len(rows) > limit
        page = rows[:limit]
        items = []
        for row in page:
            other = await self._users.get_user_bundle(row.viewer_id)
            if other is None:
                continue
            items.append(
                {
                    "id": str(row.id),
                    "user": like_profile_from_user(other),
                    "viewedAt": row.created_at.isoformat() if row.created_at else None,
                }
            )
        return {
            "items": items,
            "nextCursor": str(offset + limit) if has_more else None,
        }

    async def conversations(self, actor: User, limit: int, cursor: str | None) -> dict[str, Any]:
        raw = await self.chat.list_conversations(actor, limit=limit, cursor=cursor)
        items = []
        for row in raw.get("items") or []:
            peer = await self._users.get_user_bundle(UUID(str(row["user"]["id"])))
            last = None
            if row.get("lastMessage"):
                last = {
                    "id": row.get("lastMessageId") or row["id"],
                    "clientId": None,
                    "conversationId": row["id"],
                    "senderId": row["user"]["id"],
                    "body": row["lastMessage"] if isinstance(row["lastMessage"], str) else "",
                    "createdAt": row.get("time") or datetime.now(UTC).isoformat(),
                    "status": "sent",
                }
            items.append(
                {
                    "id": row["id"],
                    "matchId": row.get("matchId"),
                    "user": match_user_from_user(peer) if peer else row["user"],
                    "lastMessage": last,
                    "unreadCount": row.get("unreadCount") or 0,
                    "updatedAt": row.get("time") or datetime.now(UTC).isoformat(),
                    "isRequest": False,
                }
            )
        return {"items": items, "nextCursor": raw.get("nextCursor")}

    async def messages(self, actor: User, conversation_id: UUID, limit: int, cursor: str | None):
        raw = await self.chat.list_messages(actor, conversation_id, limit, cursor)
        return {
            "items": [message_to_app(item) for item in raw.get("items") or []],
            "nextCursor": raw.get("nextCursor"),
        }

    async def send_message(self, actor: User, conversation_id: UUID, client_id: str, body: str):
        raw = await self.chat.send_message(
            actor,
            conversation_id,
            content=body,
            client_message_id=client_id,
        )
        return message_to_app(raw)

    async def get_discovery_preferences(self, user_id: UUID) -> dict[str, Any]:
        prefs = default_discovery_preferences()
        user = await self._users.get_user_bundle(user_id)
        if user is None:
            return prefs
        if user.preferences is None:
            apply_orientation_audience(prefs, user.profile)
            return prefs
        stored = user.preferences
        extras = stored.filters if isinstance(stored.filters, dict) else {}
        prefs.update(
            {
                "minAge": stored.min_age,
                "maxAge": stored.max_age,
                "maxDistanceKm": int(stored.max_distance_km),
                "verifiedOnly": stored.verified_only,
                "isDiscoverable": getattr(stored, "is_discoverable", True),
                "onlineOnly": getattr(stored, "online_only", False),
            }
        )
        prefs.update({key: extras[key] for key in prefs if key in extras})
        saved_meet = extras.get("interestedIn")
        apply_orientation_audience(prefs, user.profile)
        if saved_meet is not None:
            prefs["interestedIn"] = saved_meet
        return prefs

    async def update_discovery_preferences(self, user_id: UUID, body: dict[str, Any]) -> dict[str, Any]:
        current = await self.get_discovery_preferences(user_id)
        for key, value in body.items():
            if value is not None or key == "nationality":
                current[key] = value
        user = await self._users.get_user_bundle(user_id)
        if user is None or user.preferences is None:
            raise NotFoundError("Profile not found.")
        prefs = user.preferences
        prefs.min_age = int(current["minAge"])
        prefs.max_age = int(current["maxAge"])
        prefs.max_distance_km = float(current["maxDistanceKm"])
        prefs.verified_only = bool(current["verifiedOnly"])
        prefs.is_discoverable = bool(current["isDiscoverable"])
        prefs.online_only = bool(current["onlineOnly"])
        interested = current.get("interestedIn") or []
        if len(interested) == 1:
            prefs.gender_filter = {"man": "Men", "woman": "Women", "nonbinary": "Non-binary"}.get(
                interested[0], "Everyone"
            )
        elif not interested:
            prefs.gender_filter = "Everyone"
        else:
            prefs.gender_filter = "Everyone"
        goals = current.get("relationshipGoals") or []
        prefs.looking_for_filter = goal_to_store(goals[0]) if goals else None
        prefs.filters = current
        if current.get("isDiscoverable") is False and user.profile is not None:
            user.profile.visibility = "HIDDEN"
        elif user.profile is not None and user.profile.visibility == "HIDDEN":
            user.profile.visibility = "PUBLIC"
        _ = genders_for_filter(interested)
        await self._session.commit()
        return current

    async def get_notification_settings(self, user: User) -> dict[str, Any]:
        raw = await self.notifications.get_preferences(user)
        settings = default_notification_settings()
        settings.update(
            {
                "messages": raw.get("messages", True),
                "matches": raw.get("matches", True),
                "likes": raw.get("likes", True),
                "profileViews": raw.get("profileViews", True),
                "crossPath": raw.get("crossPath", True),
                "travellerAlerts": raw.get("travellerAlerts", True),
                "freeTonight": raw.get("freeTonight", True),
                "email": raw.get("email", False),
            }
        )
        settings["all"] = all(
            bool(settings[key])
            for key in (
                "messages",
                "matches",
                "likes",
                "profileViews",
                "crossPath",
                "travellerAlerts",
                "freeTonight",
                "email",
            )
        )
        return settings

    async def update_notification_settings(self, user: User, body: dict[str, Any]) -> dict[str, Any]:
        current = await self.get_notification_settings(user)
        current.update({key: value for key, value in body.items() if value is not None})
        await self.notifications.update_preferences(user, current)
        return await self.get_notification_settings(user)

    async def list_notifications(self, user: User, limit: int, cursor: str | None) -> dict[str, Any]:
        raw = await self.notifications.list_notifications(user, limit, cursor)
        return raw

    async def list_blocks(
        self, user_id: UUID, cursor: str | None = None, limit: int = 20
    ) -> dict[str, Any]:
        rows = await self.discovery.list_blocks(user_id)
        return page_items(rows, cursor, limit)

    async def report_user(self, actor: User, user_id: str, reason: str, details: str | None) -> None:
        if self.reports is None:
            raise AppError("INTERNAL_ERROR", "Reports are unavailable.", 503)
        mapped = REPORT_REASONS.get(reason, "OTHER")
        await self.reports.create(
            actor,
            ReportCreate(reportedUserId=user_id, reason=mapped, details=details),
        )

    async def register_device(self, user: User, body: dict[str, Any]) -> None:
        await self.notifications.register_device(
            user,
            token=body.get("pushToken") or body.get("token"),
            platform=body.get("platform") or "android",
            device_id=None,
            app_version=body.get("appVersion"),
        )

    async def unregister_device(self, user: User, push_token: str) -> None:
        from app.models.orm import DeviceToken

        result = await self._session.execute(
            select(DeviceToken).where(DeviceToken.user_id == user.id, DeviceToken.token == push_token)
        )
        row = result.scalar_one_or_none()
        if row is not None:
            row.is_active = False
            await self._session.commit()

    async def my_subscription(self, user: User) -> dict[str, Any]:
        if self.subscriptions is None:
            return {
                "tier": "free",
                "expiresAt": None,
                "willRenew": False,
                "entitlements": {
                    "unlimitedLikes": False,
                    "seeWhoLikedYou": False,
                    "rewind": False,
                    "superlikesPerDay": 0,
                    "boostsPerMonth": 0,
                },
            }
        raw = await self.subscriptions.me(user)
        raw_ents = raw.get("entitlements")
        items: list[dict[str, Any]] = []
        if isinstance(raw_ents, dict):
            items = [item for item in (raw_ents.get("items") or []) if isinstance(item, dict)]
        elif isinstance(raw_ents, list):
            items = [item for item in raw_ents if isinstance(item, dict)]
        codes = {item.get("code") for item in items if item.get("active")}
        sub = raw.get("subscription") or {}
        return {
            "tier": "plus" if "PREMIUM" in codes else "free",
            "expiresAt": sub.get("expiresAt"),
            "willRenew": bool(sub.get("autoRenewing") or sub.get("willRenew")),
            "entitlements": {
                "unlimitedLikes": "UNLIMITED_LIKES" in codes or "PREMIUM" in codes,
                "seeWhoLikedYou": "SEE_LIKES" in codes or "PREMIUM" in codes,
                "rewind": "PREMIUM" in codes,
                "superlikesPerDay": 5 if "PREMIUM" in codes else 0,
                "boostsPerMonth": 1 if "BOOSTS" in codes or "PREMIUM" in codes else 0,
            },
        }

    async def subscription_plans(self, user: User) -> list[dict[str, Any]]:
        if self.subscriptions is None:
            return []
        raw = await self.subscriptions.catalog(user, "RAZORPAY")
        items = raw.get("items") if isinstance(raw, dict) else raw
        if not items:
            raw = await self.subscriptions.catalog(user, None)
            items = raw.get("items") if isinstance(raw, dict) else raw
        period_months = {"P1M": 1, "P3M": 3, "P6M": 6, "P1Y": 12}
        plans = []
        seen: set[str] = set()
        for item in items or []:
            product_id = item.get("productId") or item.get("storeProductId") or ""
            if not product_id or product_id in seen:
                continue
            seen.add(product_id)
            period = str(item.get("billingPeriod") or "")
            months = item.get("durationMonths") or period_months.get(period) or 1
            plans.append(
                {
                    "id": item.get("id") or product_id,
                    "tier": "plus",
                    "storeProductId": product_id,
                    "durationMonths": months,
                    "displayPrice": item.get("displayPrice"),
                    "amountPaise": item.get("amountPaise"),
                    "currency": item.get("currency") or "INR",
                }
            )
        return plans

    async def verify_purchase(self, user: User, body: dict[str, Any]) -> dict[str, Any]:
        if self.subscriptions is None:
            return await self.my_subscription(user)
        await self.subscriptions.verify(
            user,
            PurchaseProof(
                platform=body["platform"],
                productId=body["productId"],
                purchaseToken=body.get("receipt") or body.get("purchaseToken") or "",
            ),
        )
        return await self.my_subscription(user)

    async def create_razorpay_order(self, user: User, product_id: str) -> dict[str, Any]:
        if self.subscriptions is None:
            raise AppError("SUBSCRIPTION_UNKNOWN_PRODUCT", "This product is not available.", 404)
        return await self.subscriptions.create_razorpay_order(user, product_id)

    async def verify_razorpay_purchase(self, user: User, body: dict[str, Any]) -> dict[str, Any]:
        if self.subscriptions is None:
            return await self.my_subscription(user)
        await self.subscriptions.verify_razorpay(
            user,
            RazorpayVerifyBody.model_validate(body),
        )
        return await self.my_subscription(user)

    async def list_journeys(
        self,
        user_id: UUID,
        cursor: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        result = await self._session.execute(
            select(TravelJourney)
            .where(TravelJourney.user_id == user_id)
            .order_by(TravelJourney.created_at.desc())
        )
        items = [self._journey_payload(row) for row in result.scalars()]
        return page_items(items, cursor, limit)

    async def get_journey(self, user_id: UUID, journey_id: UUID) -> dict[str, Any]:
        row = await self._owned_journey(user_id, journey_id)
        return self._journey_payload(row)

    async def delete_journey(self, user_id: UUID, journey_id: UUID) -> None:
        row = await self._owned_journey(user_id, journey_id)
        await self._session.delete(row)
        await self._session.commit()

    async def create_journey(self, user_id: UUID, body: dict[str, Any]) -> dict[str, Any]:
        require_journey_fields(body)
        cover = body.get("coverImage")
        if not cover:
            owner = await self._users.get_user_bundle(user_id)
            photos = profile_from_user(owner)["photos"] if owner else []
            cover = photos[0]["url"] if photos else None
        departure = iso_travel_date(body.get("departure"))
        return_date = iso_travel_date(body.get("returnDate"))
        from_code, from_flag = _journey_country_flag(body, "from")
        to_code, to_flag = _journey_country_flag(body, "to")
        row = TravelJourney(
            user_id=user_id,
            from_city=(body.get("fromCity") or "").strip(),
            from_country=(body.get("fromCountry") or "").strip(),
            from_country_code=from_code,
            from_country_flag=from_flag,
            from_state=(body.get("fromState") or "").strip(),
            to_city=(body.get("toCity") or "").strip(),
            to_country=(body.get("toCountry") or "").strip(),
            to_country_code=to_code,
            to_country_flag=to_flag,
            to_state=(body.get("toState") or "").strip(),
            departure=departure,
            return_date=return_date,
            trip_type=normalize_trip_type(body.get("tripType")),
            travel_style=normalize_travel_style(body.get("travelStyle")),
            companion=normalize_companion(body.get("companion")),
            status=journey_status(departure, return_date),
            description=(body.get("description") or "").strip(),
            cover_image=cover,
            hide_from_country=bool(body.get("hideFromCountry")),
            hide_from=normalize_hide_from(body.get("hideFrom")),
        )
        self._session.add(row)
        await self._session.flush()
        pending = await self.notifications.persist_travel(
            journey_id=row.id,
            traveler_id=user_id,
            to_city=row.to_city,
            from_city=row.from_city,
            recipient_ids=await self._incoming_like_actor_ids(user_id),
        )
        await self._session.commit()
        await self._session.refresh(row)
        if pending:
            await self.notifications.enqueue(pending)
        return self._journey_payload(row)

    async def update_journey(
        self, user_id: UUID, journey_id: UUID, body: dict[str, Any]
    ) -> dict[str, Any]:
        row = await self._owned_journey(user_id, journey_id)
        mapping = {
            "fromCity": "from_city",
            "fromCountry": "from_country",
            "fromState": "from_state",
            "toCity": "to_city",
            "toCountry": "to_country",
            "toState": "to_state",
            "description": "description",
            "coverImage": "cover_image",
        }
        for key, attr in mapping.items():
            if key in body and body[key] is not None:
                value = body[key]
                setattr(row, attr, value.strip() if isinstance(value, str) else value)
        if "departure" in body and body["departure"] is not None:
            row.departure = iso_travel_date(body["departure"])
        if "returnDate" in body and body["returnDate"] is not None:
            row.return_date = iso_travel_date(body["returnDate"])
        if body.get("tripType"):
            row.trip_type = normalize_trip_type(body.get("tripType"))
        if body.get("travelStyle"):
            row.travel_style = normalize_travel_style(body.get("travelStyle"))
        if body.get("companion"):
            row.companion = normalize_companion(body.get("companion"))
        if "hideFromCountry" in body and body["hideFromCountry"] is not None:
            row.hide_from_country = bool(body["hideFromCountry"])
        if "hideFrom" in body:
            row.hide_from = normalize_hide_from(body.get("hideFrom"))
        if any(key in body for key in ("fromCountry", "fromCountryCode", "fromCountryFlag")):
            from_code, from_flag = _journey_country_flag(
                {
                    "fromCountry": body.get("fromCountry", row.from_country),
                    "fromCountryCode": body.get("fromCountryCode", row.from_country_code),
                    "fromCountryFlag": body.get("fromCountryFlag", row.from_country_flag),
                },
                "from",
            )
            row.from_country_code = from_code
            row.from_country_flag = from_flag
        if any(key in body for key in ("toCountry", "toCountryCode", "toCountryFlag")):
            to_code, to_flag = _journey_country_flag(
                {
                    "toCountry": body.get("toCountry", row.to_country),
                    "toCountryCode": body.get("toCountryCode", row.to_country_code),
                    "toCountryFlag": body.get("toCountryFlag", row.to_country_flag),
                },
                "to",
            )
            row.to_country_code = to_code
            row.to_country_flag = to_flag
        merged = {
            "fromCity": row.from_city,
            "fromCountry": row.from_country,
            "toCity": row.to_city,
            "toCountry": row.to_country,
            "departure": row.departure,
            "returnDate": row.return_date,
        }
        require_journey_fields(merged)
        row.status = journey_status(row.departure, row.return_date)
        await self._session.commit()
        await self._session.refresh(row)
        return self._journey_payload(row)

    async def travel_arrivals(
        self,
        viewer_id: UUID,
        cursor: str | None = None,
        limit: int = 12,
        from_country: str | None = None,
        trip_type: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        travel_style: str | None = None,
        companion: str | None = None,
    ) -> dict[str, Any]:
        items = await self._travel_arrival_cards(viewer_id)
        wanted_country = (from_country or "").strip()
        wanted_trip = (trip_type or "").strip().lower()
        wanted_style = (travel_style or "").strip().lower()
        wanted_companion = (companion or "").strip().lower()
        start = parse_travel_date(from_date)
        end = parse_travel_date(to_date)

        def _norm(value: Any) -> str:
            return str(value or "").strip().lower()

        def _gender_token(value: Any) -> str:
            token = _norm(value)
            if token in {"man", "male", "m"}:
                return "male"
            if token in {"woman", "female", "f"}:
                return "female"
            return token

        if wanted_country:
            items = [
                item
                for item in items
                if (item.get("fromCountry") or "") == wanted_country
            ]
        if wanted_trip:
            items = [
                item
                for item in items
                if _norm(item.get("tripType") or item.get("purpose")) == wanted_trip
            ]
        if wanted_style:
            items = [
                item
                for item in items
                if _norm(item.get("travelStyle")) == wanted_style
            ]
        if wanted_companion:
            items = [
                item
                for item in items
                if _norm(item.get("companion") or "any") == wanted_companion
                or (
                    wanted_companion in {"male", "female"}
                    and _gender_token(item.get("gender")) == wanted_companion
                )
            ]
        if start or end:
            filtered = []
            for item in items:
                arrived = parse_travel_date(
                    item.get("arrivalDate") or item.get("departure")
                )
                if arrived is None:
                    continue
                if start and arrived < start:
                    continue
                if end and arrived > end:
                    continue
                filtered.append(item)
            items = filtered
        return page_items(items, cursor, limit)

    async def travel_countries(
        self,
        viewer_id: UUID,
        cursor: str | None = None,
        limit: int = 20,
        q: str | None = None,
    ) -> dict[str, Any]:
        rows = await self._visible_travel_journeys(viewer_id, row_limit=2000)
        grouped: dict[str, dict[str, Any]] = {}
        city_counts: dict[str, dict[str, int]] = {}
        accents = ("#F97316", "#22C55E", "#38BDF8", "#A855F7", "#EC4899")
        for row in rows:
            country = (row.from_country or "").strip()
            if not country:
                continue
            dest = (row.to_city or country).strip()
            cities = city_counts.setdefault(country, {})
            cities[dest] = cities.get(dest, 0) + 1
            existing = grouped.get(country)
            _emoji, flag_code, flag_url = resolve_country_visual(
                country,
                getattr(row, "from_country_code", None),
                getattr(row, "from_country_flag", None),
            )
            if existing is None:
                grouped[country] = {
                    "id": f"c-{slugify(country)}",
                    "country": country,
                    "flag": _emoji,
                    "flagCode": flag_code,
                    "flagUrl": flag_url,
                    "arriving": 1,
                    "extra": 0,
                    "city": dest,
                    "accent": accents[sum(ord(ch) for ch in country) % len(accents)],
                }
                continue
            existing["arriving"] += 1
            if not existing.get("flagCode") and flag_code:
                existing["flagCode"] = flag_code
                existing["flagUrl"] = flag_url
        for summary in grouped.values():
            cities = city_counts.get(summary["country"]) or {}
            if cities:
                summary["city"] = max(cities.items(), key=lambda item: item[1])[0]
        items = sorted(
            grouped.values(),
            key=lambda item: (-int(item["arriving"]), str(item["country"])),
        )
        needle = (q or "").strip().lower()
        if needle:
            items = [
                item
                for item in items
                if needle in str(item.get("country") or "").lower()
            ]
        return page_items(items, cursor, limit, max_limit=100)

    async def travel_arrival(self, viewer_id: UUID, arrival_id: UUID) -> dict[str, Any]:
        for payload in await self._travel_arrival_cards(viewer_id, journey_id=arrival_id):
            return payload
        raise NotFoundError("Traveler not found.")

    async def _visible_travel_journeys(
        self,
        viewer_id: UUID,
        journey_id: UUID | None = None,
        row_limit: int | None = 300,
    ) -> list[TravelJourney]:
        viewer = await self._users.get_user_bundle(viewer_id)
        loc = viewer.location if viewer else None
        viewer_country = (loc.country if loc else None) or ""
        viewer_city = (loc.city if loc else None) or (loc.district if loc else None) or ""
        viewer_nationality = (
            getattr(viewer.profile, "nationality", None) if viewer and viewer.profile else None
        )
        viewer_gender = (
            gender_to_app(viewer.profile.gender) if viewer and viewer.profile else None
        )
        stmt = select(TravelJourney).order_by(
            TravelJourney.departure.asc(), TravelJourney.created_at.desc()
        )
        if journey_id is not None:
            stmt = select(TravelJourney).where(TravelJourney.id == journey_id)
        elif row_limit is not None:
            stmt = stmt.limit(row_limit)
        result = await self._session.execute(stmt)
        rows = [row for row in result.scalars() if row.user_id != viewer_id]
        visible = [
            row
            for row in rows
            if passes_creation_filters(
                companion=row.companion,
                hide_from_country=row.hide_from_country,
                hide_from=getattr(row, "hide_from", None),
                from_country=row.from_country,
                departure=row.departure,
                return_date=row.return_date,
                viewer_gender=viewer_gender,
                viewer_country=viewer_country,
                viewer_nationality=viewer_nationality,
                viewer_city=viewer_city,
            )
        ]
        homes = viewer_home_names(viewer_country, viewer_nationality, viewer_city)
        local = [
            row
            for row in visible
            if arriving_in_viewer_place(row.to_country, row.to_city, homes)
        ]
        return local if local else visible

    async def _travel_arrival_cards(
        self, viewer_id: UUID, journey_id: UUID | None = None
    ) -> list[dict[str, Any]]:
        rows = await self._visible_travel_journeys(viewer_id, journey_id=journey_id)
        owners = await self._users.get_user_bundles([row.user_id for row in rows])
        liked_ids = await self._liked_target_ids(viewer_id, [row.user_id for row in rows])
        items = []
        for row in rows:
            owner = owners.get(row.user_id)
            if owner is None or owner.profile is None:
                continue
            card = profile_from_user(owner)
            photos = card["photos"]
            gender = card.get("gender")
            seed = abs(hash(str(row.id))) 
            raw_photo = photos[0]["url"] if photos else ""
            photo = usable_photo(raw_photo, gender, seed)
            cover = usable_cover(row.cover_image or raw_photo, gender, seed + 1)
            nationality = owner.profile.nationality or row.from_country
            flag, flag_code, flag_url = resolve_country_visual(
                nationality,
                getattr(row, "from_country_code", None) if nationality == row.from_country else None,
                getattr(row, "from_country_flag", None) if nationality == row.from_country else None,
            )
            to_flag, to_flag_code, to_flag_url = resolve_country_visual(
                row.to_country,
                getattr(row, "to_country_code", None),
                getattr(row, "to_country_flag", None),
            )
            _from_flag, from_flag_code, from_flag_url = resolve_country_visual(
                row.from_country,
                getattr(row, "from_country_code", None),
                getattr(row, "from_country_flag", None),
            )
            status = journey_status(row.departure, row.return_date)
            items.append(
                {
                    "id": str(row.id),
                    "userId": str(row.user_id),
                    "name": owner.profile.display_name or "",
                    "age": age_from_birth_date(owner.profile.birth_date)
                    if owner.profile.birth_date
                    else 0,
                    "photo": photo,
                    "coverPhoto": cover,
                    "flag": flag or to_flag,
                    "flagCode": flag_code or from_flag_code or to_flag_code,
                    "flagUrl": flag_url or from_flag_url,
                    "countryCode": card.get("countryCode"),
                    "countryFlag": card.get("countryFlag"),
                    "nationality": nationality,
                    "from": f"{row.from_city}, {row.from_country}".strip(", "),
                    "to": f"{row.to_city}, {row.to_country}".strip(", "),
                    "fromCity": row.from_city,
                    "fromCountry": row.from_country,
                    "fromCountryCode": from_flag_code,
                    "fromCountryFlag": from_flag_url,
                    "toCity": row.to_city,
                    "toCountry": row.to_country,
                    "toFlagCode": to_flag_code,
                    "toCountryFlag": to_flag_url,
                    "status": status,
                    "tripType": row.trip_type,
                    "city": row.to_city,
                    "country": row.to_country,
                    "heightLabel": height_label(card.get("heightCm")),
                    "zodiac": zodiac_from_birth_date(owner.profile.birth_date),
                    "tags": travel_tags_for(row.trip_type),
                    "arrivalDate": row.departure,
                    "returnDate": row.return_date,
                    "purpose": row.trip_type,
                    "travelStyle": row.travel_style,
                    "companion": row.companion,
                    "hideFromCountry": row.hide_from_country,
                    "hideFrom": getattr(row, "hide_from", None),
                    "quote": row.description or "New places, new people.",
                    "isOnline": card["isOnline"],
                    "gender": card["gender"],
                    "sexualOrientation": card.get("sexualOrientation"),
                    "isVerified": card["isVerified"],
                    "liked": row.user_id in liked_ids,
                }
            )
        return items

    async def _owned_journey(self, user_id: UUID, journey_id: UUID) -> TravelJourney:
        row = await self._session.get(TravelJourney, journey_id)
        if row is None or row.user_id != user_id:
            raise NotFoundError("Journey not found.")
        return row

    async def _liked_target_ids(self, actor_id: UUID, user_ids: list[UUID]) -> set[UUID]:
        unique_ids = [item for item in dict.fromkeys(user_ids) if item != actor_id]
        if not unique_ids:
            return set()
        result = await self._session.execute(
            select(Like.target_id).where(Like.actor_id == actor_id, Like.target_id.in_(unique_ids))
        )
        return {row[0] for row in result}

    def _journey_payload(self, row: TravelJourney) -> dict[str, Any]:
        _from_emoji, from_code, from_flag = resolve_country_visual(
            row.from_country,
            getattr(row, "from_country_code", None),
            getattr(row, "from_country_flag", None),
        )
        _to_emoji, to_code, to_flag = resolve_country_visual(
            row.to_country,
            getattr(row, "to_country_code", None),
            getattr(row, "to_country_flag", None),
        )
        return {
            "id": str(row.id),
            "fromCity": row.from_city,
            "fromCountry": row.from_country,
            "fromCountryCode": from_code,
            "fromCountryFlag": from_flag,
            "fromState": getattr(row, "from_state", "") or "",
            "toCity": row.to_city,
            "toCountry": row.to_country,
            "toCountryCode": to_code,
            "toCountryFlag": to_flag,
            "toState": getattr(row, "to_state", "") or "",
            "departure": row.departure,
            "returnDate": row.return_date,
            "tripType": row.trip_type,
            "travelStyle": row.travel_style,
            "companion": row.companion,
            "status": journey_status(row.departure, row.return_date),
            "description": row.description,
            "coverImage": row.cover_image or "",
            "hideFromCountry": row.hide_from_country,
            "hideFrom": getattr(row, "hide_from", None),
        }

    def _tonight_distance_ok(
        self,
        km: float | None,
        min_km: float | None,
        max_km: float | None,
    ) -> bool:
        unbounded = (min_km is None or min_km <= 0) and (
            max_km is None or max_km >= 150
        )
        if unbounded:
            return True
        if km is None:
            return False
        if min_km is not None and km < min_km:
            return False
        if max_km is not None and km > max_km:
            return False
        return True

    def _tonight_item(
        self,
        row: TonightPost,
        owner: Any,
        *,
        is_own: bool,
        distances: dict[UUID, float],
        liked_ids: set[UUID],
        view_counts: dict[UUID, int],
        now: datetime,
    ) -> dict[str, Any]:
        card = profile_from_user(owner)
        photos = card.get("photos") or []
        photo = photos[0]["url"] if photos else ""
        activity_key = normalize_tonight_activity(row.activity)
        ends = row.expires_at or (row.created_at + timedelta(hours=8))
        remaining = max(int((ends - now).total_seconds() // 60), 0)
        if card.get("countryCode") or card.get("countryFlag"):
            flag, flag_code, flag_url = resolve_country_visual(
                card.get("country"),
                card.get("countryCode"),
                card.get("countryFlag"),
            )
        else:
            flag, flag_code, flag_url = "", "", ""
        return {
            "id": str(row.id),
            "userId": str(row.user_id),
            "name": card["name"],
            "age": card["age"],
            "photo": photo,
            "featuredPhoto": row.featured_photo or photo,
            "distanceKm": 0.0 if is_own else distances.get(row.user_id),
            "timeLeft": f"{remaining}m",
            "endsIn": f"{remaining}m",
            "activity": activity_key,
            "flag": flag,
            "flagCode": flag_code,
            "countryCode": card.get("countryCode") or flag_code,
            "countryFlag": card.get("countryFlag") or flag_url,
            "heightLabel": height_label(card.get("heightCm")),
            "venue": row.venue,
            "tagline": row.tagline,
            "lookingFor": row.looking_for or default_looking_for(activity_key),
            "meetTime": row.meet_time,
            "isOnline": card["isOnline"],
            "isVerified": card["isVerified"],
            "gender": card["gender"] or "woman",
            "sexualOrientation": card.get("sexualOrientation"),
            "viewsLeft": view_counts.get(row.user_id, 0),
            "liked": row.user_id in liked_ids,
            "isOwn": is_own,
        }

    async def list_tonight(
        self,
        viewer: User,
        activity: str | None = None,
        min_km: float | None = None,
        max_km: float | None = None,
        cursor: str | None = None,
        limit: int = 12,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        prefs = await self.get_discovery_preferences(viewer.id)
        wanted_values = stored_activity_values(activity)
        stmt = (
            select(TonightPost)
            .where(
                TonightPost.user_id != viewer.id,
                (TonightPost.expires_at.is_(None)) | (TonightPost.expires_at > now),
            )
            .order_by(TonightPost.created_at.desc())
            .limit(200)
        )
        if wanted_values:
            stmt = stmt.where(TonightPost.activity.in_(wanted_values))
        result = await self._session.execute(stmt)
        rows = list(result.scalars())
        owners = await self._users.get_user_bundles([row.user_id for row in rows])
        distances = await self._distance_km_map(viewer.id, [row.user_id for row in rows])
        liked_ids = await self._liked_target_ids(viewer.id, [row.user_id for row in rows])
        view_counts = await self._view_counts([row.user_id for row in rows])
        items: list[dict[str, Any]] = []
        for row in rows:
            owner = owners.get(row.user_id)
            if owner is None:
                continue
            if wanted_values and normalize_tonight_activity(row.activity) not in {
                normalize_tonight_activity(activity)
            }:
                continue
            card = profile_from_user(owner)
            if not passes_tonight_audience(prefs, card):
                continue
            km = distances.get(row.user_id)
            if not self._tonight_distance_ok(km, min_km, max_km):
                continue
            items.append(
                self._tonight_item(
                    row,
                    owner,
                    is_own=False,
                    distances=distances,
                    liked_ids=liked_ids,
                    view_counts=view_counts,
                    now=now,
                )
            )
        return page_items(items, cursor, limit)

    async def _incoming_like_actor_ids(self, user_id: UUID) -> list[UUID]:
        result = await self._session.execute(
            select(Like.actor_id).where(Like.target_id == user_id)
        )
        return [row[0] for row in result.all()]

    async def _view_counts(self, user_ids: list[UUID]) -> dict[UUID, int]:
        unique_ids = list(dict.fromkeys(user_ids))
        if not unique_ids:
            return {}
        from sqlalchemy import func

        result = await self._session.execute(
            select(ProfileView.viewed_id, func.count(ProfileView.id))
            .where(ProfileView.viewed_id.in_(unique_ids))
            .group_by(ProfileView.viewed_id)
        )
        return {user_id: int(count) for user_id, count in result}

    async def _distance_km_map(self, viewer_id: UUID, user_ids: list[UUID]) -> dict[UUID, float]:
        unique_ids = [item for item in dict.fromkeys(user_ids) if item != viewer_id]
        if not unique_ids:
            return {}
        viewer = await self._users.get_user_bundle(viewer_id)
        origin = viewer.location.geog if viewer and viewer.location is not None else None
        if origin is None:
            return {}
        result = await self._session.execute(
            select(Location.user_id, ST_Distance(Location.geog, origin)).where(
                Location.user_id.in_(unique_ids),
                Location.geog.is_not(None),
            )
        )
        return {
            user_id: round(float(meters) / 1000.0, 1)
            for user_id, meters in result
            if meters is not None
        }

    async def _own_tonight_item(
        self, user: User, row: TonightPost
    ) -> dict[str, Any] | None:
        owner = await self._users.get_user_bundle(user.id)
        if owner is None:
            return None
        view_counts = await self._view_counts([user.id])
        return self._tonight_item(
            row,
            owner,
            is_own=True,
            distances={},
            liked_ids=set(),
            view_counts=view_counts,
            now=datetime.now(UTC),
        )

    async def live_tonight_post(self, user_id: UUID) -> TonightPost | None:
        now = datetime.now(UTC)
        result = await self._session.execute(
            select(TonightPost)
            .where(
                TonightPost.user_id == user_id,
                (TonightPost.expires_at.is_(None)) | (TonightPost.expires_at > now),
            )
            .order_by(TonightPost.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def my_tonight(self, user: User) -> dict[str, Any] | None:
        row = await self.live_tonight_post(user.id)
        if row is None:
            return None
        return await self._own_tonight_item(user, row)

    async def create_tonight(self, user: User, body: dict[str, Any]) -> dict[str, Any]:
        if await self.live_tonight_post(user.id) is not None:
            raise AppError(
                "TONIGHT_EXISTS",
                "You already have a Free Tonight. You can create another after it ends.",
                409,
            )
        expires = datetime.now(UTC) + timedelta(hours=8)
        activity = normalize_tonight_activity(body.get("activity"))
        looking = (body.get("lookingFor") or "").strip() or default_looking_for(activity)
        row = TonightPost(
            user_id=user.id,
            activity=activity,
            venue=body.get("venue") or "",
            tagline=body.get("tagline") or body.get("note") or "",
            looking_for=looking,
            meet_time=body.get("time") or body.get("meetTime") or "",
            featured_photo=body.get("featuredPhoto"),
            expires_at=expires,
        )
        self._session.add(row)
        await self._session.flush()
        pending = await self.notifications.persist_tonight(
            post_id=row.id,
            host_id=user.id,
            activity=row.activity,
            venue=row.venue,
            recipient_ids=await self._incoming_like_actor_ids(user.id),
        )
        await self._session.commit()
        if pending:
            await self.notifications.enqueue(pending)
        return await self._own_tonight_item(user, row) or {}

    async def update_tonight(self, user: User, body: dict[str, Any]) -> dict[str, Any]:
        row = await self.live_tonight_post(user.id)
        if row is None:
            raise NotFoundError("Free Tonight not found.")
        if body.get("activity"):
            row.activity = normalize_tonight_activity(body.get("activity"))
        if "venue" in body:
            row.venue = str(body.get("venue") or "")
        if "tagline" in body or "note" in body:
            row.tagline = str(body.get("tagline") or body.get("note") or "")
        if "lookingFor" in body:
            looking = str(body.get("lookingFor") or "").strip()
            row.looking_for = looking or default_looking_for(row.activity)
        elif body.get("activity"):
            if not (row.looking_for or "").strip():
                row.looking_for = default_looking_for(row.activity)
        if "time" in body or "meetTime" in body:
            row.meet_time = str(body.get("time") or body.get("meetTime") or "")
        if "featuredPhoto" in body:
            row.featured_photo = body.get("featuredPhoto")
        await self._session.commit()
        return await self._own_tonight_item(user, row) or {}

    async def delete_tonight(self, user: User) -> dict[str, Any]:
        row = await self.live_tonight_post(user.id)
        if row is None:
            raise NotFoundError("Free Tonight not found.")
        await self._session.delete(row)
        await self._session.commit()
        return {"deleted": True}

    async def start_verification(self, user: User) -> dict[str, Any]:
        from app.services.verification import VerificationService

        # Status-only: the RN verify screen captures a selfie locally.
        return {"status": "pending"}
