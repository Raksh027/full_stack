from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.core.event_rules import event_update_summary, meaningful_event_changes


def _base(**overrides):
    starts = datetime(2026, 9, 20, 18, 0, tzinfo=UTC)
    body = {
        "title": "Sunset Mixer",
        "description": "Meet nearby people.",
        "location": "Goa",
        "latitude": None,
        "longitude": None,
        "starts_at": starts,
        "ends_at": starts + timedelta(hours=3),
        "capacity": 20,
        "price": Decimal("0"),
    }
    body.update(overrides)
    return body


def test_no_changes_means_no_summary() -> None:
    before = _base()
    assert meaningful_event_changes(before, _base()) == []
    assert event_update_summary([]) is None


def test_single_field_summaries() -> None:
    before = _base()
    assert event_update_summary(meaningful_event_changes(before, _base(title="New"))) == (
        "Event title was updated."
    )
    assert event_update_summary(
        meaningful_event_changes(before, _base(description="Updated copy"))
    ) == "Event description was updated."
    assert event_update_summary(
        meaningful_event_changes(before, _base(location="Mumbai"))
    ) == "Event location was updated."
    assert event_update_summary(
        meaningful_event_changes(before, _base(latitude=15.3, longitude=73.8))
    ) == "Event location was updated."
    later = before["starts_at"] + timedelta(hours=1)
    assert event_update_summary(
        meaningful_event_changes(before, _base(starts_at=later, ends_at=later + timedelta(hours=3)))
    ) == "Event time was updated."
    assert event_update_summary(meaningful_event_changes(before, _base(capacity=30))) == (
        "Event capacity was updated."
    )
    assert event_update_summary(meaningful_event_changes(before, _base(price=Decimal("10")))) == (
        "Event price was updated."
    )


def test_multiple_fields_use_generic_summary() -> None:
    before = _base()
    changed = meaningful_event_changes(before, _base(title="New", location="Mumbai"))
    assert event_update_summary(changed) == "Event details were updated."
