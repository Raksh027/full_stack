"""Map identity fields returned by Google, Apple, and Facebook onto a profile."""

from __future__ import annotations

import re
from datetime import date
from typing import Any
from urllib.parse import urlparse

_PROVIDER_GENDER = {
    "male": "man",
    "man": "man",
    "m": "man",
    "female": "woman",
    "woman": "woman",
    "f": "woman",
    "nonbinary": "nonbinary",
    "non-binary": "nonbinary",
    "non_binary": "nonbinary",
    "transgender": "transgender",
    "trans": "transgender",
}

_AVATAR_HOSTS = (
    "googleusercontent.com",
    "ggpht.com",
    "graph.facebook.com",
    "facebook.com",
    "fbcdn.net",
    "fbsbx.com",
)

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_US_DATE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")


def display_name(*parts: str | None) -> str | None:
    name = " ".join(part.strip() for part in parts if part and part.strip())
    name = " ".join(name.split())
    return name[:80] or None


def map_provider_gender(value: str | None) -> str | None:
    if not value:
        return None
    return _PROVIDER_GENDER.get(value.strip().lower())


def birth_date_iso(value: str | None, *, min_age: int, max_age: int, today: date | None = None) -> str | None:
    """Return YYYY-MM-DD when the provider date is complete and age-eligible."""
    if not value:
        return None
    text = value.strip()
    iso = text if _ISO_DATE.match(text) else None
    if iso is None:
        match = _US_DATE.match(text)
        if match is None:
            return None
        month, day, year = (int(part) for part in match.groups())
        iso = f"{year:04d}-{month:02d}-{day:02d}"
    try:
        parsed = date.fromisoformat(iso)
    except ValueError:
        return None
    current = today or date.today()
    age = current.year - parsed.year - ((current.month, current.day) < (parsed.month, parsed.day))
    if age < min_age or age > max_age:
        return None
    return iso


def birth_date_from_parts(year: Any, month: Any, day: Any, *, min_age: int, max_age: int) -> str | None:
    try:
        iso = f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    except (TypeError, ValueError):
        return None
    return birth_date_iso(iso, min_age=min_age, max_age=max_age)


def allowed_avatar_url(url: str | None) -> bool:
    if not url:
        return False
    parsed = urlparse(url.strip())
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and any(host == item or host.endswith(f".{item}") for item in _AVATAR_HOSTS)


def facebook_picture_url(profile: dict[str, Any]) -> str | None:
    picture = profile.get("picture")
    data = picture.get("data") if isinstance(picture, dict) else None
    if not isinstance(data, dict) or data.get("is_silhouette"):
        return None
    url = str(data.get("url") or "").strip()
    return url or None


def google_people_fields(payload: dict[str, Any], *, min_age: int, max_age: int) -> dict[str, str | None]:
    birthdays = payload.get("birthdays") if isinstance(payload.get("birthdays"), list) else []
    chosen = next(
        (item for item in birthdays if isinstance(item, dict) and (item.get("metadata") or {}).get("primary")),
        birthdays[0] if birthdays else None,
    )
    birth = None
    if isinstance(chosen, dict):
        parts = chosen.get("date") if isinstance(chosen.get("date"), dict) else {}
        birth = birth_date_from_parts(parts.get("year"), parts.get("month"), parts.get("day"), min_age=min_age, max_age=max_age)
    genders = payload.get("genders") if isinstance(payload.get("genders"), list) else []
    gender_row = next(
        (item for item in genders if isinstance(item, dict) and (item.get("metadata") or {}).get("primary")),
        genders[0] if genders else None,
    )
    gender = map_provider_gender(str(gender_row.get("value")) if isinstance(gender_row, dict) else None)
    return {"birthDate": birth, "gender": gender}
