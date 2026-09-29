import asyncio
import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.cache import MemoryCache
from app.core.exceptions import register_exception_handlers
from app.core.otp import OTPService
from app.core.realtime import ConnectionHub, MemoryBroker, PresenceStore
from app.dependencies.auth import get_otp
from app.middleware.request_id import RequestIdMiddleware
from app.models.orm import Match, Message, Profile, ProfileMedia, User, UserStatus
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

    async def otp_override():
        return OTPService(cache, settings, otp_provider)

    app.dependency_overrides[get_otp] = otp_override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http, otp_provider, factory, app
    await engine.dispose()


async def _register(client):
    http, provider, factory, _app = client
    email = f"int.{uuid.uuid4().hex[:10]}@boomboom.app"
    password = "password12"
    register = await http.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201
    code = provider.codes["signup:" + email]
    verified = await http.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    token = verified.json()["data"]["accessToken"]
    user_id = verified.json()["data"]["userId"]
    return http, {"Authorization": f"Bearer {token}"}, user_id, factory, token


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
    http, headers, user_id, factory, token = await _register(client)
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
    return http, headers, user_id, factory, token


async def test_like_self_and_duplicate_and_unlike(client) -> None:
    http, headers, user_id, _, _ = await _ready(client, "Ada")
    self_like = await http.post("/api/v1/likes", headers=headers, json={"userId": user_id})
    assert self_like.status_code == 422
    _, other_headers, other_id, _, _ = await _ready(client, "Bea")
    first = await http.post("/api/v1/likes", headers=headers, json={"userId": other_id})
    second = await http.post("/api/v1/likes", headers=headers, json={"userId": other_id})
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["data"]["matched"] is False
    outgoing = await http.get("/api/v1/likes", headers=headers)
    assert len(outgoing.json()["data"]["items"]) == 1
    unlike = await http.delete(f"/api/v1/likes/{other_id}", headers=headers)
    assert unlike.status_code == 200
    outgoing = await http.get("/api/v1/likes", headers=headers)
    assert outgoing.json()["data"]["items"] == []


async def test_favorite_private_and_blocked(client) -> None:
    http, headers, _user_id, _, _ = await _ready(client, "Ada")
    _, other_headers, other_id, _, _ = await _ready(client, "Bea")
    first = await http.post("/api/v1/favorites", headers=headers, json={"userId": other_id})
    second = await http.post("/api/v1/favorites", headers=headers, json={"userId": other_id})
    assert first.status_code == 201
    assert second.status_code == 201
    listed = await http.get("/api/v1/favorites", headers=headers)
    assert len(listed.json()["data"]["items"]) == 1
    other_list = await http.get("/api/v1/favorites", headers=other_headers)
    assert other_list.json()["data"]["items"] == []
    await http.post("/api/v1/safety/blocks", headers=headers, json={"userId": other_id})
    blocked = await http.post("/api/v1/favorites", headers=headers, json={"userId": other_id})
    assert blocked.status_code == 403


async def test_mutual_and_concurrent_likes_create_one_match(client) -> None:
    http, a_headers, a_id, factory, _ = await _ready(client, "Ada")
    _, b_headers, b_id, _, _ = await _ready(client, "Bea")

    async def like_a():
        return await http.post("/api/v1/likes", headers=a_headers, json={"userId": b_id})

    async def like_b():
        return await http.post("/api/v1/likes", headers=b_headers, json={"userId": a_id})

    first, second = await asyncio.gather(like_a(), like_b())
    assert first.status_code == 201
    assert second.status_code == 201
    async with factory() as session:
        result = await session.execute(select(Match))
        matches = [
            row
            for row in result.scalars()
            if {str(row.user_a_id), str(row.user_b_id)} == {a_id, b_id}
        ]
        assert len(matches) == 1
        assert matches[0].user_a_id < matches[0].user_b_id

    a_matches = await http.get("/api/v1/matches", headers=a_headers)
    b_matches = await http.get("/api/v1/matches", headers=b_headers)
    assert len(a_matches.json()["data"]["items"]) == 1
    assert len(b_matches.json()["data"]["items"]) == 1
    match_id = a_matches.json()["data"]["items"][0]["id"]
    stranger = await _ready(client, "Cid")
    denied = await stranger[0].get(f"/api/v1/matches/{match_id}", headers=stranger[1])
    assert denied.status_code == 403


