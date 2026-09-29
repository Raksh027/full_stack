from app.core.rate_limit import RATE_LIMIT_POLICIES


def test_rate_limit_policies_cover_required_actions() -> None:
    for key in (
        "registration",
        "login",
        "otp_generation",
        "otp_verification",
        "forgot_password",
        "profile_changes",
        "discovery",
        "likes",
        "chat_requests",
        "messages",
        "reports",
        "verification_start",
        "verification_submit",
        "verification_cancel",
        "verification_retry",
        "verification_status",
        "verification_review",
        "admin_moderate",
        "subscription_verify",
        "subscription_restore",
        "entitlements",
        "events_list",
        "events_mutate",
        "events_rsvp",
    ):
        limit, window = RATE_LIMIT_POLICIES[key]
        assert limit > 0
        assert window > 0


def test_production_auth_policies_are_unchanged() -> None:
    assert RATE_LIMIT_POLICIES["registration"] == (5, 3600)
    assert RATE_LIMIT_POLICIES["login"] == (10, 900)
