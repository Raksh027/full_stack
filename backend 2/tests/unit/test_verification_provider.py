from uuid import uuid4

import pytest

from app.core.verification_retention import VerificationRetentionPolicy
from app.core.verification_rules import (
    is_verification_storage_key,
    next_action_for,
    profile_status_from_request,
    public_user_status,
)
from app.services.verification_provider import RecordingVerificationProvider


@pytest.mark.asyncio
async def test_provider_session_submit_and_cancel() -> None:
    provider = RecordingVerificationProvider()
    user_id = uuid4()
    session = await provider.create_verification_session(user_id, "SELFIE_VERIFICATION")
    assert session["status"] == "CREATED"
    submitted = await provider.submit_verification(
        session["sessionId"], ["user/verification/a.jpg"]
    )
    assert submitted["status"] == "SUBMITTED"
    status = await provider.get_verification_status(session["sessionId"])
    assert status["mediaRefs"] == ["user/verification/a.jpg"]
    cancelled = await provider.cancel_verification(session["sessionId"])
    assert cancelled["status"] == "CANCELLED"
    assert provider.calls == ["create", "submit", "status", "cancel"]


@pytest.mark.asyncio
async def test_provider_failure_and_retry() -> None:
    provider = RecordingVerificationProvider()
    provider.fail_next("create")
    with pytest.raises(RuntimeError):
        await provider.create_verification_session(uuid4(), "SELFIE_VERIFICATION")
    session = await provider.create_verification_session(uuid4(), "SELFIE_VERIFICATION")
    assert session["sessionId"]
    provider.fail_next("submit")
    with pytest.raises(RuntimeError):
        await provider.submit_verification(session["sessionId"], [])
    await provider.submit_verification(session["sessionId"], ["k"])
    provider.fail_next("status")
    with pytest.raises(RuntimeError):
        await provider.get_verification_status(session["sessionId"])
    missing = "missing-session"
    with pytest.raises(KeyError):
        await provider.get_verification_status(missing)


def test_retention_does_not_purge_active_or_recent() -> None:
    from datetime import UTC, datetime, timedelta

    policy = VerificationRetentionPolicy(media_retention_days=90)
    now = datetime.now(UTC)
    assert (
        policy.media_eligible_for_purge(
            request_status="IN_REVIEW",
            reviewed_at=None,
            updated_at=now,
            now=now,
        )
        is False
    )
    assert (
        policy.media_eligible_for_purge(
            request_status="APPROVED",
            reviewed_at=now - timedelta(days=10),
            updated_at=now,
            now=now,
        )
        is False
    )
    assert (
        policy.media_eligible_for_purge(
            request_status="REJECTED",
            reviewed_at=now - timedelta(days=91),
            updated_at=now,
            now=now,
        )
        is True
    )


def test_public_status_and_keys() -> None:
    assert public_user_status("UNVERIFIED", None) == "NOT_STARTED"
    assert public_user_status("VERIFIED", "REJECTED") == "APPROVED"
    assert public_user_status("PENDING", "IN_REVIEW") == "IN_REVIEW"
    assert profile_status_from_request("APPROVED", "UNVERIFIED") == "VERIFIED"
    assert profile_status_from_request("PENDING", "UNVERIFIED") == "PENDING"
    assert profile_status_from_request("CANCELLED", "UNVERIFIED") == "UNVERIFIED"
    assert next_action_for("NOT_STARTED") == "START"
    assert next_action_for("REJECTED") == "RETRY"
    user_id = uuid4()
    assert is_verification_storage_key(f"{user_id}/verification/{uuid4()}.jpg")
    assert not is_verification_storage_key(f"{user_id}/{uuid4()}.jpg")
