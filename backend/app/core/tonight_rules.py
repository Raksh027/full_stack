"""Free Tonight activity keys used by the mobile app."""

from __future__ import annotations

TONIGHT_ACTIVITIES = frozenset(
    {"dinner", "drinks", "partyBuddy", "cityTour", "dating"}
)

_ACTIVITY_ALIASES = {
    "dinner": "dinner",
    "food": "dinner",
    "eat": "dinner",
    "drinks": "drinks",
    "drink": "drinks",
    "coffee": "drinks",
    "bar": "drinks",
    "cocktails": "drinks",
    "partybuddy": "partyBuddy",
    "party": "partyBuddy",
    "club": "partyBuddy",
    "nightlife": "partyBuddy",
    "citytour": "cityTour",
    "city": "cityTour",
    "walk": "cityTour",
    "tour": "cityTour",
    "dating": "dating",
    "date": "dating",
}

DEFAULT_LOOKING_FOR = {
    "dinner": "Good conversation over dinner — kind, interesting, and easy to talk to.",
    "drinks": "A relaxed drinks meetup with someone witty and easygoing.",
    "partyBuddy": "Good vibes, music, and someone who can keep up with the night.",
    "cityTour": "Someone chill to explore cafes, markets, and late-night street food.",
    "dating": "Someone genuine for dinner, laughs, and maybe a little spark.",
}


def normalize_tonight_activity(value: str | None, default: str = "dating") -> str:
    raw = (value or "").strip()
    if raw in TONIGHT_ACTIVITIES:
        return raw
    key = "".join(ch for ch in raw.lower() if ch.isalnum())
    mapped = _ACTIVITY_ALIASES.get(key)
    if mapped:
        return mapped
    return default if default in TONIGHT_ACTIVITIES else "dating"


def default_looking_for(activity: str | None) -> str:
    key = normalize_tonight_activity(activity)
    return DEFAULT_LOOKING_FOR[key]


def stored_activity_values(activity: str | None) -> list[str] | None:
    raw = (activity or "").strip()
    if not raw or raw == "all":
        return None
    canonical = normalize_tonight_activity(raw)
    values = {canonical, raw}
    for alias, mapped in _ACTIVITY_ALIASES.items():
        if mapped == canonical:
            values.add(alias)
            values.add(mapped)
    return list(values)