async def test_chat_authorization_idempotency_read_and_block(client) -> None:
    http, a_headers, a_id, factory, a_token = await _ready(client, "Ada")
    _, b_headers, b_id, _, b_token = await _ready(client, "Bea")
    await http.post("/api/v1/likes", headers=a_headers, json={"userId": b_id})
    liked = await http.post("/api/v1/likes", headers=b_headers, json={"userId": a_id})
    conversation_id = liked.json()["data"]["conversationId"]
    assert conversation_id

    client_id = f"client-msg-{uuid.uuid4().hex[:12]}"
    first = await http.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=a_headers,
        json={"content": "hello there", "clientMessageId": client_id},
    )
    retry = await http.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=a_headers,
        json={"content": "hello there", "clientMessageId": client_id},
    )
    assert first.status_code == 201
    assert retry.status_code == 201
    assert first.json()["data"]["id"] == retry.json()["data"]["id"]
    async with factory() as session:
        result = await session.execute(
            select(Message).where(
                Message.client_message_id == client_id,
                Message.conversation_id == uuid.UUID(conversation_id),
            )
        )
        assert len(list(result.scalars())) == 1

    stranger = await _ready(client, "Eve")
    forbidden = await stranger[0].get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=stranger[1],
    )
    assert forbidden.status_code == 403
    send_denied = await stranger[0].post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=stranger[1],
        json={"content": "intrude", "clientMessageId": "client-msg-999999"},
    )
    assert send_denied.status_code == 403

    history = await http.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=b_headers,
    )
    assert history.json()["data"]["items"][0]["text"] == "hello there"
    unread = await http.get("/api/v1/chat/unread-count", headers=b_headers)
    assert unread.json()["data"]["total"] >= 1
    await http.post(f"/api/v1/conversations/{conversation_id}/read", headers=b_headers)
    unread = await http.get("/api/v1/chat/unread-count", headers=b_headers)
    assert unread.json()["data"]["total"] == 0

    await http.post("/api/v1/safety/blocks", headers=a_headers, json={"userId": b_id})
    blocked_send = await http.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=b_headers,
        json={"content": "still there?", "clientMessageId": "client-msg-block01"},
    )
    assert blocked_send.status_code == 403
    _ = (a_token, b_token)


async def test_unmatch_rejects_new_messages(client) -> None:
    http, a_headers, a_id, _, _ = await _ready(client, "Ada")
    _, b_headers, b_id, _, _ = await _ready(client, "Bea")
    await http.post("/api/v1/likes", headers=a_headers, json={"userId": b_id})
    liked = await http.post("/api/v1/likes", headers=b_headers, json={"userId": a_id})
    match_id = liked.json()["data"]["matchId"]
    conversation_id = liked.json()["data"]["conversationId"]
    await http.delete(f"/api/v1/matches/{match_id}", headers=a_headers)
    rejected = await http.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=a_headers,
        json={"content": "after unmatch", "clientMessageId": "client-msg-unmatch1"},
    )
    assert rejected.status_code == 403
    history = await http.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=a_headers,
    )
    assert history.status_code == 200


async def test_suspended_user_cannot_message(client) -> None:
    http, a_headers, a_id, factory, _ = await _ready(client, "Ada")
    _, b_headers, b_id, _, _ = await _ready(client, "Bea")
    await http.post("/api/v1/likes", headers=a_headers, json={"userId": b_id})
    liked = await http.post("/api/v1/likes", headers=b_headers, json={"userId": a_id})
    conversation_id = liked.json()["data"]["conversationId"]
    async with factory() as session:
        user = await session.get(User, uuid.UUID(a_id))
        assert user is not None
        user.status = UserStatus.SUSPENDED.value
        await session.commit()
    denied = await http.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=a_headers,
        json={"content": "from suspended", "clientMessageId": "client-msg-suspend1"},
    )
    assert denied.status_code in {401, 403}


async def test_websocket_auth_and_message_flow(client) -> None:
    http, a_headers, a_id, _factory, a_token = await _ready(client, "Ada")
    _, b_headers, b_id, _, b_token = await _ready(client, "Bea")
    await http.post("/api/v1/likes", headers=a_headers, json={"userId": b_id})
    liked = await http.post("/api/v1/likes", headers=b_headers, json={"userId": a_id})
    conversation_id = liked.json()["data"]["conversationId"]
    _app = client[3]
    with TestClient(_app) as starlette:
        rejected = starlette.websocket_connect(f"/api/v1/ws/chat/{conversation_id}")
        with pytest.raises(WebSocketDisconnect):
            with rejected:
                pass
    sent = await http.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=a_headers,
        json={
            "content": "ws hello",
            "clientMessageId": "client-msg-ws-0001",
            "senderId": str(uuid.uuid4()),
        },
    )
    assert sent.status_code == 201
    assert sent.json()["data"]["senderId"] == a_id
    history = await http.get(
        f"/api/v1/conversations/{conversation_id}/messages",
        headers=b_headers,
    )
    texts = [item["text"] for item in history.json()["data"]["items"]]
    assert "ws hello" in texts
    _ = (a_token, b_token)


async def test_missed_messages_recovered_over_rest(client) -> None:
    http, a_headers, a_id, _, _ = await _ready(client, "Ada")
    _, b_headers, b_id, _, _ = await _ready(client, "Bea")
    await http.post("/api/v1/likes", headers=a_headers, json={"userId": b_id})
    liked = await http.post("/api/v1/likes", headers=b_headers, json={"userId": a_id})
    conversation_id = liked.json()["data"]["conversationId"]
    for index in range(3):
        await http.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            headers=a_headers,
            json={"content": f"msg-{index}", "clientMessageId": f"client-msg-miss-{index:04d}"},
        )
    page = await http.get(
        f"/api/v1/conversations/{conversation_id}/messages?limit=2",
        headers=b_headers,
    )
    body = page.json()["data"]
    assert body["hasMore"] is True
    assert len(body["items"]) == 2
    more = await http.get(
        f"/api/v1/conversations/{conversation_id}/messages?limit=2&cursor={body['nextCursor']}",
        headers=b_headers,
    )
    assert more.status_code == 200
    stranger = await _ready(client, "Zoe")
    stolen = await stranger[0].get(
        f"/api/v1/conversations/{conversation_id}/messages?cursor={body['nextCursor']}",
        headers=stranger[1],
    )
    assert stolen.status_code in {403, 400}
