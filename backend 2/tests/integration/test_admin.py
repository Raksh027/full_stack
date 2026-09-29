import uuid

import pytest
from sqlalchemy import select

from app.models.orm import AuditLog, User
from tests.isolation import IsolatedApp

pytestmark = pytest.mark.integration


@pytest.fixture
async def env(isolated_app: IsolatedApp):
    yield isolated_app


async def _register(env: IsolatedApp, prefix: str = "adm"):
    email = f"{prefix}.{uuid.uuid4().hex[:10]}@boomboom.app"
    password = "password12"
    register = await env.http.post(
        "/api/v1/auth/register", json={"email": email, "password": password}
    )
    assert register.status_code == 201
    code = env.otp.codes["signup:" + email]
    verified = await env.http.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    token = verified.json()["data"]["accessToken"]
    user_id = verified.json()["data"]["userId"]
    return {"Authorization": f"Bearer {token}"}, user_id


async def _set_role(env: IsolatedApp, user_id: str, role: str) -> None:
    async with env.factory() as session:
        user = await session.get(User, uuid.UUID(user_id))
        assert user is not None
        user.role = role
        await session.commit()


async def test_user_cannot_access_admin(env) -> None:
    headers, _ = await _register(env, "usr")
    response = await env.http.get("/api/v1/admin/dashboard", headers=headers)
    assert response.status_code == 403


async def test_reviewer_can_review_but_cannot_ban(env) -> None:
    user_headers, user_id = await _register(env, "tgt")
    rev_headers, rev_id = await _register(env, "rev")
    await _set_role(env, rev_id, "REVIEWER")
    started = await env.http.post("/api/v1/verification/start", headers=user_headers, json={})
    request_id = started.json()["data"]["requestId"]
    queue = await env.http.get("/api/v1/admin/verification/queue", headers=rev_headers)
    assert queue.status_code == 200, queue.text
    assert any(item["id"] == request_id for item in queue.json()["data"]["items"])
    claimed = await env.http.post(
        f"/api/v1/admin/verification/{request_id}/review",
        headers=rev_headers,
        json={"action": "START_REVIEW"},
    )
    assert claimed.status_code == 200
    second, second_id = await _register(env, "rev2")
    await _set_role(env, second_id, "REVIEWER")
    conflict = await env.http.post(
        f"/api/v1/admin/verification/{request_id}/review",
        headers=second,
        json={"action": "APPROVE"},
    )
    assert conflict.status_code == 409
    banned = await env.http.post(f"/api/v1/admin/users/{user_id}/ban", headers=rev_headers)
    assert banned.status_code == 403


