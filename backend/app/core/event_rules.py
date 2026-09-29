import math
from datetime import datetime
from decimal import Decimal
from uuid import UUID

_FIELD_LABELS = {
    "title": "title",
    "description": "description",
    "location": "location",
    "latitude": "location",
    "longitude": "location",
    "starts_at": "time",
    "ends_at": "time",
    "capacity": "capacity",
    "price": "price",
}


def finite_coordinate(value: float | None) -> float | None:
    if value is None:
        return None
    if not math.isfinite(value):
        raise ValueError("Coordinate must be a finite number.")
    return value


def require_coordinate_pair(latitude: float | None, longitude: float | None) -> None:
    if (latitude is None) != (longitude is None):
        raise ValueError("latitude and longitude must be provided together.")


def event_cover_prefix(user_id: UUID, event_id: UUID) -> str:
    return f"{user_id}/events/{event_id}/"


def is_owned_event_cover_key(user_id: UUID, event_id: UUID, storage_key: str) -> bool:
    normalized = storage_key.replace("\\", "/")
    if ".." in normalized or normalized.startswith("/"):
        return False
    return normalized.startswith(event_cover_prefix(user_id, event_id))


def _norm(value):
    if isinstance(value, datetime):
        aware = value if value.tzinfo is not None else value.replace(tzinfo=None)
        return aware.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, str):
        return value.strip()
    return value


def meaningful_event_changes(before: dict, after: dict) -> list[str]:
    changed: list[str] = []
    for key in _FIELD_LABELS:
        if key not in after:
            continue
        if _norm(before.get(key)) != _norm(after.get(key)):
            changed.append(key)
    return changed


def event_update_summary(changed_fields: list[str]) -> str | None:
    if not changed_fields:
        return None
    labels = {_FIELD_LABELS[field] for field in changed_fields if field in _FIELD_LABELS}
    if labels == {"title"}:
        return "Event title was updated."
    if labels == {"description"}:
        return "Event description was updated."
    if labels == {"location"}:
        return "Event location was updated."
    if labels == {"time"}:
        return "Event time was updated."
    if labels == {"capacity"}:
        return "Event capacity was updated."
    if labels == {"price"}:
        return "Event price was updated."
    return "Event details were updated."
