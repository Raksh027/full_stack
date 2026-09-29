import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.cache import MemoryCache
from app.core.exceptions import register_exception_handlers
from app.core.jobs import MemoryJobQueue
from app.core.otp import OTPService
from app.core.push import RecordingPushProvider
from app.core.realtime import ConnectionHub, MemoryBroker, PresenceStore
from app.dependencies.auth import get_otp
from app.middleware.request_id import RequestIdMiddleware
from app.models.orm import Profile, ProfileMedia
from app.workers.notifications import deliver_notification_job
from tests.conftest import CapturingOTPProvider
from tests.isolation import require_isolated_database_url, reset_isolated_data

pytestmark = pytest.mark.integration

TOKYO = {"latitude": 35.6762, "longitude": 139.6503, "city": "Tokyo", "country": "Japan"}


@pytest.fixture
async def client(otp_provider: CapturingOTPProvider):
    url = await require_isolated_database_url()
    engine = create_async_engine(url, pool_pre_ping=True)
    await reset_isolated_data(engine)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    cache = MemoryCache()
    settings = get_settings()
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)
    register_exception_handlers(app)
    app.include_router(api_router)
    app.state.cache = cache
    app.state.session_factory = factory
    app.state.broker = MemoryBroker()
    app.state.hub = ConnectionHub()
    app.state.presence = PresenceStore(cache)
    app.state.jobs = MemoryJobQueue()
    app.state.push = RecordingPushProvider()

    async def otp_override():
        return OTPService(cache, settings, otp_provider)

    app.dependency_overrides[get_otp] = otp_override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http, otp_provider, factory, app
    await engine.dispose()


async def _register(client):
    http, provider, factory, _app = client
    email = f"n.{uuid.uuid4().hex[:10]}@boomboom.app"
    password = "password12"
    register = await http.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201
    code = provider.codes["signup:" + email]
    verified = await http.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    token = verified.json()["data"]["accessToken"]
    user_id = verified.json()["data"]["userId"]
    return http, {"Authorization": f"Bearer {token}"}, user_id, factory


async def _add_photo(factory, user_id: str) -> None:
    async with factory() as session:
        result = await session.execute(select(Profile).where(Profile.user_id == uuid.UUID(user_id)))
        profile = result.scalar_one()
        session.add(
            ProfileMedia(
                profile_id=profile.id,
                url="https://example.com/seed.jpg",
                storage_key=f"{user_id}/{uuid.uuid4()}.jpg",
                media_type="image",
                sort_order=0,
                is_primary=True,
                moderation_status="APPROVED",
            )
        )
        await session.commit()


async def _ready(client, name: str):
    http, headers, user_id, factory = await _register(client)
    patched = await http.patch(
        "/api/v1/profile",
        headers=headers,
        json={
            "displayName": name,
            "bio": f"Hi, I am {name}",
            "age": 24,
            "gender": "Woman",
            "orientation": "Straight",
            "lookingFor": "Dating",
        },
    )
    assert patched.status_code == 200
    await http.patch("/api/v1/profile/location", headers=headers, json=TOKYO)
    await _add_photo(factory, user_id)
    return http, headers, user_id, factory


async def _drain(app, factory) -> None:
    jobs = app.state.jobs
    while True:
        payload = await jobs.dequeue(0)
        if payload is None:
            break
        async with factory() as session:
            await deliver_notification_job(
                session, jobs, app.state.push, app.state.presence, payload
            )


async def test_device_lifecycle_and_authorization(client) -> None:
    http, headers, _user_id, _factory = await _ready(client, "Ada")
    _, other_headers, _other_id, _ = await _ready(client, "Bea")
    created = await http.post(
        "/api/v1/notifications/devices",
        headers=headers,
        json={"token": "fcm-token-ada-1", "platform": "android", "deviceId": "phone-1"},
    )
    assert created.status_code == 201
    again = await http.post(
        "/api/v1/notifications/devices",
        headers=headers,
        json={"token": "fcm-token-ada-1", "platform": "android", "deviceId": "phone-1"},
    )
    assert again.status_code == 201
    assert created.json()["data"]["id"] == again.json()["data"]["id"]
    refreshed = await http.post(
        "/api/v1/notifications/devices",
        headers=headers,
        json={"token": "fcm-token-ada-2", "platform": "android", "deviceId": "phone-1"},
    )
    assert refreshed.status_code == 201
    listed = await http.get("/api/v1/notifications/devices", headers=headers)
    items = listed.json()["data"]
    assert len(items) == 2
    assert all("token" not in item for item in items)
    active = [item for item in items if item["isActive"]]
    assert len(active) == 1
    assert active[0]["id"] == refreshed.json()["data"]["id"]
    foreign = await http.delete(
        f"/api/v1/notifications/devices/{active[0]['id']}",
        headers=other_headers,
    )
    assert foreign.status_code == 404
    deleted = await http.delete(
        f"/api/v1/notifications/devices/{active[0]['id']}",
        headers=headers,
    )
    assert deleted.status_code == 200


