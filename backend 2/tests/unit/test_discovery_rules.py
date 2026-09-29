from datetime import date

from app.core.discovery_rules import birth_date_bounds, profile_genders_for_filter


def test_birth_date_bounds() -> None:
    today = date(2026, 9, 6)
    oldest, youngest = birth_date_bounds(21, 35, today)
    assert youngest == date(2005, 9, 6)
    assert oldest == date(1990, 9, 6)


def test_gender_filter_mapping() -> None:
    assert profile_genders_for_filter("Everyone") is None
    assert profile_genders_for_filter("Women") == ["Woman"]
    assert profile_genders_for_filter("Men") == ["Man"]
    assert profile_genders_for_filter("Non-binary") == ["Non-Binary"]
