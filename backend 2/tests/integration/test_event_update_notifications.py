import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.orm import AppNotification, NotificationType, User, UserStatus
from tests.isolation import IsolatedApp

pytestmark = pytest.mark.integration

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


@pytest.fixture
async def client(isolated_app: IsolatedApp):
    yield isolated_app


async def _register(env: IsolatedApp, prefix: str):
    email = f"{prefix}.{uuid.uuid4().hex[:10]}@boomboom.app"
    password = "password12"
    register = await env.http.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201
    code = env.otp.codes["signup:" + email]
    verified = await env.http.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    token = verified.json()["data"]["accessToken"]
    user_id = verified.json()["data"]["userId"]
    return {"Authorization": f"Bearer {token}"}, user_id


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


async def _event_updates(env: IsolatedApp, headers) -> list[dict]:
    inbox = await env.http.get("/api/v1/notifications", headers=headers)
    assert inbox.status_code == 200
    items = inbox.json()["data"]["items"]
    return [row for row in items if row["type"] == NotificationType.EVENT_UPDATE.value]


async def _all_event_updates(env: IsolatedApp) -> list[AppNotification]:
    async with env.factory() as session:
        result = await session.execute(
            select(AppNotification).where(AppNotification.type == NotificationType.EVENT_UPDATE.value)
        )
        return list(result.scalars())


async def _set_status(env: IsolatedApp, user_id: str, status: str, deleted: bool = False) -> None:
    async with env.factory() as session:
        user = await session.get(User, uuid.UUID(user_id))
        assert user is not None
        user.status = status
        if deleted:
            user.deleted_at = datetime.now(UTC)
        await session.commit()


async def _set_role(env: IsolatedApp, user_id: str, role: str) -> None:
    async with env.factory() as session:
        user = await session.get(User, uuid.UUID(user_id))
        assert user is not None
        user.role = role
        await session.commit()


async def _seed_going(env: IsolatedApp, host_headers, *guest_headers_list) -> str:
    created = await env.http.post("/api/v1/events", json=_payload(), headers=host_headers)
    event_id = created.json()["data"]["id"]
    for headers in guest_headers_list:
        rsvp = await env.http.post(f"/api/v1/events/{event_id}/rsvp", headers=headers)
        assert rsvp.status_code == 200
    return event_id


def _assert_safe_payload(row: dict, event_id: str) -> None:
    data = row.get("data") or {}
    blob = f"{row} {data}".lower()
    assert data["type"] == "EVENT_UPDATE"
    assert data["eventId"] == event_id
    assert data["entity_id"] == event_id
    assert data["deepLink"] == f"https://boomboom.app/events/{event_id}"
    assert row["relatedEntityId"] == event_id
    assert "jwt" not in blob
    assert "accesstoken" not in blob
    assert "refresh" not in blob
    assert "storagekey" not in blob
    assert "/api/v1/" not in blob
    assert "attendee" not in blob
    assert "reporter" not in blob
    assert "moderation" not in blob
    assert "hide" not in blob


async def test_host_title_update_notifies_going_not_host(client) -> None:
    env = client
    host, _hid = await _register(env, "h")
    going, _gid = await _register(env, "g")
    event_id = await _seed_going(env, host, going)
    updated = await env.http.patch(
        f"/api/v1/events/{event_id}", json={"title": "Sunset Mixer Live"}, headers=host
    )
    assert updated.status_code == 200
    host_inbox = await _event_updates(env, host)
    guest_inbox = await _event_updates(env, going)
    assert host_inbox == []
    assert len(guest_inbox) == 1
    assert guest_inbox[0]["body"] == "Event title was updated."
    _assert_safe_payload(guest_inbox[0], event_id)


async def test_noop_and_same_title_do_not_notify(client) -> None:
    env = client
    host, _hid = await _register(env, "hn")
    going, _gid = await _register(env, "gn")
    event_id = await _seed_going(env, host, going)
    first = await env.http.patch(
        f"/api/v1/events/{event_id}", json={"title": "Sunset Mixer Live"}, headers=host
    )
    assert first.status_code == 200
    again = await env.http.patch(
        f"/api/v1/events/{event_id}", json={"title": "Sunset Mixer Live"}, headers=host
    )
    assert again.status_code == 200
    empty = await env.http.patch(f"/api/v1/events/{event_id}", json={}, headers=host)
    assert empty.status_code == 200
    assert len(await _event_updates(env, going)) == 1


async def test_description_location_time_capacity_price_updates(client) -> None:
    env = client
    host, _hid = await _register(env, "hf")
    going, _gid = await _register(env, "gf")
    event_id = await _seed_going(env, host, going)
    cases = [
        ({"description": "New copy"}, "Event description was updated."),
        ({"location": "Mumbai"}, "Event location was updated."),
        (
            {
                "startsAt": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
                "endsAt": (datetime.now(UTC) + timedelta(days=3, hours=2)).isoformat(),
            },
            "Event time was updated.",
        ),
        ({"capacity": 40}, "Event capacity was updated."),
        ({"price": 15}, "Event price was updated."),
    ]
    for payload, body in cases:
        patched = await env.http.patch(f"/api/v1/events/{event_id}", json=payload, headers=host)
        assert patched.status_code == 200, patched.text
        inbox = await _event_updates(env, going)
        assert inbox[0]["body"] == body
        await env.http.post("/api/v1/notifications/read-all", headers=going)


