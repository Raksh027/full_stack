from datetime import date

from app.core.discovery_rules import (
    audience_from_profile,
    birth_date_bounds,
    profile_genders_for_filter,
)


def test_birth_date_bounds() -> None:
    today = date(2026, 9, 6)
    oldest, youngest = birth_date_bounds(21, 35, today)
    assert youngest == date(2005, 9, 6)
    assert oldest == date(1990, 9, 6)


def test_gender_filter_mapping() -> None:
    assert profile_genders_for_filter("Everyone") is None
    assert profile_genders_for_filter("Women") == ["Woman", "woman"]
    assert profile_genders_for_filter("Men") == ["Man", "man"]
    assert profile_genders_for_filter("Non-binary") == ["Non-Binary", "Non-binary", "nonbinary"]


def test_straight_audience_uses_opposite_gender() -> None:
    assert audience_from_profile("man", "straight") == {
        "gender_filter": "Women",
        "interested_in": ["woman"],
        "orientations": None,
    }
    assert audience_from_profile("woman", "straight") == {
        "gender_filter": "Men",
        "interested_in": ["man"],
        "orientations": None,
    }


def test_non_straight_audience_uses_selected_orientation() -> None:
    assert audience_from_profile("man", "gay") == {
        "gender_filter": "Everyone",
        "interested_in": None,
        "orientations": ["gay"],
    }
    assert audience_from_profile("woman", "lesbian")["orientations"] == ["lesbian"]
    assert audience_from_profile("man", "bisexual")["orientations"] == ["bisexual"]
