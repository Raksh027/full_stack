import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.orm import EventRsvp, EventStatus, SocialEvent, User, UserStatus
from tests.isolation import IsolatedApp

pytestmark = pytest.mark.integration


@pytest.fixture
async def client(isolated_app: IsolatedApp):
    yield isolated_app.http, isolated_app.otp, isolated_app.factory, isolated_app.app


async def _register(client, prefix: str = "e"):
    http, provider, factory, _app = client
    email = f"{prefix}.{uuid.uuid4().hex[:10]}@boomboom.app"
    password = "password12"
    register = await http.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201
    code = provider.codes["signup:" + email]
    verified = await http.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    token = verified.json()["data"]["accessToken"]
    user_id = verified.json()["data"]["userId"]
    return http, {"Authorization": f"Bearer {token}"}, user_id, factory


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


async def test_create_list_and_detail_events(client) -> None:
    http, headers, _user_id, _factory = await _register(client)
    created = await http.post("/api/v1/events", json=_payload(), headers=headers)
    assert created.status_code == 201
    event = created.json()["data"]
    assert event["isHost"] is True
    assert event["attendeeCount"] == 0
    assert event["myRsvp"] is None
    assert "rsvps" not in event
    assert "attendeesList" not in event

    listed = await http.get("/api/v1/events", headers=headers)
    assert listed.status_code == 200
    items = listed.json()["data"]["items"]
    assert any(row["id"] == event["id"] for row in items)

    detail = await http.get(f"/api/v1/events/{event['id']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["title"] == "Sunset Mixer"
    assert detail.json()["data"]["latitude"] is None
    assert detail.json()["data"]["longitude"] is None
    assert "userLatitude" not in detail.json()["data"]
    assert "currentLocation" not in detail.json()["data"]


async def test_create_and_update_coordinates_are_validated(client) -> None:
    http, headers, _user_id, _factory = await _register(client, "coord")
    created = await http.post(
        "/api/v1/events",
        json=_payload(latitude=15.2993, longitude=74.124),
        headers=headers,
    )
    assert created.status_code == 201
    event = created.json()["data"]
    assert event["latitude"] == pytest.approx(15.2993)
    assert event["longitude"] == pytest.approx(74.124)
    assert event["location"] == "Goa"

    detail = await http.get(f"/api/v1/events/{event['id']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["latitude"] == pytest.approx(15.2993)
    assert detail.json()["data"]["longitude"] == pytest.approx(74.124)

    invalid_lat = await http.post(
        "/api/v1/events",
        json=_payload(latitude=91, longitude=74.1),
        headers=headers,
    )
    assert invalid_lat.status_code == 422
    invalid_lng = await http.post(
        "/api/v1/events",
        json=_payload(longitude=181, latitude=15.3),
        headers=headers,
    )
    assert invalid_lng.status_code == 422
    half = await http.post(
        "/api/v1/events",
        json=_payload(latitude=15.3),
        headers=headers,
    )
    assert half.status_code == 422
    nan = await http.post(
        "/api/v1/events",
        json=_payload(latitude="NaN", longitude=74.1),
        headers=headers,
    )
    assert nan.status_code == 422

    patched = await http.patch(
        f"/api/v1/events/{event['id']}",
        json={"latitude": 19.076, "longitude": 72.8777},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["latitude"] == pytest.approx(19.076)
    bad_patch = await http.patch(
        f"/api/v1/events/{event['id']}",
        json={"latitude": 200, "longitude": 72.8},
        headers=headers,
    )
    assert bad_patch.status_code == 422


async def test_hidden_event_coordinates_are_not_public(client) -> None:
    http, host_headers, host_id, factory = await _register(client, "hide")
    _http, guest_headers, _gid, _factory = await _register(client, "hg")
    created = await http.post(
        "/api/v1/events",
        json=_payload(latitude=15.3, longitude=74.1),
        headers=host_headers,
    )
    event_id = created.json()["data"]["id"]
    async with factory() as session:
        event = await session.get(SocialEvent, uuid.UUID(event_id))
        assert event is not None
        event.status = EventStatus.HIDDEN.value
        await session.commit()
    hidden = await http.get(f"/api/v1/events/{event_id}", headers=guest_headers)
    assert hidden.status_code == 404
    assert "latitude" not in (hidden.json().get("data") or {})


async def test_host_can_update_stranger_cannot(client) -> None:
    http, host_headers, _host_id, _factory = await _register(client, "h")
    _http, guest_headers, _guest_id, _factory = await _register(client, "g")
    created = await http.post("/api/v1/events", json=_payload(), headers=host_headers)
    event_id = created.json()["data"]["id"]

    denied = await http.patch(
        f"/api/v1/events/{event_id}",
        json={"title": "Hacked"},
        headers=guest_headers,
    )
    assert denied.status_code == 403

    updated = await http.patch(
        f"/api/v1/events/{event_id}",
        json={"title": "Sunset Mixer Live"},
        headers=host_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["title"] == "Sunset Mixer Live"


async def test_host_can_cancel_stranger_cannot(client) -> None:
    http, host_headers, _host_id, _factory = await _register(client, "hc")
    _http, guest_headers, _guest_id, _factory = await _register(client, "gc")
    created = await http.post(
        "/api/v1/events",
        json=_payload(latitude=15.3, longitude=74.1),
        headers=host_headers,
    )
    event_id = created.json()["data"]["id"]

    denied = await http.delete(f"/api/v1/events/{event_id}", headers=guest_headers)
    assert denied.status_code == 403

    cancelled = await http.delete(f"/api/v1/events/{event_id}", headers=host_headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "CANCELLED"
    assert cancelled.json()["data"]["latitude"] == pytest.approx(15.3)
    assert cancelled.json()["data"]["longitude"] == pytest.approx(74.1)

    rsvp = await http.post(f"/api/v1/events/{event_id}/rsvp", headers=guest_headers)
    assert rsvp.status_code == 409
    assert rsvp.json()["error"]["code"] == "EVENT_CANCELLED"


async def test_rsvp_duplicate_cancel_and_rejoin(client) -> None:
    http, host_headers, _host_id, factory = await _register(client, "rh")
    _http, guest_headers, guest_id, _factory = await _register(client, "rg")
    created = await http.post("/api/v1/events", json=_payload(capacity=5), headers=host_headers)
    event_id = created.json()["data"]["id"]

    first = await http.post(f"/api/v1/events/{event_id}/rsvp", headers=guest_headers)
    assert first.status_code == 200
    assert first.json()["data"]["myRsvp"] == "GOING"
    assert first.json()["data"]["attendeeCount"] == 1

    second = await http.post(f"/api/v1/events/{event_id}/rsvp", headers=guest_headers)
    assert second.status_code == 200
    assert second.json()["data"]["attendeeCount"] == 1

    async with factory() as session:
        rows = (
            await session.execute(select(EventRsvp).where(EventRsvp.event_id == uuid.UUID(event_id)))
        ).scalars().all()
        assert len(rows) == 1
        assert str(rows[0].user_id) == guest_id

    left = await http.delete(f"/api/v1/events/{event_id}/rsvp", headers=guest_headers)
    assert left.status_code == 200
    assert left.json()["data"]["myRsvp"] == "CANCELLED"
    assert left.json()["data"]["attendeeCount"] == 0

    again = await http.post(f"/api/v1/events/{event_id}/rsvp", headers=guest_headers)
    assert again.status_code == 200
    assert again.json()["data"]["myRsvp"] == "GOING"
    assert again.json()["data"]["attendeeCount"] == 1


async def test_full_event_rejects_rsvp(client) -> None:
    http, host_headers, _host_id, _factory = await _register(client, "fh")
    _http, guest_a, _id_a, _factory = await _register(client, "fa")
    _http, guest_b, _id_b, _factory = await _register(client, "fb")
    created = await http.post("/api/v1/events", json=_payload(capacity=1), headers=host_headers)
    event_id = created.json()["data"]["id"]

    ok = await http.post(f"/api/v1/events/{event_id}/rsvp", headers=guest_a)
    assert ok.status_code == 200
    full = await http.post(f"/api/v1/events/{event_id}/rsvp", headers=guest_b)
    assert full.status_code == 409
    assert full.json()["error"]["code"] == "EVENT_FULL"


async def test_concurrent_rsvp_does_not_exceed_capacity(client) -> None:
    http, host_headers, _host_id, factory = await _register(client, "ch")
    _http, guest_a, _id_a, _factory = await _register(client, "ca")
    _http, guest_b, _id_b, _factory = await _register(client, "cb")
    created = await http.post("/api/v1/events", json=_payload(capacity=1), headers=host_headers)
    event_id = created.json()["data"]["id"]

    first, second = await asyncio.gather(
        http.post(f"/api/v1/events/{event_id}/rsvp", headers=guest_a),
        http.post(f"/api/v1/events/{event_id}/rsvp", headers=guest_b),
    )
    statuses = sorted([first.status_code, second.status_code])
    assert statuses == [200, 409]
    loser = first if first.status_code == 409 else second
    assert loser.json()["error"]["code"] == "EVENT_FULL"

    async with factory() as session:
        going = (
            await session.execute(
                select(EventRsvp).where(
                    EventRsvp.event_id == uuid.UUID(event_id),
                    EventRsvp.status == "GOING",
                )
            )
        ).scalars().all()
        assert len(going) == 1
        event = await session.get(SocialEvent, uuid.UUID(event_id))
        assert event is not None
        assert event.capacity == 1


async def test_create_rejects_invalid_dates(client) -> None:
    http, headers, _user_id, _factory = await _register(client, "bad")
    starts = datetime.now(UTC) + timedelta(days=1)
    response = await http.post(
        "/api/v1/events",
        json=_payload(startsAt=starts.isoformat(), endsAt=(starts - timedelta(hours=1)).isoformat()),
        headers=headers,
    )
    assert response.status_code == 422


JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


async def _upload_cover(http, headers, event_id, content=JPEG):
    signed = await http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": len(content)},
    )
    assert signed.status_code == 200
    data = signed.json()["data"]
    put = await http.put(data["uploadUrl"], content=content)
    return signed.status_code, put.status_code, data, put


async def test_create_ignores_client_supplied_cover_url(client) -> None:
    http, headers, _user_id, _factory = await _register(client, "cu")
    created = await http.post(
        "/api/v1/events",
        json=_payload(coverImageUrl="https://evil.example/photo.jpg"),
        headers=headers,
    )
    assert created.status_code == 201
    data = created.json()["data"]
    assert data["coverImageUrl"] is None
    assert data["coverStorageKey"] is None


async def test_host_can_upload_replace_and_remove_cover(client) -> None:
    http, headers, user_id, factory = await _register(client, "cv")
    created = await http.post("/api/v1/events", json=_payload(), headers=headers)
    event_id = created.json()["data"]["id"]

    _signed_status, put_status, upload, put = await _upload_cover(http, headers, event_id)
    assert put_status == 200
    assert f"{user_id}/events/{event_id}/" in upload["storageKey"]

    attached = await http.post(
        f"/api/v1/events/{event_id}/cover",
        headers=headers,
        json={"storageKey": upload["storageKey"]},
    )
    assert attached.status_code == 200
    body = attached.json()["data"]
    assert body["coverStorageKey"] == upload["storageKey"]
    assert body["coverImageUrl"]
    assert "evil" not in (body["coverImageUrl"] or "")
    assert "/api/v1/media/files/" in body["coverImageUrl"]

    fetched = await http.get(body["coverImageUrl"])
    assert fetched.status_code == 200
    assert fetched.content == JPEG

    second_signed = await http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "cover2.jpg", "byteSize": len(JPEG)},
    )
    second = second_signed.json()["data"]
    await http.put(second["uploadUrl"], content=JPEG)
    replaced = await http.post(
        f"/api/v1/events/{event_id}/cover",
        headers=headers,
        json={"storageKey": second["storageKey"]},
    )
    assert replaced.status_code == 200
    assert replaced.json()["data"]["coverStorageKey"] == second["storageKey"]

    async with factory() as session:
        event = await session.get(SocialEvent, uuid.UUID(event_id))
        assert event is not None
        assert event.cover_storage_key == second["storageKey"]
        assert event.cover_url is not None

    removed = await http.delete(f"/api/v1/events/{event_id}/cover", headers=headers)
    assert removed.status_code == 200
    assert removed.json()["data"]["coverStorageKey"] is None
    assert removed.json()["data"]["coverImageUrl"] is None


async def test_cover_upload_rejects_non_host_and_other_event_host(client) -> None:
    http, host_headers, _host_id, _factory = await _register(client, "chost")
    _http, guest_headers, _guest_id, _factory = await _register(client, "cguest")
    _http, other_host_headers, _other_id, _factory = await _register(client, "cother")
    created = await http.post("/api/v1/events", json=_payload(), headers=host_headers)
    event_id = created.json()["data"]["id"]
    other = await http.post("/api/v1/events", json=_payload(title="Other"), headers=other_host_headers)
    other_id = other.json()["data"]["id"]

    guest_url = await http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=guest_headers,
        json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": len(JPEG)},
    )
    assert guest_url.status_code == 403

    other_url = await http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=other_host_headers,
        json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": len(JPEG)},
    )
    assert other_url.status_code == 403

    guest_attach = await http.post(
        f"/api/v1/events/{event_id}/cover",
        headers=guest_headers,
        json={"storageKey": "x"},
    )
    assert guest_attach.status_code == 403

    _s, put_status, upload, _put = await _upload_cover(http, other_host_headers, other_id)
    assert put_status == 200
    stolen = await http.post(
        f"/api/v1/events/{event_id}/cover",
        headers=host_headers,
        json={"storageKey": upload["storageKey"]},
    )
    assert stolen.status_code == 403