async def test_cancelled_and_stranger_are_not_notified(client) -> None:
    env = client
    host, _hid = await _register(env, "hc")
    going, _gid = await _register(env, "gg")
    left, _lid = await _register(env, "cl")
    stranger, _sid = await _register(env, "st")
    event_id = await _seed_going(env, host, going, left)
    cancel = await env.http.delete(f"/api/v1/events/{event_id}/rsvp", headers=left)
    assert cancel.status_code == 200
    patched = await env.http.patch(
        f"/api/v1/events/{event_id}", json={"title": "Updated Mixer"}, headers=host
    )
    assert patched.status_code == 200
    assert len(await _event_updates(env, going)) == 1
    assert await _event_updates(env, left) == []
    assert await _event_updates(env, stranger) == []
    assert await _event_updates(env, host) == []


async def test_suspended_banned_deleted_users_are_not_notified(client) -> None:
    env = client
    host, _hid = await _register(env, "hs")
    going, _gid = await _register(env, "ok")
    suspended, sid = await _register(env, "su")
    banned, bid = await _register(env, "ba")
    deleted, did = await _register(env, "dl")
    event_id = await _seed_going(env, host, going, suspended, banned, deleted)
    await _set_status(env, sid, UserStatus.SUSPENDED.value)
    await _set_status(env, bid, UserStatus.BANNED.value)
    await _set_status(env, did, UserStatus.ACTIVE.value, deleted=True)
    patched = await env.http.patch(
        f"/api/v1/events/{event_id}", json={"title": "Policy Mixer"}, headers=host
    )
    assert patched.status_code == 200
    rows = await _all_event_updates(env)
    recipients = {str(row.user_id) for row in rows}
    assert recipients == {_gid}


async def test_general_opt_out_skips_event_update(client) -> None:
    env = client
    host, _hid = await _register(env, "hp")
    going, _gid = await _register(env, "gp")
    event_id = await _seed_going(env, host, going)
    prefs = await env.http.put(
        "/api/v1/notifications/preferences", headers=going, json={"general": False}
    )
    assert prefs.status_code == 200
    await env.http.patch(f"/api/v1/events/{event_id}", json={"title": "Quiet Mixer"}, headers=host)
    assert await _event_updates(env, going) == []


async def test_rsvp_cover_and_admin_moderation_do_not_create_event_update(client) -> None:
    env = client
    host, _hid = await _register(env, "hx")
    going, _gid = await _register(env, "gx")
    admin, admin_id = await _register(env, "ad")
    await _set_role(env, admin_id, "ADMIN")
    event_id = await _seed_going(env, host, going)
    assert await _all_event_updates(env) == []

    upload = await env.http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=host,
        json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": len(JPEG)},
    )
    assert upload.status_code == 200
    key = upload.json()["data"]["storageKey"]
    put = await env.http.put(upload.json()["data"]["uploadUrl"], content=JPEG)
    assert put.status_code == 200
    attached = await env.http.post(
        f"/api/v1/events/{event_id}/cover", headers=host, json={"storageKey": key}
    )
    assert attached.status_code == 200
    assert await _all_event_updates(env) == []

    second = await env.http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=host,
        json={"contentType": "image/jpeg", "filename": "cover2.jpg", "byteSize": len(JPEG)},
    )
    second_key = second.json()["data"]["storageKey"]
    await env.http.put(second.json()["data"]["uploadUrl"], content=JPEG)
    replaced = await env.http.post(
        f"/api/v1/events/{event_id}/cover", headers=host, json={"storageKey": second_key}
    )
    assert replaced.status_code == 200
    removed = await env.http.delete(f"/api/v1/events/{event_id}/cover", headers=host)
    assert removed.status_code == 200
    assert await _all_event_updates(env) == []

    hidden = await env.http.post(
        f"/api/v1/admin/events/{event_id}/hide",
        headers=admin,
        json={"reason": "policy"},
    )
    assert hidden.status_code == 200
    restored = await env.http.post(f"/api/v1/admin/events/{event_id}/restore", headers=admin)
    assert restored.status_code == 200
    assert await _all_event_updates(env) == []


async def test_failed_capacity_change_does_not_create_notification(client) -> None:
    env = client
    host, _hid = await _register(env, "hcap")
    first, _fid = await _register(env, "c1")
    second, _sid = await _register(env, "c2")
    created = await env.http.post("/api/v1/events", json=_payload(capacity=5), headers=host)
    event_id = created.json()["data"]["id"]
    await env.http.post(f"/api/v1/events/{event_id}/rsvp", headers=first)
    await env.http.post(f"/api/v1/events/{event_id}/rsvp", headers=second)
    failed = await env.http.patch(f"/api/v1/events/{event_id}", json={"capacity": 1}, headers=host)
    assert failed.status_code == 409
    assert await _all_event_updates(env) == []


async def test_persist_same_revision_is_idempotent(client) -> None:
    env = client
    host, _hid = await _register(env, "hi")
    going, gid = await _register(env, "gi")
    event_id = await _seed_going(env, host, going)
    from app.config import get_settings
    from app.core.rate_limit import RateLimiter
    from app.services.notifications import NotificationService

    async with env.factory() as session:
        notifier = NotificationService(
            session=session,
            settings=get_settings(),
            limiter=RateLimiter(env.app.state.cache),
            request_id="test",
        )
        first = await notifier.persist_event_update(
            event_id=uuid.UUID(event_id),
            host_user_id=uuid.UUID(_hid),
            title="Sunset Mixer",
            summary="Event title was updated.",
            recipient_ids=[uuid.UUID(gid)],
            revision="rev-1",
        )
        second = await notifier.persist_event_update(
            event_id=uuid.UUID(event_id),
            host_user_id=uuid.UUID(_hid),
            title="Sunset Mixer",
            summary="Event title was updated.",
            recipient_ids=[uuid.UUID(gid)],
            revision="rev-1",
        )
        await session.commit()
    assert len(first) == 1
    assert second == []
    rows = await _all_event_updates(env)
    assert len(rows) == 1
    assert rows[0].event_key == f"event_update:{event_id}:rev-1"
