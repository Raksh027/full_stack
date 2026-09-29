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


@pytest.fixture
async def integration_client(otp_provider: CapturingOTPProvider):
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

    async def otp_override():
        return OTPService(cache, settings, otp_provider)

    app.dependency_overrides[get_otp] = otp_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, otp_provider
    await engine.dispose()


async def test_register_login_me_refresh_logout(integration_client) -> None:
    client, otp_provider = integration_client
    email = f"phase2.{uuid.uuid4().hex[:12]}@boomboom.app"
    password = "password12"
    register = await client.post(
        "/api/v1/auth/register", json={"email": email, "password": password}
    )
    assert register.status_code == 201
    assert register.json()["data"]["userId"]
    assert register.json()["data"]["verificationRequired"] is True
    code = otp_provider.codes["signup:" + email]
    verified = await client.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code})
    assert verified.status_code == 200
    tokens = verified.json()["data"]
    headers = {"Authorization": f"Bearer {tokens['accessToken']}"}
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["data"]["email"] == email
    assert "status" not in me.json()["data"]

    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refreshToken"]}
    )
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()["data"]
    reuse = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refreshToken"]}
    )
    assert reuse.status_code == 401
    family = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_tokens["refreshToken"]}
    )
    assert family.status_code == 401

    logged_out = await client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": new_tokens["refreshToken"]},
        headers={"Authorization": f"Bearer {new_tokens['accessToken']}"},
    )
    assert logged_out.status_code == 200
    denied = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_tokens['accessToken']}"},
    )
    assert denied.status_code == 401


async def test_duplicate_registration(integration_client) -> None:
    client, otp_provider = integration_client
    email = f"dup.{uuid.uuid4().hex[:12]}@boomboom.app"
    payload = {"email": email, "password": "password12"}
    first = await client.post("/api/v1/auth/register", json=payload)
    assert first.status_code in {201, 409}
    second = await client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"


async def test_incorrect_password(integration_client) -> None:
    client, _ = integration_client
    email = f"login.{uuid.uuid4().hex[:12]}@boomboom.app"
    await client.post("/api/v1/auth/register", json={"email": email, "password": "password12"})
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "wrongpass"}
    )
    assert response.status_code == 401


async def test_me_requires_auth(integration_client) -> None:
    client, _ = integration_client
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_forgot_and_reset_password(integration_client) -> None:
    client, otp_provider = integration_client
    email = f"reset.{uuid.uuid4().hex[:12]}@boomboom.app"
    await client.post("/api/v1/auth/register", json={"email": email, "password": "password12"})
    forgot = await client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 200
    code = otp_provider.codes["reset:" + email]
    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": email, "otp": code, "password": "newpassword1"},
    )
    assert reset.status_code == 200
    old = await client.post("/api/v1/auth/login", json={"email": email, "password": "password12"})
    assert old.status_code == 401
    new = await client.post("/api/v1/auth/login", json={"email": email, "password": "newpassword1"})
    assert new.status_code == 200


async def test_invalid_registration(integration_client) -> None:
    client, _ = integration_client
    response = await client.post(
        "/api/v1/auth/register", json={"email": "not-an-email", "password": "short"}
    )
    assert response.status_code == 422
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_unverified_login_rejected(integration_client) -> None:
    client, _ = integration_client
    email = f"unverified.{uuid.uuid4().hex[:12]}@boomboom.app"
    await client.post("/api/v1/auth/register", json={"email": email, "password": "password12"})
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "password12"}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "AUTH_ACCOUNT_NOT_VERIFIED"
