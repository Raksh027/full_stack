from datetime import date

from app.core.social_profile import (
    allowed_avatar_url,
    birth_date_iso,
    display_name,
    facebook_picture_url,
    google_people_fields,
    map_provider_gender,
)


def test_display_name_uses_provider_parts_without_blanks():
    assert display_name("Ada", None, "Lovelace") == "Ada Lovelace"
    assert display_name("  ", None) is None


def test_gender_and_birth_date_only_keep_usable_values():
    today = date(2026, 9, 27)
    assert map_provider_gender("female") == "woman"
    assert map_provider_gender("male") == "man"
    assert map_provider_gender("custom") is None
    assert birth_date_iso("02/15/1998", min_age=18, max_age=80, today=today) == "1998-02-15"
    assert birth_date_iso("02/15/2015", min_age=18, max_age=80, today=today) is None
    assert birth_date_iso("02/15", min_age=18, max_age=80, today=today) is None


def test_provider_photos_are_limited_to_known_hosts():
    assert allowed_avatar_url("https://lh3.googleusercontent.com/a/photo")
    assert not allowed_avatar_url("http://lh3.googleusercontent.com/a/photo")
    assert not allowed_avatar_url("https://evil.example/photo.jpg")
    assert facebook_picture_url({"picture": {"data": {"url": "https://fbcdn.net/a.jpg", "is_silhouette": False}}})
    assert facebook_picture_url({"picture": {"data": {"url": "https://fbcdn.net/a.jpg", "is_silhouette": True}}}) is None


def test_google_people_payload_maps_primary_birthday_and_gender():
    fields = google_people_fields(
        {
            "birthdays": [{"metadata": {"primary": True}, "date": {"year": 1994, "month": 6, "day": 3}}],
            "genders": [{"metadata": {"primary": True}, "value": "male"}],
        },
        min_age=18,
        max_age=80,
    )
    assert fields == {"birthDate": "1994-06-03", "gender": "man"}
