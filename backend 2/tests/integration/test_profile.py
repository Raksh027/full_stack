import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.cache import MemoryCache
from app.core.exceptions import register_exception_handlers
from app.core.otp import OTPService
from app.dependencies.auth import get_otp
from app.middleware.request_id import RequestIdMiddleware
from tests.conftest import CapturingOTPProvider
from tests.isolation import require_isolated_database_url, reset_isolated_data

pytestmark = pytest.mark.integration

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


@pytest.fixture
async def client(otp_provider: CapturingOTPProvider, tmp_path, monkeypatch):
    url = await require_isolated_database_url()
    monkeypatch.setenv("MEDIA_STORAGE_PATH", str(tmp_path))
    get_settings.cache_clear()
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

    async def otp_override():
        return OTPService(cache, settings, otp_provider)

    app.dependency_overrides[get_otp] = otp_override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http, otp_provider
    await engine.dispose()
    get_settings.cache_clear()


async def _register(client):
    http, provider = client
    email = f"profile.{uuid.uuid4().hex[:12]}@boomboom.app"
    password = "password12"
    register = await http.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201
    code = provider.codes["signup:" + email]
    verified = await http.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    assert verified.status_code == 200
    token = verified.json()["data"]["accessToken"]
    user_id = verified.json()["data"]["userId"]
    return http, {"Authorization": f"Bearer {token}"}, user_id


async def test_profile_requires_auth(client) -> None:
    http, _ = client
    response = await http.get("/api/v1/profile")
    assert response.status_code == 401


async def test_profile_get_patch_and_public_restrictions(client) -> None:
    http, headers, user_id = await _register(client)
    mine = await http.get("/api/v1/profile", headers=headers)
    assert mine.status_code == 200
    data = mine.json()["data"]
    assert data["id"] == user_id
    assert "birthDate" not in data
    assert "latitude" not in data
    assert "longitude" not in data

    updated = await http.patch(
        "/api/v1/profile",
        headers=headers,
        json={
            "displayName": "Ada",
            "bio": "Hello there",
            "age": 24,
            "gender": "Woman",
            "orientation": "Straight",
            "lookingFor": "Dating",
        },
    )
    assert updated.status_code == 200
    body = updated.json()["data"]
    assert body["name"] == "Ada"
    assert body["age"] == 24
    assert body["gender"] == "Woman"
    assert "birthDate" not in body

    public = await http.get(f"/api/v1/profiles/{user_id}", headers=headers)
    assert public.status_code == 200
    pub = public.json()["data"]
    assert pub["name"] == "Ada"
    assert pub["age"] == 24
    assert "birthDate" not in pub
    assert "email" not in pub
    assert "latitude" not in pub
    assert "onboardingStep" not in pub

    too_young = await http.patch("/api/v1/profile", headers=headers, json={"age": 16})
    assert too_young.status_code == 403
    assert too_young.json()["error"]["code"] == "AGE_RESTRICTED"


async def test_preferences_validation(client) -> None:
    http, headers, _ = await _register(client)
    bad = await http.put(
        "/api/v1/profile/preferences",
        headers=headers,
        json={"minAge": 40, "maxAge": 20, "maxDistanceKm": 10, "gender": "Everyone"},
    )
    assert bad.status_code == 422
    ok = await http.put(
        "/api/v1/profile/preferences",
        headers=headers,
        json={
            "minAge": 21,
            "maxAge": 35,
            "maxDistanceKm": 25,
            "gender": "Women",
            "verifiedOnly": True,
        },
    )
    assert ok.status_code == 200
    assert ok.json()["data"]["minAge"] == 21
    assert ok.json()["data"]["gender"] == "Women"
    anon = await http.put(
        "/api/v1/profile/preferences",
        json={"minAge": 21, "maxAge": 35, "maxDistanceKm": 25, "gender": "Women"},
    )
    assert anon.status_code == 401


