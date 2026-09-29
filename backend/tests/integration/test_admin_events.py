import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.orm import AuditLog, SocialEvent, User

pytestmark = pytest.mark.integration

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


def _payload(**overrides):
    starts = datetime.now(UTC) + timedelta(days=2)
    body = {
        "title": "Sunset Mixer",
        "description": "Meet nearby people.",
        "location": "Goa",
        "startsAt": starts.isoformat(),
        "endsAt": (starts + timedelta(hours=3)).isoformat(),
        "price": 0,
        "capacity": 20,
    }
    body.update(overrides)
    return body


async def _register(env, prefix: str):
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


async def _set_role(env, user_id: str, role: str) -> None:
    async with env.factory() as session:
        user = await session.get(User, uuid.UUID(user_id))
        assert user is not None
        user.role = role
        await session.commit()


async def test_reviewer_can_list_and_view_event_but_cannot_hide(isolated_app) -> None:
    env = isolated_app
    host_headers, _host_id = await _register(env, "eh")
    rev_headers, rev_id = await _register(env, "erv")
    user_headers, _uid = await _register(env, "eusr")
    await _set_role(env, rev_id, "REVIEWER")
    created = await env.http.post("/api/v1/events", json=_payload(), headers=host_headers)
    event_id = created.json()["data"]["id"]

    denied = await env.http.get("/api/v1/admin/events", headers=user_headers)
    assert denied.status_code == 403
    unauth = await env.http.get("/api/v1/admin/events")
    assert unauth.status_code == 401

    listed = await env.http.get("/api/v1/admin/events", headers=rev_headers)
    assert listed.status_code == 200
    items = listed.json()["data"]["items"]
    assert any(row["id"] == event_id for row in items)
    match = next(row for row in items if row["id"] == event_id)
    assert match["title"] == "Sunset Mixer"
    assert match["hostId"]
    assert match["hostName"]
    assert match["status"] == "PUBLISHED"
    assert "reporterId" not in match
    assert "email" not in match

    detail = await env.http.get(f"/api/v1/admin/events/{event_id}", headers=rev_headers)
    assert detail.status_code == 200
    body = detail.json()["data"]
    assert body["description"] == "Meet nearby people."
    assert body["attendeeCount"] == 0
    assert "reports" in body

    hidden = await env.http.post(f"/api/v1/admin/events/{event_id}/hide", headers=rev_headers)
    assert hidden.status_code == 403


async def test_admin_hides_event_from_public_and_blocks_host(isolated_app) -> None:
    env = isolated_app
    host_headers, host_id = await _register(env, "ah")
    guest_headers, _guest_id = await _register(env, "ag")
    other_headers, _oid = await _register(env, "ao")
    admin_headers, admin_id = await _register(env, "aa")
    await _set_role(env, admin_id, "ADMIN")

    created = await env.http.post("/api/v1/events", json=_payload(), headers=host_headers)
    event_id = created.json()["data"]["id"]
    other = await env.http.post(
        "/api/v1/events", json=_payload(title="Keep Me"), headers=other_headers
    )
    other_id = other.json()["data"]["id"]

    hidden = await env.http.post(
        f"/api/v1/admin/events/{event_id}/hide",
        headers=admin_headers,
        json={"reason": "policy"},
    )
    assert hidden.status_code == 200
    assert hidden.json()["data"]["status"] == "HIDDEN"

    listed = await env.http.get("/api/v1/events", headers=guest_headers)
    ids = {row["id"] for row in listed.json()["data"]["items"]}
    assert event_id not in ids
    assert other_id in ids

    public = await env.http.get(f"/api/v1/events/{event_id}", headers=guest_headers)
    assert public.status_code == 404
    host_view = await env.http.get(f"/api/v1/events/{event_id}", headers=host_headers)
    assert host_view.status_code == 404

    rsvp = await env.http.post(f"/api/v1/events/{event_id}/rsvp", headers=guest_headers)
    assert rsvp.status_code == 409
    assert rsvp.json()["error"]["code"] == "EVENT_HIDDEN"

    patch = await env.http.patch(
        f"/api/v1/events/{event_id}",
        headers=host_headers,
        json={"title": "Still public"},
    )
    assert patch.status_code == 409
    cover = await env.http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=host_headers,
        json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": len(JPEG)},
    )
    assert cover.status_code == 409

    restored = await env.http.post(
        f"/api/v1/admin/events/{event_id}/restore",
        headers=admin_headers,
        json={"reason": "mistake"},
    )
    assert restored.status_code == 200
    assert restored.json()["data"]["status"] == "PUBLISHED"
    again = await env.http.get(f"/api/v1/events/{event_id}", headers=guest_headers)
    assert again.status_code == 200

    async with env.factory() as session:
        actions = (
            await session.execute(
                select(AuditLog.action).where(
                    AuditLog.target_id == uuid.UUID(event_id),
                    AuditLog.action.in_(("EVENT_HIDDEN", "EVENT_RESTORED")),
                )
            )
        ).scalars().all()
        assert "EVENT_HIDDEN" in actions
        assert "EVENT_RESTORED" in actions
        other_event = await session.get(SocialEvent, uuid.UUID(other_id))
        assert other_event is not None
        assert other_event.status == "PUBLISHED"
        _ = host_id


