"""React Native response shapes used across profiles, discovery, likes, and chat."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.country_iso import nationality_match_values
from app.core.discovery_rules import audience_from_profile
from app.core.mobile_maps import (
    EMPTY_LIFESTYLE,
    gender_to_app,
    goal_to_app,
    orientation_to_app,
    resolve_country_visual,
)
from app.core.profile_rules import age_from_birth_date, place_name
from app.models.orm import Location, Profile, ProfileMedia, User


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def photo_objects(media_items: list[ProfileMedia] | None) -> list[dict[str, Any]]:
    items = [item for item in (media_items or []) if item.deleted_at is None]
    items.sort(key=lambda item: (not item.is_primary, item.sort_order, item.created_at))
    return [
        {
            "id": str(item.id),
            "url": item.url,
            "position": index,
        }
        for index, item in enumerate(items)
    ]


def is_online(last_active_at: datetime | None, window_minutes: int = 20) -> bool:
    if last_active_at is None:
        return False
    stamp = last_active_at if last_active_at.tzinfo else last_active_at.replace(tzinfo=UTC)
    return datetime.now(UTC) - stamp <= timedelta(minutes=window_minutes)


def is_new_profile(created_at: datetime | None, window_hours: int = 72) -> bool:
    if created_at is None:
        return False
    stamp = created_at if created_at.tzinfo else created_at.replace(tzinfo=UTC)
    return datetime.now(UTC) - stamp <= timedelta(hours=window_hours)


def location_flag_fields(
    user: User | None = None,
    *,
    onboarding_completed: bool | None = None,
    country: str | None = None,
    country_code: str | None = None,
    country_flag: str | None = None,
) -> dict[str, Any]:
    completed = (
        user.onboarding_completed
        if user is not None and onboarding_completed is None
        else bool(onboarding_completed)
    )
    if not completed:
        return {}
    loc = user.location if user is not None else None
    name = country if country is not None else (loc.country if loc else None)
    code = country_code if country_code is not None else getattr(loc, "country_code", None)
    flag = country_flag if country_flag is not None else getattr(loc, "country_flag", None)
    if not name and not code and not flag:
        return {}
    _emoji, iso, url = resolve_country_visual(name, code, flag)
    payload: dict[str, Any] = {}
    if iso:
        payload["countryCode"] = iso
    if url:
        payload["countryFlag"] = url
    return payload


def place_fields(loc: Location | None) -> dict[str, Any]:
    if loc is None:
        return {
            "locality": None,
            "district": None,
            "region": None,
            "place": None,
        }
    locality = getattr(loc, "locality", None)
    district = getattr(loc, "district", None)
    return {
        "locality": locality,
        "district": district,
        "region": loc.region,
        "place": place_name(locality, loc.city, district, loc.region, loc.country),
    }


def lifestyle_from_profile(profile) -> dict[str, Any]:
    stored = getattr(profile, "lifestyle", None) if profile is not None else None
    if not isinstance(stored, dict):
        return dict(EMPTY_LIFESTYLE)
    merged = dict(EMPTY_LIFESTYLE)
    merged.update({key: stored.get(key) for key in EMPTY_LIFESTYLE})
    return merged


def profile_from_user(
    user: User,
    *,
    distance_km: float | None = None,
    common_interests: list[str] | None = None,
    include_private: bool = False,
) -> dict[str, Any]:
    profile = user.profile
    loc = user.location
    photos = photo_objects(profile.media if profile else None)
    interests = [
        link.interest.slug if link.interest and link.interest.slug else link.interest.name
        for link in (profile.interests if profile else [])
        if link.interest is not None
    ]
    age = age_from_birth_date(profile.birth_date) if profile and profile.birth_date else 0
    payload: dict[str, Any] = {
        "id": str(user.id),
        "name": profile.display_name if profile and profile.display_name else "",
        "age": age,
        "gender": gender_to_app(profile.gender if profile else None),
        "sexualOrientation": orientation_to_app(profile.orientation if profile else None),
        "showOrientation": bool(getattr(profile, "show_orientation", True)) if profile else True,
        "bio": profile.bio if profile else None,
        "photos": photos,
        "interests": interests,
        "languages": list(getattr(profile, "languages", None) or []) if profile else [],
        "workCategory": getattr(profile, "work_category", None) if profile else None,
        "relationshipGoal": goal_to_app(profile.looking_for if profile else None),
        "lifestyle": lifestyle_from_profile(profile),
        "jobTitle": getattr(profile, "job_title", None) if profile else None,
        "company": getattr(profile, "company", None) if profile else None,
        "school": getattr(profile, "school", None) if profile else None,
        "heightCm": getattr(profile, "height_cm", None) if profile else None,
        "city": loc.city if loc else None,
        "country": loc.country if loc else None,
        **place_fields(loc),
        **location_flag_fields(user),
        "isVerified": bool(profile and profile.verification_status == "VERIFIED"),
        "distanceKm": distance_km,
        "commonInterests": common_interests or [],
        "isOnline": is_online(user.last_active_at),
        "isNew": is_new_profile(user.created_at),
        "nationality": getattr(profile, "nationality", None) if profile else None,
    }
    if include_private:
        payload["birthDate"] = profile.birth_date.isoformat() if profile and profile.birth_date else None
        payload["completeness"] = 0
    return payload


def like_profile_from_user(user: User, *, distance_km: float | None = None) -> dict[str, Any]:
    profile = profile_from_user(user, distance_km=distance_km)
    return {
        "id": profile["id"],
        "name": profile["name"],
        "age": profile["age"],
        "photos": profile["photos"],
        "isVerified": profile["isVerified"],
        "gender": profile["gender"],
        "relationshipGoal": profile["relationshipGoal"],
        "isOnline": profile["isOnline"],
        "city": profile["city"],
        "country": profile["country"],
        "countryCode": profile.get("countryCode"),
        "countryFlag": profile.get("countryFlag"),
        "distanceKm": distance_km,
    }


def match_user_from_user(user: User) -> dict[str, Any]:
    profile = profile_from_user(user)
    return {
        "id": profile["id"],
        "name": profile["name"],
        "age": profile["age"],
        "photos": profile["photos"],
        "isVerified": profile["isVerified"],
        "city": profile.get("city"),
        "country": profile.get("country"),
        "countryCode": profile.get("countryCode"),
        "countryFlag": profile.get("countryFlag"),
    }


def message_to_app(payload: dict[str, Any]) -> dict[str, Any]:
    status = str(payload.get("status") or "sent").lower()
    if status == "sent":
        app_status = "sent"
    elif status == "delivered":
        app_status = "delivered"
    elif status == "read":
        app_status = "read"
    else:
        app_status = "sent"
    return {
        "id": payload.get("id"),
        "clientId": payload.get("clientMessageId") or payload.get("clientId"),
        "conversationId": payload.get("conversationId"),
        "senderId": payload.get("senderId"),
        "body": payload.get("content") or payload.get("text") or payload.get("body") or "",
        "createdAt": payload.get("createdAt") or payload.get("time"),
        "status": app_status,
    }


def apply_orientation_audience(
    prefs: dict[str, Any], profile: Profile | None
) -> dict[str, Any]:
    if profile is None:
        return prefs
    audience = audience_from_profile(profile.gender, profile.orientation)
    interested = audience.get("interested_in")
    if interested:
        prefs["interestedIn"] = list(interested)
    elif audience.get("orientations"):
        prefs["interestedIn"] = []
    prefs["matchOrientations"] = list(audience.get("orientations") or [])
    return prefs


def passes_tonight_audience(prefs: dict[str, Any], card: dict[str, Any]) -> bool:
    interested = prefs.get("interestedIn") or []
    gender = card.get("gender")
    if interested and gender and gender not in interested:
        return False
    wanted_orientations = prefs.get("matchOrientations") or []
    if wanted_orientations:
        card_orientation = card.get("sexualOrientation")
        if card_orientation not in wanted_orientations:
            return False
    return True


def passes_viewer_filters(prefs: dict[str, Any], card: dict[str, Any]) -> bool:
    age = card.get("age") or 0
    if age and (age < int(prefs.get("minAge") or 18) or age > int(prefs.get("maxAge") or 99)):
        return False
    if prefs.get("verifiedOnly") and not card.get("isVerified"):
        return False
    if prefs.get("onlineOnly") and not card.get("isOnline"):
        return False
    interested = prefs.get("interestedIn") or []
    gender = card.get("gender")
    if interested and gender and gender not in interested:
        return False
    wanted_orientations = prefs.get("matchOrientations") or []
    if wanted_orientations:
        card_orientation = card.get("sexualOrientation")
        if card_orientation not in wanted_orientations:
            return False
    goals = prefs.get("relationshipGoals") or []
    if goals and card.get("relationshipGoal") not in goals:
        return False
    lifestyle = card.get("lifestyle") or {}
    checks = (
        ("bodyTypes", "bodyType"),
        ("drinking", "drinking"),
        ("workout", "workout"),
        ("personality", "personality"),
        ("heightRanges", "heightRange"),
    )
    for pref_key, life_key in checks:
        wanted = prefs.get(pref_key) or []
        if wanted and lifestyle.get(life_key) not in wanted:
            return False
    interests = prefs.get("interests") or []
    if interests and not set(interests) & set(card.get("interests") or []):
        return False
    languages = prefs.get("languages") or []
    if languages and not set(languages) & set(card.get("languages") or []):
        return False
    work = prefs.get("workCategories") or []
    if work and card.get("workCategory") not in work:
        return False
    nationality = prefs.get("nationality")
    keys = nationality_match_values(nationality)
    if keys:
        card_nation = (card.get("nationality") or card.get("country") or "").strip().lower()
        if card_nation and card_nation not in {item.lower() for item in keys}:
            return False
    return True


def default_discovery_preferences() -> dict[str, Any]:
    return {
        "minAge": 18,
        "maxAge": 40,
        "maxDistanceKm": 50,
        "interestedIn": [],
        "isDiscoverable": True,
        "verifiedOnly": False,
        "onlineOnly": False,
        "nationality": None,
        "relationshipGoals": [],
        "bodyTypes": [],
        "drinking": [],
        "workout": [],
        "personality": [],
        "heightRanges": [],
        "interests": [],
        "languages": [],
        "workCategories": [],
        "matchOrientations": [],
    }


def default_notification_settings() -> dict[str, Any]:
    return {
        "all": True,
        "messages": True,
        "matches": True,
        "likes": True,
        "profileViews": True,
        "crossPath": True,
        "travellerAlerts": True,
        "freeTonight": True,
        "email": False,
    }
