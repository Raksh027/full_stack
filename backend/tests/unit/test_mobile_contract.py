from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.mobile_maps import country_flag, height_label, travel_tags_for
from app.core.tonight_rules import normalize_tonight_activity
from app.services.presenters import default_discovery_preferences, passes_viewer_filters


def test_mobile_contract_paths_exist() -> None:
    app = FastAPI()
    app.include_router(api_router)
    paths = app.openapi()["paths"]
    assert "/api/v1/auth/otp/request" in paths
    assert "/api/v1/auth/otp/verify" in paths
    assert "/api/v1/auth/google" in paths
    assert "/api/v1/auth/apple" in paths
    assert "/api/v1/auth/facebook" in paths
    assert "/api/v1/profiles/me" in paths
    assert "/api/v1/profiles/me/onboarding/complete" in paths
    assert "/api/v1/discovery/feed" in paths
    assert "/api/v1/discovery/map" in paths
    assert "/api/v1/discovery/swipes" in paths
    assert "/api/v1/likes/received" in paths
    assert "/api/v1/likes/sent" in paths
    assert "/api/v1/likes/viewed" in paths
    assert "/api/v1/users/me" in paths
    assert "/api/v1/users/me/discovery-preferences" in paths
    assert "/api/v1/users/me/notification-settings" in paths
    assert "/api/v1/tonight" in paths
    assert "/api/v1/tonight/me" in paths
    assert "/api/v1/travel/journeys" in paths
    assert "/api/v1/devices" in paths
    assert "/api/v1/safety/reports" in paths
    assert "/api/v1/travel/arrivals" in paths
    assert "/api/v1/travel/countries" in paths
    assert "/api/v1/travel/arrivals/{arrival_id}" in paths
    assert "/api/v1/travel/journeys/{journey_id}" in paths
    assert "/api/v1/verification/start" in paths
    assert "/api/v1/verification/submit" in paths


def test_country_flag_and_height_helpers() -> None:
    assert country_flag("India") == ("🇮🇳", "in")
    assert country_flag(None) == ("", "")
    assert height_label(183).startswith("6'")
    assert travel_tags_for("nightlife")[0]["id"] == "nightlife"


def test_tonight_activity_aliases() -> None:
    from app.core.tonight_rules import stored_activity_values

    assert normalize_tonight_activity("party") == "partyBuddy"
    assert normalize_tonight_activity("coffee") == "drinks"
    assert normalize_tonight_activity("walk") == "cityTour"
    assert normalize_tonight_activity("cityTour") == "cityTour"
    assert normalize_tonight_activity("dating") == "dating"
    values = stored_activity_values("party")
    assert values is not None
    assert "partyBuddy" in values
    assert "party" in values
    assert stored_activity_values("all") is None


def test_discovery_filters_apply_to_cards() -> None:
    prefs = default_discovery_preferences()
    woman = {
        "age": 24,
        "gender": "woman",
        "isVerified": True,
        "isOnline": True,
        "relationshipGoal": "casual",
        "lifestyle": {"bodyType": "athletic", "drinking": "social"},
        "interests": ["travel"],
        "languages": ["english"],
        "workCategory": "tech",
        "nationality": "India",
    }
    assert passes_viewer_filters(prefs, woman)
    prefs["interestedIn"] = ["man"]
    assert passes_viewer_filters(prefs, woman) is False
    prefs["interestedIn"] = ["woman"]
    prefs["bodyTypes"] = ["slim"]
    assert passes_viewer_filters(prefs, woman) is False
    prefs["bodyTypes"] = ["athletic"]
    assert passes_viewer_filters(prefs, woman) is True


def test_orientation_audience_filters_cards() -> None:
    from types import SimpleNamespace

    from app.services.presenters import apply_orientation_audience

    prefs = default_discovery_preferences()
    apply_orientation_audience(prefs, SimpleNamespace(gender="man", orientation="straight"))
    assert prefs["interestedIn"] == ["woman"]
    woman = {"age": 24, "gender": "woman", "sexualOrientation": "straight"}
    man = {"age": 24, "gender": "man", "sexualOrientation": "straight"}
    assert passes_viewer_filters(prefs, woman) is True
    assert passes_viewer_filters(prefs, man) is False

    gay_prefs = default_discovery_preferences()
    apply_orientation_audience(gay_prefs, SimpleNamespace(gender="man", orientation="gay"))
    assert gay_prefs["matchOrientations"] == ["gay"]
    assert gay_prefs["interestedIn"] == []
    assert passes_viewer_filters(gay_prefs, {"age": 24, "gender": "man", "sexualOrientation": "gay"})
    assert (
        passes_viewer_filters(
            gay_prefs, {"age": 24, "gender": "woman", "sexualOrientation": "straight"}
        )
        is False
    )


def test_user_notify_channel() -> None:
    from uuid import uuid4

    from app.core.realtime import user_notify_channel

    user_id = uuid4()
    assert user_notify_channel(user_id) == f"notify:user:{user_id}"


def test_notification_settings_visibility() -> None:
    from app.models.orm import NotificationPreference, NotificationType
    from app.services.notifications import notification_visible

    prefs = NotificationPreference()
    prefs.all_enabled = True
    prefs.likes = True
    prefs.matches = True
    prefs.profile_views = True
    prefs.messages = True
    prefs.general = True
    assert notification_visible(prefs, NotificationType.LIKE_RECEIVED.value)
    assert notification_visible(prefs, NotificationType.OFFER_RECEIVED.value)
    prefs.likes = False
    assert notification_visible(prefs, NotificationType.LIKE_RECEIVED.value) is False
    assert notification_visible(prefs, NotificationType.OFFER_RECEIVED.value) is False
    prefs.likes = True
    prefs.all_enabled = False
    assert notification_visible(prefs, NotificationType.MATCH_CREATED.value) is True
    prefs.matches = False
    assert notification_visible(prefs, NotificationType.MATCH_CREATED.value) is False
    prefs.matches = True
    prefs.profile_views = False
    assert notification_visible(prefs, NotificationType.PROFILE_VIEW.value) is False


def test_online_and_new_windows() -> None:
    from datetime import UTC, datetime, timedelta

    from app.services.presenters import is_new_profile, is_online

    now = datetime.now(UTC)
    assert is_online(now - timedelta(minutes=10)) is True
    assert is_online(now - timedelta(minutes=25)) is False
    assert is_new_profile(now - timedelta(hours=24)) is True
    assert is_new_profile(now - timedelta(hours=80)) is False