async def test_admin_cover_removal_is_event_scoped(isolated_app) -> None:
    env = isolated_app
    host_headers, _host_id = await _register(env, "ch")
    other_headers, _oid = await _register(env, "co")
    admin_headers, admin_id = await _register(env, "ca")
    await _set_role(env, admin_id, "ADMIN")

    created = await env.http.post("/api/v1/events", json=_payload(), headers=host_headers)
    event_id = created.json()["data"]["id"]
    other = await env.http.post(
        "/api/v1/events", json=_payload(title="Other Mixer"), headers=other_headers
    )
    other_id = other.json()["data"]["id"]

    async def attach(headers, eid):
        signed = await env.http.post(
            f"/api/v1/events/{eid}/cover/upload-url",
            headers=headers,
            json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": len(JPEG)},
        )
        data = signed.json()["data"]
        await env.http.put(data["uploadUrl"], content=JPEG)
        attached = await env.http.post(
            f"/api/v1/events/{eid}/cover",
            headers=headers,
            json={"storageKey": data["storageKey"]},
        )
        assert attached.status_code == 200
        return data["storageKey"]

    first_key = await attach(host_headers, event_id)
    other_key = await attach(other_headers, other_id)

    removed = await env.http.post(
        f"/api/v1/admin/events/{event_id}/cover/remove",
        headers=admin_headers,
        json={"reason": "nsfw"},
    )
    assert removed.status_code == 200
    detail = await env.http.get(f"/api/v1/admin/events/{event_id}", headers=admin_headers)
    assert detail.json()["data"]["coverStorageKey"] is None
    other_detail = await env.http.get(f"/api/v1/admin/events/{other_id}", headers=admin_headers)
    assert other_detail.json()["data"]["coverStorageKey"] == other_key
    assert other_detail.json()["data"]["coverImageUrl"]

    async with env.factory() as session:
        logs = (
            await session.execute(
                select(AuditLog).where(AuditLog.action == "EVENT_COVER_REMOVED")
            )
        ).scalars().all()
        assert any(row.target_id == uuid.UUID(event_id) for row in logs)
        assert not any("token" in str(row.metadata_json or {}).lower() for row in logs)
        _ = first_key


async def test_event_report_is_idempotent_and_hides_reporter(isolated_app) -> None:
    env = isolated_app
    host_headers, host_id = await _register(env, "rh")
    reporter_headers, reporter_id = await _register(env, "rr")
    admin_headers, admin_id = await _register(env, "ra")
    await _set_role(env, admin_id, "ADMIN")
    created = await env.http.post("/api/v1/events", json=_payload(), headers=host_headers)
    event_id = created.json()["data"]["id"]

    first = await env.http.post(
        "/api/v1/reports",
        headers=reporter_headers,
        json={
            "reportedUserId": host_id,
            "reason": "Inappropriate photos",
            "relatedContentType": "event",
            "relatedContentId": event_id,
        },
    )
    assert first.status_code == 201
    report_id = first.json()["data"]["id"]
    assert "reporterId" not in first.json()["data"]

    again = await env.http.post(
        "/api/v1/reports",
        headers=reporter_headers,
        json={
            "reportedUserId": host_id,
            "reasonCode": "INAPPROPRIATE_CONTENT",
            "relatedContentType": "event",
            "relatedContentId": event_id,
        },
    )
    assert again.json()["data"]["id"] == report_id
    assert again.json()["data"]["created"] is False

    host_admin = await env.http.get("/api/v1/admin/reports", headers=host_headers)
    assert host_admin.status_code == 403

    detail = await env.http.get(f"/api/v1/admin/events/{event_id}", headers=admin_headers)
    reports = detail.json()["data"]["reports"]
    assert len(reports) == 1
    assert reports[0]["reporterId"] == reporter_id
    assert reports[0]["relatedContentId"] == event_id
    assert reports[0]["relatedContentType"] == "event"