async def test_admin_report_ban_and_privacy(env) -> None:
    reporter_headers, reporter_id = await _register(env, "rep")
    target_headers, target_id = await _register(env, "bad")
    admin_headers, admin_id = await _register(env, "god")
    await _set_role(env, admin_id, "ADMIN")

    created = await env.http.post(
        "/api/v1/reports",
        headers=reporter_headers,
        json={"reportedUserId": target_id, "reason": "Harassment or abuse"},
    )
    assert created.status_code == 201
    report_id = created.json()["data"]["id"]
    again = await env.http.post(
        "/api/v1/reports",
        headers=reporter_headers,
        json={"reportedUserId": target_id, "reason": "HARASSMENT"},
    )
    assert again.json()["data"]["id"] == report_id
    assert again.json()["data"]["created"] is False

    leaked = await env.http.get("/api/v1/admin/reports", headers=target_headers)
    assert leaked.status_code == 403
    listed = await env.http.get("/api/v1/admin/reports", headers=admin_headers)
    assert listed.status_code == 200
    item = listed.json()["data"]["items"][0]
    assert item["reporterId"] == reporter_id
    detail = await env.http.get(f"/api/v1/admin/reports/{report_id}", headers=admin_headers)
    assert detail.status_code == 200
    resolved = await env.http.post(
        f"/api/v1/admin/reports/{report_id}/resolve",
        headers=admin_headers,
        json={"resolutionCode": "WARN"},
    )
    assert resolved.status_code == 200

    banned = await env.http.post(
        f"/api/v1/admin/users/{target_id}/ban",
        headers=admin_headers,
        json={"reason": "abuse"},
    )
    assert banned.status_code == 200, banned.text
    login = await env.http.post(
        "/api/v1/auth/login",
        json={"email": "unused@boomboom.app", "password": "password12"},
    )
    _ = login
    like = await env.http.post(
        "/api/v1/likes", headers=target_headers, json={"userId": reporter_id}
    )
    assert like.status_code in {401, 403}
    dash = await env.http.get("/api/v1/admin/dashboard", headers=admin_headers)
    assert dash.json()["data"]["bannedUsers"] >= 1
    logs = await env.http.get("/api/v1/admin/audit-logs", headers=admin_headers)
    actions = {item["action"] for item in logs.json()["data"]["items"]}
    assert "USER_BANNED" in actions
    assert "REPORT_CREATED" in actions or "REPORT_RESOLVED" in actions
    async with env.factory() as session:
        rows = (
            (await session.execute(select(AuditLog.action).where(AuditLog.action == "USER_BANNED")))
            .scalars()
            .all()
        )
        assert rows


async def test_self_report_rejected_and_suspend_restore(env) -> None:
    headers, user_id = await _register(env, "self")
    other_headers, other_id = await _register(env, "oth")
    admin_headers, admin_id = await _register(env, "adm2")
    await _set_role(env, admin_id, "ADMIN")
    self_report = await env.http.post(
        "/api/v1/reports",
        headers=headers,
        json={"reportedUserId": user_id, "reasonCode": "SPAM"},
    )
    assert self_report.status_code in {400, 403, 422}
    created = await env.http.post(
        "/api/v1/reports",
        headers=headers,
        json={"reportedUserId": other_id, "reasonCode": "SPAM"},
    )
    report_id = created.json()["data"]["id"]
    assigned = await env.http.post(
        f"/api/v1/admin/reports/{report_id}/assign",
        headers=admin_headers,
        json={},
    )
    assert assigned.status_code == 200
    dismissed = await env.http.post(
        f"/api/v1/admin/reports/{report_id}/dismiss",
        headers=admin_headers,
        json={"notes": "no violation"},
    )
    assert dismissed.status_code == 200
    suspended = await env.http.post(
        f"/api/v1/admin/users/{other_id}/suspend",
        headers=admin_headers,
        json={"hours": 24, "reason": "temp"},
    )
    assert suspended.status_code == 200
    again = await env.http.post(
        f"/api/v1/admin/users/{other_id}/suspend",
        headers=admin_headers,
        json={"hours": 24, "reason": "temp"},
    )
    assert again.status_code == 200
    restored = await env.http.post(
        f"/api/v1/admin/users/{other_id}/restore",
        headers=admin_headers,
    )
    assert restored.status_code == 200
    assert restored.json()["data"]["status"] == "ACTIVE"


async def test_reviewer_cannot_resolve_report(env) -> None:
    reporter_headers, _ = await _register(env, "rpa")
    _, target_id = await _register(env, "rpb")
    rev_headers, rev_id = await _register(env, "rpr")
    await _set_role(env, rev_id, "REVIEWER")
    created = await env.http.post(
        "/api/v1/reports",
        headers=reporter_headers,
        json={"reportedUserId": target_id, "reasonCode": "SCAM"},
    )
    report_id = created.json()["data"]["id"]
    listed = await env.http.get("/api/v1/admin/reports", headers=rev_headers)
    assert listed.status_code == 200
    resolve = await env.http.post(
        f"/api/v1/admin/reports/{report_id}/resolve",
        headers=rev_headers,
        json={"resolutionCode": "WARN"},
    )
    assert resolve.status_code == 403
