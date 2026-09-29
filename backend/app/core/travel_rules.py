"""Travel journey dates, status, and who can see an arrival."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.core.discovery_rules import _canon_gender, _canon_orientation
from app.core.errors import AppError

TRIP_TYPES = frozenset(
    {"vacation", "business", "nightlife", "companion", "tourGuide", "massageSpa", "solo"}
)
TRAVEL_STYLES = frozenset({"solo", "group", "backpacker", "couple"})
COMPANIONS = frozenset({"any", "male", "female"})
HIDE_FROM = frozenset({"male", "female", "both"})

_DATE_FORMATS = (
    "%Y-%m-%d",
    "%b %d, %Y",
    "%B %d, %Y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d %Y",
    "%B %d %Y",
)


def parse_travel_date(value: str | None) -> date | None:
    raw = (value or "").strip()
    if not raw:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def iso_travel_date(value: str | None) -> str:
    parsed = parse_travel_date(value)
    return parsed.isoformat() if parsed else (value or "").strip()


def journey_status(
    departure: str | None,
    return_date: str | None,
    today: date | None = None,
) -> str:
    today = today or date.today()
    start = parse_travel_date(departure)
    end = parse_travel_date(return_date) or start
    if start is None:
        return "upcoming"
    if today < start:
        return "upcoming"
    if end is not None and today > end:
        return "landed"
    return "active"


def normalize_trip_type(value: str | None) -> str:
    raw = (value or "vacation").strip()
    if raw not in TRIP_TYPES:
        raise AppError("VALIDATION_ERROR", "Invalid journey type.", 422)
    return raw


def normalize_travel_style(value: str | None) -> str:
    raw = (value or "solo").strip()
    if raw not in TRAVEL_STYLES:
        raise AppError("VALIDATION_ERROR", "Invalid travel style.", 422)
    return raw


def normalize_companion(value: str | None) -> str:
    raw = (value or "any").strip().lower()
    if raw not in COMPANIONS:
        raise AppError("VALIDATION_ERROR", "Invalid companion preference.", 422)
    return raw


def normalize_hide_from(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    raw = str(value).strip().lower()
    if raw not in HIDE_FROM:
        raise AppError("VALIDATION_ERROR", "Invalid hide-from option.", 422)
    return raw


def require_journey_fields(body: dict[str, Any]) -> None:
    required = (
        ("fromCity", "Choose a from city."),
        ("fromCountry", "Choose a from country."),
        ("toCity", "Choose a destination city."),
        ("toCountry", "Choose a destination country."),
        ("departure", "Choose a departure date."),
    )
    for key, message in required:
        if not str(body.get(key) or "").strip():
            raise AppError("VALIDATION_ERROR", message, 422)
    start = parse_travel_date(str(body.get("departure") or ""))
    if start is None:
        raise AppError("VALIDATION_ERROR", "Departure date is invalid.", 422)
    raw_return = str(body.get("returnDate") or "").strip()
    if raw_return:
        end = parse_travel_date(raw_return)
        if end is None:
            raise AppError("VALIDATION_ERROR", "Return date is invalid.", 422)
        if end < start:
            raise AppError("VALIDATION_ERROR", "Return date cannot be before departure.", 422)


def hidden_from_country(hide: bool, from_country: str | None, viewer_country: str | None) -> bool:
    if not hide or not from_country or not viewer_country:
        return False
    return from_country.strip().lower() == viewer_country.strip().lower()


def hidden_from_gender(hide_from: str | None, viewer_gender: str | None) -> bool:
    gender = _canon_gender(viewer_gender)
    hide = (hide_from or "").strip().lower()
    if not hide or not gender:
        return False
    if hide == "both":
        return gender in {"man", "woman"}
    if hide == "male":
        return gender == "man"
    if hide == "female":
        return gender == "woman"
    return False


def same_place(left: str | None, right: str | None) -> bool:
    if not left or not right:
        return False
    return left.strip().lower() == right.strip().lower()


def viewer_home_names(*values: str | None) -> set[str]:
    homes: set[str] = set()
    for value in values:
        raw = (value or "").strip().lower()
        if raw:
            homes.add(raw)
    return homes


def arriving_in_viewer_place(to_country: str | None, to_city: str | None, homes: set[str]) -> bool:
    if not homes:
        return True
    dest_country = (to_country or "").strip().lower()
    dest_city = (to_city or "").strip().lower()
    return dest_country in homes or dest_city in homes


def passes_creation_filters(
    *,
    companion: str | None,
    hide_from_country: bool,
    hide_from: str | None,
    from_country: str | None,
    departure: str | None,
    return_date: str | None,
    viewer_gender: str | None,
    viewer_country: str | None,
    viewer_nationality: str | None,
    viewer_city: str | None = None,
) -> bool:
    """Visibility rules taken only from Create Journey fields."""
    if journey_status(departure, return_date) == "landed":
        return False
    if not companion_allows(companion, viewer_gender):
        return False
    if hidden_from_gender(hide_from, viewer_gender):
        return False
    if hide_from_country:
        homes = viewer_home_names(viewer_country, viewer_nationality, viewer_city)
        origin = (from_country or "").strip().lower()
        if origin and origin in homes:
            return False
    return True


def usable_photo(url: str | None, gender: str | None, seed: int) -> str:
    raw = (url or "").strip()
    if raw.startswith("http") and "example.com" not in raw and "placehold" not in raw:
        return raw
    kind = "women" if (gender or "").lower() in {"woman", "women"} else "men"
    return f"https://randomuser.me/api/portraits/{kind}/{abs(seed) % 90}.jpg"


COVER_PHOTOS = (
    "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1540542719815-6a90f89443f5?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1512453979798-5ea9330edf76?auto=format&fit=crop&w=900&q=80",
)


def usable_cover(url: str | None, gender: str | None, seed: int) -> str:
    raw = (url or "").strip()
    if raw.startswith("http") and "example.com" not in raw and "placehold" not in raw:
        return raw
    portrait = usable_photo(None, gender, seed)
    return COVER_PHOTOS[abs(seed) % len(COVER_PHOTOS)] or portrait


def companion_allows(companion: str | None, viewer_gender: str | None) -> bool:
    wanted = (companion or "any").strip().lower()
    if wanted in {"", "any"}:
        return True
    gender = _canon_gender(viewer_gender)
    if not gender:
        return True
    if wanted == "male":
        return gender == "man"
    if wanted == "female":
        return gender == "woman"
    return True


def passes_travel_audience(prefs: dict[str, Any], card: dict[str, Any]) -> bool:
    """Match dating audience only. Do not apply lifestyle / nationality prefs."""
    interested = prefs.get("interestedIn") or []
    gender = _canon_gender(card.get("gender"))
    wanted_genders = [_canon_gender(item) for item in interested if item]
    wanted_genders = [item for item in wanted_genders if item]
    if wanted_genders and gender and gender not in wanted_genders:
        return False
    wanted_orientations = [
        _canon_orientation(item) for item in (prefs.get("matchOrientations") or []) if item
    ]
    wanted_orientations = [item for item in wanted_orientations if item]
    card_orientation = _canon_orientation(card.get("sexualOrientation"))
    if wanted_orientations and card_orientation and card_orientation not in wanted_orientations:
        return False
    return True
