from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Protocol

from redis.asyncio import Redis
from redis.exceptions import TimeoutError as RedisTimeoutError

logger = logging.getLogger(__name__)

NOTIFICATION_QUEUE = "jobs:notifications"


def create_async_redis(url: str) -> Redis:
    """Async Redis client safe for blocking BRPOP.

    Socket timeout must not be shorter than the BRPOP wait or an empty
    queue raises TimeoutError and kills the worker.
    """
    return Redis.from_url(
        url,
        decode_responses=False,
        socket_connect_timeout=5,
        socket_timeout=None,
        retry_on_timeout=False,
    )


class JobQueue(Protocol):
    async def enqueue(self, payload: dict[str, Any]) -> None: ...

    async def dequeue(self, timeout: float = 5) -> dict[str, Any] | None: ...


class MemoryJobQueue:
    """In-process queue for tests. Production must use RedisJobQueue."""

    def __init__(self) -> None:
        self.items: list[dict[str, Any]] = []

    async def enqueue(self, payload: dict[str, Any]) -> None:
        self.items.append(dict(payload))

    async def dequeue(self, timeout: float = 5) -> dict[str, Any] | None:
        if not self.items:
            if timeout <= 0:
                return None
            await asyncio.sleep(min(timeout, 0.05))
            if not self.items:
                return None
        return self.items.pop(0)


class RedisJobQueue:
    def __init__(self, redis) -> None:
        self._redis = redis

    async def enqueue(self, payload: dict[str, Any]) -> None:
        await self._redis.lpush(NOTIFICATION_QUEUE, json.dumps(payload, default=str))

    async def dequeue(self, timeout: float = 5) -> dict[str, Any] | None:
        block_seconds = int(timeout) or 1
        try:
            result = await self._redis.brpop(NOTIFICATION_QUEUE, timeout=block_seconds)
        except RedisTimeoutError:
            # Empty queue or socket idle wait — BRPOP did not yield an item.
            return None
        except TimeoutError:
            return None
        if result is None:
            return None
        raw = result[1]
        if isinstance(raw, bytes):
            raw = raw.decode()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.info("job_payload_invalid")
            return None
        return parsed if isinstance(parsed, dict) else None
