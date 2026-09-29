import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.router import api_router
from app.core.cache import MemoryCache
from app.core.exceptions import register_exception_handlers
from app.middleware.request_id import RequestIdMiddleware


@pytest.mark.asyncio
async def test_unauthenticated_me() -> None:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)
    register_exception_handlers(app)
    app.include_router(api_router)
    app.state.cache = MemoryCache()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
