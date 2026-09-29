from datetime import date

from app.core.profile_rules import age_from_birth_date, birth_date_from_age, parse_location_text
from app.services.storage import sniff_image_type


def test_age_from_birth_date() -> None:
    today = date(2026, 9, 6)
    assert age_from_birth_date(date(2000, 9, 6), today) == 26
    assert age_from_birth_date(date(2000, 9, 7), today) == 25


def test_birth_date_from_age_is_eligible() -> None:
    today = date(2026, 9, 6)
    birth = birth_date_from_age(18, today)
    assert age_from_birth_date(birth, today) == 18
    assert age_from_birth_date(birth_date_from_age(17, today), today) == 17


def test_parse_location_text() -> None:
    assert parse_location_text("Mumbai, India") == ("Mumbai", "India")
    assert parse_location_text("Berlin") == ("Berlin", None)


def test_sniff_image_type() -> None:
    assert sniff_image_type(b"\xff\xd8\xff\xe0rest") == "image/jpeg"
    assert sniff_image_type(b"\x89PNG\r\n\x1a\nrest") == "image/png"
    assert sniff_image_type(b"RIFF....WEBP....") == "image/webp"
    assert sniff_image_type(b"MZ executable") is None
