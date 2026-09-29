from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.event_rules import is_owned_event_cover_key
from app.schemas.events import EventCoverAttachRequest, EventCreateRequest, EventUpdateRequest


def test_event_create_rejects_ends_before_starts() -> None:
    starts = datetime.now(UTC)
    with pytest.raises(ValidationError):
        EventCreateRequest(
            title="Party",
            location="Goa",
            startsAt=starts,
            endsAt=starts - timedelta(hours=1),
        )


def test_event_create_accepts_valid_coordinates() -> None:
    starts = datetime.now(UTC)
    body = EventCreateRequest(
        title="Party",
        location="Goa",
        startsAt=starts,
        endsAt=starts + timedelta(hours=2),
        latitude=15.2993,
        longitude=74.124,
    )
    assert body.latitude == 15.2993
    assert body.longitude == 74.124


def test_event_create_rejects_coordinate_pair_mismatch() -> None:
    starts = datetime.now(UTC)
    with pytest.raises(ValidationError):
        EventCreateRequest(
            title="Party",
            location="Goa",
            startsAt=starts,
            endsAt=starts + timedelta(hours=2),
            latitude=15.3,
        )


def test_event_create_rejects_non_finite_coordinates() -> None:
    starts = datetime.now(UTC)
    with pytest.raises(ValidationError):
        EventCreateRequest(
            title="Party",
            location="Goa",
            startsAt=starts,
            endsAt=starts + timedelta(hours=2),
            latitude=float("nan"),
            longitude=74.1,
        )
    with pytest.raises(ValidationError):
        EventCreateRequest(
            title="Party",
            location="Goa",
            startsAt=starts,
            endsAt=starts + timedelta(hours=2),
            latitude=15.3,
            longitude=float("inf"),
        )


def test_event_update_rejects_invalid_coordinates() -> None:
    with pytest.raises(ValidationError):
        EventUpdateRequest(latitude=91, longitude=74)
    with pytest.raises(ValidationError):
        EventUpdateRequest(latitude=15.3, longitude=181)
    with pytest.raises(ValidationError):
        EventUpdateRequest(latitude=15.3)


def test_event_create_rejects_invalid_coordinates() -> None:
    starts = datetime.now(UTC)
    ends = starts + timedelta(hours=2)
    with pytest.raises(ValidationError):
        EventCreateRequest(
            title="Party",
            location="Goa",
            startsAt=starts,
            endsAt=ends,
            latitude=91,
        )
    with pytest.raises(ValidationError):
        EventCreateRequest(
            title="Party",
            location="Goa",
            startsAt=starts,
            endsAt=ends,
            longitude=181,
        )


def test_event_create_rejects_non_positive_capacity() -> None:
    starts = datetime.now(UTC)
    with pytest.raises(ValidationError):
        EventCreateRequest(
            title="Party",
            location="Goa",
            startsAt=starts,
            endsAt=starts + timedelta(hours=1),
            capacity=0,
        )


def test_event_update_validates_title() -> None:
    with pytest.raises(ValidationError):
        EventUpdateRequest(title="   ")


def test_event_create_ignores_client_cover_url() -> None:
    starts = datetime.now(UTC)
    payload = EventCreateRequest(
        title="Party",
        location="Goa",
        startsAt=starts,
        endsAt=starts + timedelta(hours=1),
        coverImageUrl="https://evil.example/cover.jpg",
        coverStorageKey="not-a-server-key",
    )
    dumped = payload.model_dump()
    assert "cover_image_url" not in dumped
    assert "cover_storage_key" not in dumped


def test_cover_attach_requires_storage_key() -> None:
    with pytest.raises(ValidationError):
        EventCoverAttachRequest(storageKey="  ")
    body = EventCoverAttachRequest(storageKey="user/events/id/a.jpg")
    assert body.storage_key == "user/events/id/a.jpg"


def test_owned_event_cover_key_is_event_scoped() -> None:
    user_id = uuid4()
    event_id = uuid4()
    other = uuid4()
    assert is_owned_event_cover_key(user_id, event_id, f"{user_id}/events/{event_id}/a.jpg")
    assert not is_owned_event_cover_key(user_id, event_id, f"{user_id}/events/{other}/a.jpg")
    assert not is_owned_event_cover_key(user_id, event_id, f"{other}/events/{event_id}/a.jpg")
    assert not is_owned_event_cover_key(user_id, event_id, f"{user_id}/{event_id}.jpg")
    assert not is_owned_event_cover_key(user_id, event_id, f"{user_id}/verification/a.jpg")
    assert not is_owned_event_cover_key(user_id, event_id, f"{user_id}/events/{event_id}/../x.jpg")
