"""Canonical mappings between the React Native app and stored profile values."""

from __future__ import annotations

from typing import Any

from app.core.country_iso import COUNTRY_ISO

EMPTY_LIFESTYLE: dict[str, Any] = {
    "ethnicity": None,
    "bodyType": None,
    "heightRange": None,
    "eyeColor": None,
    "smoking": None,
    "drinking": None,
    "workout": None,
    "personality": None,
}

GENDER_TO_APP = {
    "man": "man",
    "woman": "woman",
    "transgender": "transgender",
    "nonbinary": "nonbinary",
    "non-binary": "nonbinary",
    "Man": "man",
    "Woman": "woman",
    "Non-Binary": "nonbinary",
    "Non-binary": "nonbinary",
    "Other": "transgender",
}

GENDER_TO_STORE = {
    "man": "man",
    "woman": "woman",
    "transgender": "transgender",
    "nonbinary": "nonbinary",
    "Man": "man",
    "Woman": "woman",
    "Non-Binary": "nonbinary",
    "Non-binary": "nonbinary",
    "Other": "transgender",
}

GENDER_FILTER_VALUES = {
    "man": ["man", "Man"],
    "woman": ["woman", "Woman"],
    "nonbinary": ["nonbinary", "Non-Binary", "Non-binary"],
    "transgender": ["transgender", "Other"],
}

ORIENTATION_TO_APP = {
    "straight": "straight",
    "gay": "gay",
    "lesbian": "lesbian",
    "bisexual": "bisexual",
    "pansexual": "pansexual",
    "queer": "queer",
    "asexual": "asexual",
    "demisexual": "demisexual",
    "questioning": "questioning",
    "Straight": "straight",
    "Gay": "gay",
    "Lesbian": "lesbian",
    "Bisexual": "bisexual",
    "Queer": "queer",
}

GOAL_TO_APP = {
    "serious_love": "serious_love",
    "marriage": "marriage",
    "casual": "casual",
    "long_term": "long_term",
    "short_term": "short_term",
    "travel_partner": "travel_partner",
    "new_friends": "new_friends",
    "mutual_support": "mutual_support",
    "freelance": "freelance",
    "Dating": "serious_love",
    "Long-term Relationship": "long_term",
    "Casual Fun": "casual",
    "Friendship": "new_friends",
    "Networking": "freelance",
}

GOAL_TO_STORE = {
    "serious_love": "serious_love",
    "marriage": "marriage",
    "casual": "casual",
    "long_term": "long_term",
    "short_term": "short_term",
    "travel_partner": "travel_partner",
    "new_friends": "new_friends",
    "mutual_support": "mutual_support",
    "freelance": "freelance",
    "Dating": "serious_love",
    "Long-term Relationship": "long_term",
    "Casual Fun": "casual",
    "Friendship": "new_friends",
    "Networking": "freelance",
}

REPORT_REASONS = {
    "fake_profile": "IMPERSONATION",
    "inappropriate_content": "INAPPROPRIATE_CONTENT",
    "harassment": "HARASSMENT",
    "spam": "SPAM",
    "underage": "MINOR_SAFETY_CONCERN",
    "other": "OTHER",
}

FRONTEND_GENDERS = frozenset({"man", "woman", "transgender", "nonbinary"})
FRONTEND_ORIENTATIONS = frozenset(
    {
        "straight",
        "gay",
        "lesbian",
        "bisexual",
        "pansexual",
        "queer",
        "asexual",
        "demisexual",
        "questioning",
    }
)
FRONTEND_GOALS = frozenset(GOAL_TO_STORE.keys())


def gender_to_app(value: str | None) -> str | None:
    if not value:
        return None
    return GENDER_TO_APP.get(value, value if value in FRONTEND_GENDERS else None)


def gender_to_store(value: str | None) -> str | None:
    if not value:
        return None
    return GENDER_TO_STORE.get(value, value)


def orientation_to_app(value: str | None) -> str | None:
    if not value:
        return None
    return ORIENTATION_TO_APP.get(value, value if value in FRONTEND_ORIENTATIONS else None)


def goal_to_app(value: str | None) -> str | None:
    if not value:
        return None
    return GOAL_TO_APP.get(value, value if value in FRONTEND_GOALS else None)


def goal_to_store(value: str | None) -> str | None:
    if not value:
        return None
    return GOAL_TO_STORE.get(value, value)


