from fastapi import APIRouter, Request
from sqlalchemy import text

from app.api.v1.responses import success

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health(request: Request):
    return success(request, {"status": "ok"})


@router.get("/ready")
async def ready(request: Request):
    postgres_ok = False
    redis_ok = False
    try:
        async with request.app.state.session_factory() as session:
            await session.execute(text("SELECT 1"))
            postgres_ok = True
    except Exception:
        postgres_ok = False
    try:
        redis_ok = await request.app.state.cache.ping()
    except Exception:
        redis_ok = False
    payload = {"postgres": postgres_ok, "redis": redis_ok}
    status = 200 if postgres_ok and redis_ok else 503
    return success(request, payload, status)