async def test_interests_list_and_select(client) -> None:
    http, headers, _ = await _register(client)
    catalog = await http.get("/api/v1/interests", headers=headers)
    assert catalog.status_code == 200
    names = [item["name"] for item in catalog.json()["data"]]
    assert "Travel" in names
    selected = await http.put(
        "/api/v1/profile/interests",
        headers=headers,
        json={"names": ["Travel", "Music", "Travel"]},
    )
    assert selected.status_code == 200
    interests = selected.json()["data"]["interests"]
    assert interests.count("Travel") == 1
    assert "Music" in interests


async def test_location_valid_and_invalid(client) -> None:
    http, headers, _ = await _register(client)
    bad = await http.patch(
        "/api/v1/profile/location",
        headers=headers,
        json={"latitude": 200, "longitude": 10},
    )
    assert bad.status_code == 422
    ok = await http.patch(
        "/api/v1/profile/location",
        headers=headers,
        json={"latitude": 19.07, "longitude": 72.87, "city": "Mumbai", "country": "India"},
    )
    assert ok.status_code == 200
    data = ok.json()["data"]
    assert data["city"] == "Mumbai"
    assert data["hasCoordinates"] is True
    assert "latitude" not in data
    profile = await http.get("/api/v1/profile", headers=headers)
    assert "latitude" not in profile.json()["data"]
    assert profile.json()["data"]["location"] == "Mumbai, India"


async def test_media_upload_ownership_and_primary(client) -> None:
    http, headers, user_id = await _register(client)
    other_http, other_headers, _ = await _register(client)
    first = await http.post(
        "/api/v1/media/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "a.jpg", "byteSize": len(JPEG)},
    )
    assert first.status_code == 200
    upload = first.json()["data"]
    put = await http.put(upload["uploadUrl"], content=JPEG)
    assert put.status_code == 200
    created = await http.post(
        "/api/v1/profile/media",
        headers=headers,
        json={"storageKey": upload["storageKey"], "sortOrder": 0, "isPrimary": True},
    )
    assert created.status_code == 201
    media_id = created.json()["data"]["id"]
    assert created.json()["data"]["isPrimary"] is True

    exe = await http.post(
        "/api/v1/media/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "b.jpg", "byteSize": 20},
    )
    bad_put = await http.put(exe.json()["data"]["uploadUrl"], content=b"MZ not-an-image")
    assert bad_put.status_code == 422

    stolen = await other_http.post(
        "/api/v1/profile/media",
        headers=other_headers,
        json={"storageKey": upload["storageKey"], "sortOrder": 1},
    )
    assert stolen.status_code in {403, 400, 409}

    denied = await other_http.delete(f"/api/v1/profile/media/{media_id}", headers=other_headers)
    assert denied.status_code == 403

    second = await http.post(
        "/api/v1/media/upload-url",
        headers=headers,
        json={"contentType": "image/jpeg", "filename": "c.jpg", "byteSize": len(JPEG)},
    )
    await http.put(second.json()["data"]["uploadUrl"], content=JPEG)
    created2 = await http.post(
        "/api/v1/profile/media",
        headers=headers,
        json={"storageKey": second.json()["data"]["storageKey"], "sortOrder": 1},
    )
    assert created2.status_code == 201
    deleted = await http.delete(f"/api/v1/profile/media/{media_id}", headers=headers)
    assert deleted.status_code == 200
    mine = await http.get("/api/v1/profile", headers=headers)
    remaining = mine.json()["data"]["media"]
    assert len(remaining) == 1
    assert remaining[0]["isPrimary"] is True


async def test_completion_progress(client) -> None:
    http, headers, _ = await _register(client)
    empty = await http.get("/api/v1/profile/completion", headers=headers)
    assert empty.status_code == 200
    assert empty.json()["data"]["percent"] < 100
    await http.patch(
        "/api/v1/profile",
        headers=headers,
        json={
            "displayName": "Ada",
            "bio": "Hello",
            "age": 24,
            "gender": "Woman",
            "orientation": "Straight",
            "lookingFor": "Dating",
            "location": "Mumbai, India",
        },
    )
    await http.put(
        "/api/v1/profile/interests",
        headers=headers,
        json={"names": ["Travel", "Music", "Art"]},
    )
    mid = await http.get("/api/v1/profile/completion", headers=headers)
    assert 50 <= mid.json()["data"]["percent"] < 100
    assert "media" in mid.json()["data"]["missing"]