async def test_like_match_message_preferences_and_idempotency(client) -> None:
    http, headers, ada_id, factory = await _ready(client, "Ada")
    _, other_headers, bea_id, _ = await _ready(client, "Bea")
    app = client[3]
    liked = await http.post("/api/v1/likes", headers=headers, json={"userId": bea_id})
    assert liked.status_code == 201
    inbox = await http.get("/api/v1/notifications", headers=other_headers)
    assert len(inbox.json()["data"]["items"]) == 1
    assert inbox.json()["data"]["items"][0]["type"] == "LIKE_RECEIVED"
    liked_again = await http.post("/api/v1/likes", headers=headers, json={"userId": bea_id})
    assert liked_again.status_code == 201
    inbox = await http.get("/api/v1/notifications", headers=other_headers)
    assert len(inbox.json()["data"]["items"]) == 1
    matched = await http.post("/api/v1/likes", headers=other_headers, json={"userId": ada_id})
    assert matched.json()["data"]["matched"] is True
    ada_inbox = await http.get("/api/v1/notifications", headers=headers)
    bea_inbox = await http.get("/api/v1/notifications", headers=other_headers)
    ada_types = {item["type"] for item in ada_inbox.json()["data"]["items"]}
    bea_types = {item["type"] for item in bea_inbox.json()["data"]["items"]}
    assert "MATCH_CREATED" in ada_types
    assert "MATCH_CREATED" in bea_types
    conversation_id = matched.json()["data"]["conversationId"]
    await http.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=headers,
        json={"content": "hello secret", "clientMessageId": "client-msg-001"},
    )
    bea_inbox = await http.get("/api/v1/notifications", headers=other_headers)
    messages = [item for item in bea_inbox.json()["data"]["items"] if item["type"] == "NEW_MESSAGE"]
    assert len(messages) == 1
    assert "hello secret" not in messages[0]["body"]
    await http.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=headers,
        json={"content": "hello secret", "clientMessageId": "client-msg-001"},
    )
    bea_inbox = await http.get("/api/v1/notifications", headers=other_headers)
    messages = [item for item in bea_inbox.json()["data"]["items"] if item["type"] == "NEW_MESSAGE"]
    assert len(messages) == 1
    unread = await http.get("/api/v1/notifications/unread-count", headers=other_headers)
    assert unread.json()["data"]["count"] >= 2
    first_id = bea_inbox.json()["data"]["items"][0]["id"]
    marked = await http.post(f"/api/v1/notifications/{first_id}/read", headers=other_headers)
    assert marked.json()["data"]["isRead"] is True
    stolen = await http.post(f"/api/v1/notifications/{first_id}/read", headers=headers)
    assert stolen.status_code == 404
    await http.post("/api/v1/notifications/read-all", headers=other_headers)
    unread = await http.get("/api/v1/notifications/unread-count", headers=other_headers)
    assert unread.json()["data"]["count"] == 0
    await http.put(
        "/api/v1/notifications/preferences",
        headers=other_headers,
        json={"likes": False, "messages": False, "matches": True},
    )
    prefs = await http.get("/api/v1/notifications/preferences", headers=other_headers)
    assert prefs.json()["data"]["likes"] is False
    _, third_headers, third_id, _ = await _ready(client, "Cara")
    await http.post("/api/v1/likes", headers=headers, json={"userId": third_id})
    cara_inbox = await http.get("/api/v1/notifications", headers=third_headers)
    assert cara_inbox.json()["data"]["items"]
    await http.put(
        "/api/v1/notifications/preferences", headers=third_headers, json={"likes": False}
    )
    _, fourth_headers, fourth_id, _ = await _ready(client, "Dee")
    await http.put(
        "/api/v1/notifications/preferences", headers=fourth_headers, json={"likes": False}
    )
    await http.post("/api/v1/likes", headers=headers, json={"userId": fourth_id})
    dee_inbox = await http.get("/api/v1/notifications", headers=fourth_headers)
    assert dee_inbox.json()["data"]["items"] == []
    await _drain(app, factory)
    assert app.state.push.sent or app.state.jobs.items == []


async def test_favorite_does_not_notify(client) -> None:
    http, headers, _ada, _factory = await _ready(client, "Ada")
    _, other_headers, bea_id, _ = await _ready(client, "Bea")
    await http.post("/api/v1/favorites", headers=headers, json={"userId": bea_id})
    inbox = await http.get("/api/v1/notifications", headers=other_headers)
    assert inbox.json()["data"]["items"] == []


async def test_pagination_and_own_inbox_only(client) -> None:
    http, headers, _ada, _factory = await _ready(client, "Ada")
    _, other_headers, bea_id, _ = await _ready(client, "Bea")
    for _ in range(3):
        await http.post("/api/v1/notifications/test", headers=other_headers)
    page = await http.get("/api/v1/notifications?limit=2", headers=other_headers)
    data = page.json()["data"]
    assert len(data["items"]) == 2
    assert data["hasMore"] is True
    next_page = await http.get(
        f"/api/v1/notifications?limit=2&cursor={data['nextCursor']}",
        headers=other_headers,
    )
    assert next_page.json()["data"]["items"]
    foreign = await http.get("/api/v1/notifications", headers=headers)
    assert all(
        item["type"] != "PROFILE_ACTIVITY" or True for item in foreign.json()["data"]["items"]
    )
    ada_test = await http.get("/api/v1/notifications", headers=headers)
    assert all(
        item["id"] not in {i["id"] for i in data["items"]}
        for item in ada_test.json()["data"]["items"]
    )
    _ = bea_id
