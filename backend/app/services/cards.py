from typing import Any

from app.core.profile_rules import age_from_birth_date, format_location
from app.models.orm import User
from app.services.presenters import like_profile_from_user, photo_objects, profile_from_user


def public_card(user: User, *, is_online: bool = False) -> dict[str, Any]:
    profile = user.profile
    loc = user.location
    photos = photo_objects(profile.media if profile else None)
    media = [
        {
            "id": item["id"],
            "url": item["url"],
            "sortOrder": item["position"],
            "isPrimary": item["position"] == 0,
        }
        for item in photos
    ]
    interests = [
        link.interest.name
        for link in (profile.interests if profile else [])
        if link.interest is not None
    ]
    age = age_from_birth_date(profile.birth_date) if profile and profile.birth_date else 0
    location_text = format_location(
        loc.city if loc else None,
        loc.country if loc else None,
        loc.region if loc else None,
    )
    app_profile = profile_from_user(user)
    like = like_profile_from_user(user)
    return {
        "id": str(user.id),
        "name": profile.display_name if profile and profile.display_name else "",
        "displayName": profile.display_name if profile else None,
        "age": age,
        "bio": profile.bio if profile and profile.bio else "",
        "gender": app_profile["gender"] or (profile.gender if profile and profile.gender else ""),
        "orientation": profile.orientation if profile and profile.orientation else "",
        "sexualOrientation": app_profile["sexualOrientation"],
        "relationshipGoal": app_profile["relationshipGoal"],
        "lookingFor": profile.looking_for if profile and profile.looking_for else "",
        "interests": interests,
        "photos": photos,
        "photoUrls": [item["url"] for item in photos],
        "media": media,
        "location": location_text,
        "city": loc.city if loc else like["city"],
        "country": loc.country if loc else like["country"],
        "locality": app_profile.get("locality"),
        "district": app_profile.get("district"),
        "region": app_profile.get("region"),
        "place": app_profile.get("place"),
        "countryCode": app_profile.get("countryCode"),
        "countryFlag": app_profile.get("countryFlag"),
        "distance": 0,
        "distanceKm": 0,
        "isVerified": like["isVerified"],
        "isOnline": is_online or like["isOnline"],
        "isPremium": False,
        "lastSeen": user.last_active_at.isoformat() if user.last_active_at else None,
    }
