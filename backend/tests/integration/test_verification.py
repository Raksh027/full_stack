import uuid

import pytest
from sqlalchemy import select

from app.models.orm import AuditLog, Profile, User
from tests.isolation import IsolatedApp

pytestmark = pytest.mark.integration

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


@pytest.fixture
async def client(isolated_app: IsolatedApp):
    yield isolated_app.http, isolated_app.otp, isolated_app.factory, isolated_app.app


async def _register(client, prefix: str = "ver"):
    http, provider, factory, _app = client
    email = f"{prefix}.{uuid.uuid4().hex[:12]}@boomboom.app"
    password = "password12"
    register = await http.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201
    code = provider.codes["signup:" + email]
    verified = await http.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    token = verified.json()["data"]["accessToken"]
    user_id = verified.json()["data"]["userId"]
    return http, {"Authorization": f"Bearer {token}"}, user_id, factory


async def _promote_reviewer(factory, user_id: str) -> None:
    async with factory() as session:
        user = await session.get(User, uuid.UUID(user_id))
        assert user is not None
        user.role = "REVIEWER"
        await session.commit()


async def _submit_selfie(http, headers) -> dict:
    started = await http.post("/api/v1/verification/start", headers=headers, json={})
    assert started.status_code == 200
    upload = await http.post(
        "/api/v1/verification/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "selfie.jpg", "byteSize": len(JPEG)},
    )
    assert upload.status_code == 200
    data = upload.json()["data"]
    assert "/verification/" in data["storageKey"]
    put = await http.put(data["uploadUrl"], content=JPEG)
    assert put.status_code == 200
    submitted = await http.post(
        "/api/v1/verification/submit",
        headers=headers,
        json={"storageKey": data["storageKey"]},
    )
    assert submitted.status_code == 200
    return submitted.json()["data"]


async def test_verification_requires_auth(client) -> None:
    http, *_ = client
    response = await http.get("/api/v1/verification/status")
    assert response.status_code == 401


async def test_start_is_idempotent_and_status_is_private(client) -> None:
    http, headers, user_id, _factory = await _register(client)
    first = await http.post("/api/v1/verification/start", headers=headers, json={})
    second = await http.post("/api/v1/verification/start", headers=headers, json={})
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["data"]["requestId"] == second.json()["data"]["requestId"]
    assert first.json()["data"]["status"] == "PENDING"
    status = await http.get("/api/v1/verification/status", headers=headers)
    body = status.json()["data"]
    assert body["userId"] == user_id
    assert "reviewerId" not in body
    assert "storageKey" not in body
    assert "notes" not in body
    forged = await http.patch(
        "/api/v1/profile",
        headers=headers,
        json={"isVerified": True, "verificationStatus": "VERIFIED"},
    )
    assert forged.status_code == 200
    mine = await http.get("/api/v1/profile", headers=headers)
    assert mine.json()["data"]["isVerified"] is False
    assert mine.json()["data"]["verificationStatus"] == "PENDING"