COUNTRY_FLAGS: dict[str, tuple[str, str]] = {
    "afghanistan": ("🇦🇫", "af"),
    "australia": ("🇦🇺", "au"),
    "austria": ("🇦🇹", "at"),
    "bangladesh": ("🇧🇩", "bd"),
    "belgium": ("🇧🇪", "be"),
    "brazil": ("🇧🇷", "br"),
    "canada": ("🇨🇦", "ca"),
    "china": ("🇨🇳", "cn"),
    "egypt": ("🇪🇬", "eg"),
    "france": ("🇫🇷", "fr"),
    "germany": ("🇩🇪", "de"),
    "india": ("🇮🇳", "in"),
    "indonesia": ("🇮🇩", "id"),
    "italy": ("🇮🇹", "it"),
    "japan": ("🇯🇵", "jp"),
    "malaysia": ("🇲🇾", "my"),
    "nepal": ("🇳🇵", "np"),
    "netherlands": ("🇳🇱", "nl"),
    "pakistan": ("🇵🇰", "pk"),
    "singapore": ("🇸🇬", "sg"),
    "spain": ("🇪🇸", "es"),
    "thailand": ("🇹🇭", "th"),
    "uae": ("🇦🇪", "ae"),
    "united arab emirates": ("🇦🇪", "ae"),
    "uk": ("🇬🇧", "gb"),
    "united kingdom": ("🇬🇧", "gb"),
    "usa": ("🇺🇸", "us"),
    "united states": ("🇺🇸", "us"),
}

TRAVEL_TRIP_TAGS: dict[str, list[dict[str, str]]] = {
    "business": [
        {"id": "business", "labelKey": "travel.tagBusiness", "icon": "briefcase-outline", "tone": "blue"},  # noqa: E501
    ],
    "vacation": [
        {"id": "travel-buddy", "labelKey": "travel.tagTravelBuddy", "icon": "airplane", "tone": "pink"},  # noqa: E501
        {"id": "short-term", "labelKey": "travel.tagShortTerm", "icon": "sunny-outline", "tone": "blue"},  # noqa: E501
    ],
    "nightlife": [
        {"id": "nightlife", "labelKey": "travel.tagNightlife", "icon": "wine-outline", "tone": "pink"},
    ],
    "solo": [
        {"id": "solo", "labelKey": "travel.tagSolo", "icon": "person-outline", "tone": "navy"},
    ],
    "companion": [
        {"id": "travel-buddy", "labelKey": "travel.tagTravelBuddy", "icon": "airplane", "tone": "pink"},
    ],
    "tourGuide": [
        {"id": "travel-buddy", "labelKey": "travel.tagTravelBuddy", "icon": "airplane", "tone": "pink"},
    ],
    "massageSpa": [
        {"id": "casual", "labelKey": "travel.tagCasual", "icon": "heart-outline", "tone": "navy"},
    ],
}


def country_flag(name: str | None) -> tuple[str, str]:
    if not name:
        return ("", "")
    key = name.strip().lower()
    if key in COUNTRY_FLAGS:
        return COUNTRY_FLAGS[key]
    iso = COUNTRY_ISO.get(key, "")
    return ("", iso)


def flag_image_url(code: str | None) -> str:
    iso = (code or "").strip().lower()
    if len(iso) != 2 or not iso.isalpha():
        return ""
    return f"https://flagcdn.com/w80/{iso}.png"


def normalize_country_code(value: str | None) -> str:
    iso = (value or "").strip().lower()
    if len(iso) == 2 and iso.isalpha():
        return iso
    return ""


def resolve_country_visual(
    name: str | None,
    code: str | None = None,
    flag: str | None = None,
) -> tuple[str, str, str]:
    emoji, mapped = country_flag(name)
    iso = normalize_country_code(code) or mapped
    if not emoji and iso:
        for stored_emoji, stored_code in COUNTRY_FLAGS.values():
            if stored_code == iso:
                emoji = stored_emoji
                break
    url = (flag or "").strip() or flag_image_url(iso)
    return emoji, iso, url


def travel_tags_for(trip_type: str | None) -> list[dict[str, str]]:
    if not trip_type:
        return []
    return list(TRAVEL_TRIP_TAGS.get(trip_type, []))


def height_label(cm: int | None) -> str:
    if not cm:
        return ""
    inches = round(cm / 2.54)
    feet, remainder = divmod(inches, 12)
    return f'{feet}\'{remainder}"'


def genders_for_filter(interested_in: list[str] | None) -> list[str] | None:
    if not interested_in:
        return None
    values: list[str] = []
    for item in interested_in:
        values.extend(GENDER_FILTER_VALUES.get(item, [item]))
    return values or None