async def test_cover_rejects_profile_and_unauthenticated_and_suspended(client) -> None:
    http, headers, user_id, factory = await _register(client, "csec")
    created = await http.post("/api/v1/events", json=_payload(), headers=headers)
    event_id = created.json()["data"]["id"]

    unauth = await http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": len(JPEG)},
    )
    assert unauth.status_code == 401

    profile = await http.post(
        "/api/v1/media/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "a.jpg", "byteSize": len(JPEG)},
    )
    profile_key = profile.json()["data"]["storageKey"]
    await http.put(profile.json()["data"]["uploadUrl"], content=JPEG)
    reused = await http.post(
        f"/api/v1/events/{event_id}/cover",
        headers=headers,
        json={"storageKey": profile_key},
    )
    assert reused.status_code == 403

    missing = await http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": len(JPEG)},
    )
    missing_key = missing.json()["data"]["storageKey"]
    not_uploaded = await http.post(
        f"/api/v1/events/{event_id}/cover",
        headers=headers,
        json={"storageKey": missing_key},
    )
    assert not_uploaded.status_code == 400

    exe = await http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": 20},
    )
    bad_put = await http.put(exe.json()["data"]["uploadUrl"], content=b"MZ not-an-image")
    assert bad_put.status_code == 422

    async with factory() as session:
        user = await session.get(User, uuid.UUID(user_id))
        assert user is not None
        user.status = UserStatus.SUSPENDED.value
        await session.commit()
    suspended = await http.post(
        f"/api/v1/events/{event_id}/cover/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "cover.jpg", "byteSize": len(JPEG)},
    )
    assert suspended.status_code in {401, 403}

    async with factory() as session:
        user = await session.get(User, uuid.UUID(user_id))
        assert user is not None
        user.status = UserStatus.ACTIVE.value
        user.suspended_until = None
        await session.commit()

    async with factory() as session:
        user = await session.get(User, uuid.UUID(user_id))
        assert user is not None
        user.status = UserStatus.BANNED.value
        await session.commit()
    banned = await http.delete(f"/api/v1/events/{event_id}/cover", headers=headers)
    assert banned.status_code in {401, 403}