async def test_submit_review_approve_and_discovery(client) -> None:
    http, headers, user_id, factory = await _register(client, "ok")
    reviewer_http, reviewer_headers, reviewer_id, _ = await _register(client, "rev")
    await _promote_reviewer(factory, reviewer_id)
    submitted = await _submit_selfie(http, headers)
    assert submitted["status"] == "IN_REVIEW"
    assert submitted["isVerified"] is False
    other = await reviewer_http.get("/api/v1/verification/status", headers=reviewer_headers)
    assert other.json()["data"]["status"] == "NOT_STARTED"
    denied = await reviewer_http.post(
        "/api/v1/verification/review",
        headers=headers,
        json={"requestId": submitted["requestId"], "action": "APPROVE"},
    )
    assert denied.status_code == 403
    approved = await reviewer_http.post(
        "/api/v1/verification/review",
        headers=reviewer_headers,
        json={"requestId": submitted["requestId"], "action": "APPROVE"},
    )
    assert approved.status_code == 200
    assert approved.json()["data"]["isVerified"] is True
    mine = await http.get("/api/v1/profile", headers=headers)
    assert mine.json()["data"]["isVerified"] is True
    public = await reviewer_http.get(f"/api/v1/profiles/{user_id}", headers=reviewer_headers)
    assert public.json()["data"]["isVerified"] is True
    assert "rejectionReasonCode" not in public.json()["data"]
    async with factory() as session:
        profile = (
            await session.execute(select(Profile).where(Profile.user_id == uuid.UUID(user_id)))
        ).scalar_one()
        assert profile.verification_status == "VERIFIED"
        actions = (
            (
                await session.execute(
                    select(AuditLog.action).where(
                        AuditLog.user_id == uuid.UUID(user_id),
                        AuditLog.action.like("VERIFICATION_%"),
                    )
                )
            )
            .scalars()
            .all()
        )
        assert "VERIFICATION_STARTED" in actions
        assert "VERIFICATION_SUBMITTED" in actions
        assert "VERIFICATION_APPROVED" in actions
    inbox = await http.get("/api/v1/notifications", headers=headers)
    types = {item["type"] for item in inbox.json()["data"]["items"]}
    assert "VERIFICATION_SUBMITTED" in types
    assert "VERIFICATION_APPROVED" in types


async def test_reject_retry_keeps_history_and_invalid_media(client) -> None:
    http, headers, user_id, factory = await _register(client, "no")
    reviewer_http, reviewer_headers, reviewer_id, _ = await _register(client, "mod")
    await _promote_reviewer(factory, reviewer_id)
    first = await _submit_selfie(http, headers)
    rejected = await reviewer_http.post(
        "/api/v1/verification/review",
        headers=reviewer_headers,
        json={
            "requestId": first["requestId"],
            "action": "REJECT",
            "reasonCode": "FACE_NOT_VISIBLE",
            "notes": "internal only",
        },
    )
    assert rejected.status_code == 200
    status = await http.get("/api/v1/verification/status", headers=headers)
    body = status.json()["data"]
    assert body["status"] == "REJECTED"
    assert body["isVerified"] is False
    assert body["rejectionReasonCode"] == "FACE_NOT_VISIBLE"
    assert "internal only" not in str(body)
    retry = await http.post("/api/v1/verification/retry", headers=headers, json={})
    assert retry.status_code == 200
    assert retry.json()["data"]["requestId"] != first["requestId"]
    assert retry.json()["data"]["status"] == "PENDING"
    async with factory() as session:
        from app.models.orm import VerificationRequest

        rows = (
            (
                await session.execute(
                    select(VerificationRequest).where(
                        VerificationRequest.user_id == uuid.UUID(user_id)
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(rows) == 2
        assert {row.status for row in rows} == {"REJECTED", "PENDING"}
    upload = await http.post(
        "/api/v1/verification/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "bad.jpg", "byteSize": 12},
    )
    bad = await http.put(upload.json()["data"]["uploadUrl"], content=b"not-an-image")
    assert bad.status_code == 422
    stolen_key = upload.json()["data"]["storageKey"]
    other_http, other_headers, _, _ = await _register(client, "thief")
    await other_http.post("/api/v1/verification/start", headers=other_headers, json={})
    hijack = await other_http.post(
        "/api/v1/verification/submit",
        headers=other_headers,
        json={"storageKey": stolen_key},
    )
    assert hijack.status_code == 403
    public_file = await http.get(f"/api/v1/media/files/{stolen_key}")
    assert public_file.status_code == 404
    attach = await http.post(
        "/api/v1/profile/media",
        headers=headers,
        json={"storageKey": stolen_key},
    )
    assert attach.status_code == 403


async def test_cancel_and_rate_limit_start(client) -> None:
    http, headers, _, _ = await _register(client, "rl")
    started = await http.post("/api/v1/verification/start", headers=headers, json={})
    assert started.status_code == 200
    cancelled = await http.post("/api/v1/verification/cancel", headers=headers)
    assert cancelled.json()["data"]["status"] == "CANCELLED"
    limited = None
    for _ in range(8):
        response = await http.post("/api/v1/verification/start", headers=headers, json={})
        if response.status_code == 429:
            limited = response
            break
    assert limited is not None
