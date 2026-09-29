from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.jobs import JobQueue, RedisJobQueue, create_async_redis
from app.core.logging import configure_logging
from app.core.push import PushProvider, build_push_provider
from app.core.realtime import PresenceStore
from app.db.session import create_engine, create_session_factory
from app.models.orm import NotificationDeliveryStatus
from app.repositories.notifications import DeviceTokenRepository, NotificationRepository

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
REDIS_RETRY_INITIAL_SECONDS = 0.5
REDIS_RETRY_MAX_SECONDS = 30.0


async def deliver_notification_job(
    session: AsyncSession,
    jobs: JobQueue,
    push: PushProvider,
    presence: PresenceStore | None,
    payload: dict,
) -> None:
    started = datetime.now(UTC)
    raw_id = payload.get("notification_id")
    attempt = int(payload.get("attempt") or 0)
    try:
        notification_id = UUID(str(raw_id))
    except (TypeError, ValueError):
        logger.info("notification_job_invalid event_id=%s", raw_id)
        return

    inbox = NotificationRepository(session)
    devices = DeviceTokenRepository(session)
    row = await inbox.get(notification_id)
    if row is None:
        return
    if row.delivery_status == NotificationDeliveryStatus.SENT.value:
        return

    data = {str(k): str(v) for k, v in (row.data_json or {}).items()}
    data.setdefault("type", row.type)
    if row.related_entity_id and "entity_id" not in data:
        data["entity_id"] = str(row.related_entity_id)

    if row.type == "NEW_MESSAGE" and presence is not None and row.related_entity_id is not None:
        focused = await presence.focused_conversation(row.user_id)
        if focused == row.related_entity_id:
            latency_ms = int((datetime.now(UTC) - started).total_seconds() * 1000)
            logger.info(
                "notification_push_skipped notification_id=%s type=%s "
                "reason=in_conversation latency_ms=%s",
                row.id,
                row.type,
                latency_ms,
            )
            return

    tokens = [item.token for item in await devices.list_active_for_user(row.user_id)]
    if not tokens:
        latency_ms = int((datetime.now(UTC) - started).total_seconds() * 1000)
        logger.info(
            "notification_push_no_devices notification_id=%s type=%s latency_ms=%s",
            row.id,
            row.type,
            latency_ms,
        )
        return

    result = await push.send(
        tokens,
        title=row.title,
        body=row.body,
        data=data,
        collapse_key=row.event_key,
    )
    if result.invalid_tokens:
        await devices.deactivate_tokens(result.invalid_tokens)
        logger.info(
            "notification_invalid_token notification_id=%s count=%s",
            row.id,
            len(result.invalid_tokens),
        )
    if result.success_count > 0:
        await inbox.set_status(notification_id, NotificationDeliveryStatus.SENT.value)
        await session.commit()
        latency_ms = int((datetime.now(UTC) - started).total_seconds() * 1000)
        logger.info(
            "notification_push_sent notification_id=%s type=%s event_id=%s latency_ms=%s",
            row.id,
            row.type,
            row.event_key,
            latency_ms,
        )
        return
    if result.invalid_tokens and result.success_count == 0 and not result.retryable:
        await inbox.set_status(notification_id, NotificationDeliveryStatus.INVALID_TOKEN.value)
        await session.commit()
        return
    if result.retryable and attempt + 1 < MAX_ATTEMPTS:
        delay = min(2**attempt, 30)
        await session.rollback()
        await asyncio.sleep(delay)
        await jobs.enqueue({"notification_id": str(notification_id), "attempt": attempt + 1})
        logger.info(
            "notification_push_retry notification_id=%s attempt=%s code=%s",
            row.id,
            attempt + 1,
            result.error_code,
        )
        return
    await inbox.set_status(notification_id, NotificationDeliveryStatus.FAILED.value)
    await session.commit()
    logger.info(
        "notification_push_failed notification_id=%s type=%s code=%s",
        row.id,
        row.type,
        result.error_code,
    )


async def consume_notification_jobs(
    jobs: JobQueue,
    push: PushProvider,
    presence: PresenceStore | None,
    factory,
    *,
    retry_initial: float = REDIS_RETRY_INITIAL_SECONDS,
    retry_max: float = REDIS_RETRY_MAX_SECONDS,
    sleeper=asyncio.sleep,
) -> None:
    delay = retry_initial
    while True:
        try:
            payload = await jobs.dequeue(timeout=5)
        except asyncio.CancelledError:
            raise
        except RedisConnectionError:
            logger.info("notification_worker_redis_unavailable retry_in=%.1f", delay)
            await sleeper(delay)
            delay = min(delay * 2, retry_max)
            continue
        except TimeoutError:
            delay = retry_initial
            continue
        delay = retry_initial
        if payload is None:
            continue
        try:
            async with factory() as session:
                await deliver_notification_job(session, jobs, push, presence, payload)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.info("notification_worker_error")


async def run_notification_worker(app) -> None:
    await consume_notification_jobs(
        app.state.jobs,
        app.state.push,
        getattr(app.state, "presence", None),
        app.state.session_factory,
    )


async def main() -> None:
    settings = get_settings()
    configure_logging(settings)
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    redis = create_async_redis(settings.redis_url)
    from app.core.cache import RedisCache

    jobs = RedisJobQueue(redis)
    push = build_push_provider(settings)
    presence = PresenceStore(RedisCache(redis))
    try:
        await consume_notification_jobs(jobs, push, presence, factory)
    finally:
        await redis.aclose()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
