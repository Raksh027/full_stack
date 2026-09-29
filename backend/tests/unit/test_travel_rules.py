from datetime import date

from app.core.errors import AppError
from app.core.travel_rules import (
    arriving_in_viewer_place,
    companion_allows,
    hidden_from_country,
    hidden_from_gender,
    iso_travel_date,
    journey_status,
    parse_travel_date,
    passes_creation_filters,
    require_journey_fields,
)


def test_parse_and_normalize_travel_dates() -> None:
    assert parse_travel_date("2026-10-12") == date(2026, 10, 12)
    assert parse_travel_date("Oct 12, 2026") == date(2026, 10, 12)
    assert iso_travel_date("Oct 12, 2026") == "2026-10-12"


def test_journey_status_from_dates() -> None:
    today = date(2026, 9, 27)
    assert journey_status("2026-10-12", "2026-10-18", today) == "upcoming"
    assert journey_status("2026-09-20", "2026-10-02", today) == "active"
    assert journey_status("2026-09-01", "2026-09-10", today) == "landed"


def test_hide_and_companion_rules() -> None:
    assert hidden_from_country(True, "India", "India") is True
    assert hidden_from_country(True, "India", "France") is False
    assert hidden_from_gender("male", "man") is True
    assert hidden_from_gender("female", "man") is False
    assert hidden_from_gender("both", "woman") is True
    assert companion_allows("female", "woman") is True
    assert companion_allows("female", "man") is False
    assert companion_allows("any", "man") is True


def test_creation_filters_use_companion_hide_and_dates() -> None:
    allowed = dict(
        companion="female",
        hide_from_country=True,
        hide_from="male",
        from_country="India",
        departure="2026-10-12",
        return_date="2026-10-18",
        viewer_gender="woman",
        viewer_country="France",
        viewer_nationality="France",
    )
    assert passes_creation_filters(**allowed) is True
    assert passes_creation_filters(**{**allowed, "viewer_gender": "man"}) is False
    assert passes_creation_filters(**{**allowed, "viewer_country": "India"}) is False
    assert (
        passes_creation_filters(
            **{**allowed, "hide_from_country": False, "departure": "2026-01-01", "return_date": "2026-01-08"}
        )
        is False
    )
    assert arriving_in_viewer_place("India", "Delhi", {"india"}) is True
    assert arriving_in_viewer_place("Thailand", "Bangkok", {"india"}) is False


def test_require_journey_fields() -> None:
    try:
        require_journey_fields({"fromCity": "Delhi"})
        raise AssertionError("expected validation error")
    except AppError as error:
        assert error.status_code == 422
    require_journey_fields(
        {
            "fromCity": "Delhi",
            "fromCountry": "India",
            "toCity": "Bangkok",
            "toCountry": "Thailand",
            "departure": "2026-10-12",
            "returnDate": "2026-10-18",
        }
    )
