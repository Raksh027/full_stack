import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from tests.isolation import require_isolated_database_url

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_email_unique_constraint() -> None:
    url = await require_isolated_database_url()
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            result = await conn.execute(
                text("SELECT conname FROM pg_constraint WHERE conname = 'uq_user_auth_email'")
            )
            row = result.first()
            assert row is not None
            assert row[0] == "uq_user_auth_email"
    finally:
        await engine.dispose()
