import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.health import router as health_router
from app.core.cache import MemoryCache
from app.core.exceptions import register_exception_handlers
from app.middleware.request_id import RequestIdMiddleware


@pytest.mark.asyncio
async def test_health_liveness() -> None:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)
    register_exception_handlers(app)
    app.include_router(health_router)
    app.state.cache = MemoryCache()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert "request_id" in body


@pytest.mark.asyncio
async def test_ready_reports_failure_without_backends() -> None:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)
    register_exception_handlers(app)
    app.include_router(health_router)
    app.state.cache = MemoryCache()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ready")
    assert response.status_code == 503
    assert response.json()["data"]["postgres"] is False
    assert response.json()["data"]["redis"] is True
