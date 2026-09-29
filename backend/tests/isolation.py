"""Isolated PostgreSQL database for integration tests.

Uses a dedicated `boomboom_test` database (never the shared development DB)
and truncates application rows around each test so leftover users cannot
pollute discovery feeds.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.cache import MemoryCache
from app.core.exceptions import register_exception_handlers
from app.core.jobs import MemoryJobQueue
from app.core.otp import OTPService
from app.dependencies.auth import get_otp
from app.middleware.request_id import RequestIdMiddleware
from tests.conftest import CapturingOTPProvider

ISOLATED_DB_NAME = "boomboom_test"


def _source_url() -> str | None:
    raw = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
    if raw:
        return raw
    # Fall back to app Settings (`.env` or documented local Docker defaults).
    return get_settings().database_url


def _render(url) -> str:
    return url.render_as_string(hide_password=False)


def isolated_database_url() -> str | None:
    raw = _source_url()
    if not raw or "sqlite" in raw:
        return None
    url = make_url(raw)
    if url.database == ISOLATED_DB_NAME:
        return raw
    return _render(url.set(database=ISOLATED_DB_NAME))


def _admin_url(raw: str) -> str:
    url = make_url(raw)
    return _render(url.set(database=url.database or "boomboom"))


async def ensure_isolated_database() -> str:
    isolated = isolated_database_url()
    if isolated is None:
        raise RuntimeError("PostgreSQL URL required")
    source = _source_url()
    assert source is not None
    probe = create_async_engine(isolated, pool_pre_ping=True)
    try:
        async with probe.connect() as conn:
            await conn.execute(text("SELECT 1"))
        await probe.dispose()
        return isolated
    except Exception:
        await probe.dispose()

    admin = create_async_engine(_admin_url(source), isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        exists = await conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": ISOLATED_DB_NAME},
        )
        if exists.first() is None:
            await conn.execute(text(f"CREATE DATABASE {ISOLATED_DB_NAME}"))
    await admin.dispose()

    created = create_async_engine(isolated)
    async with created.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    await created.dispose()
    return isolated


def _upgrade_schema(url: str) -> None:
    from alembic.config import Config

    from alembic import command

    here = Path(__file__).resolve().parents[1]
    cfg = Config(str(here / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")


TRUNCATE_SQL = """
TRUNCATE TABLE
  users,
  audit_logs,
  billing_webhook_events
CASCADE
"""


async def reset_isolated_data(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.execute(text(TRUNCATE_SQL))


async def require_isolated_database_url() -> str:
    """Resolve boomboom_test for older HTTP integration fixtures.

    Falls back to Settings/.env like isolated_app, never the shared
    development database name, and skips only when Postgres is absent.
    """
    if isolated_database_url() is None:
        pytest.skip("PostgreSQL TEST_DATABASE_URL/DATABASE_URL required")
    try:
        url = await ensure_isolated_database()
    except Exception:
        pytest.skip("PostgreSQL is not reachable")
    await asyncio.to_thread(_upgrade_schema, url)
    return url


@dataclass
class IsolatedApp:
    http: AsyncClient
    otp: CapturingOTPProvider
    factory: async_sessionmaker
    app: FastAPI
    engine: AsyncEngine


@pytest.fixture
async def isolated_app(
    otp_provider: CapturingOTPProvider, tmp_path, monkeypatch
) -> AsyncIterator[IsolatedApp]:
    if isolated_database_url() is None:
        pytest.skip("PostgreSQL TEST_DATABASE_URL/DATABASE_URL required")
    try:
        url = await ensure_isolated_database()
    except Exception:
        pytest.skip("PostgreSQL is not reachable")
    monkeypatch.setenv("MEDIA_STORAGE_PATH", str(tmp_path))
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    await asyncio.to_thread(_upgrade_schema, url)
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
    app.state.jobs = MemoryJobQueue()

    async def otp_override():
        return OTPService(cache, settings, otp_provider)

    app.dependency_overrides[get_otp] = otp_override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield IsolatedApp(http=http, otp=otp_provider, factory=factory, app=app, engine=engine)
    await reset_isolated_data(engine)
    await engine.dispose()
    get_settings.cache_clear()
