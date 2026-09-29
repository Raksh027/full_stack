from __future__ import annotations

import json
from typing import Protocol


class CacheBackend(Protocol):
    async def get(self, key: str) -> str | None: ...
    async def set(self, key: str, value: str, ex: int | None = None) -> None: ...
    async def incr(self, key: str) -> int: ...
    async def expire(self, key: str, seconds: int) -> None: ...
    async def delete(self, key: str) -> None: ...
    async def ping(self) -> bool: ...


class RedisCache:
    def __init__(self, redis) -> None:
        self._redis = redis

    async def get(self, key: str) -> str | None:
        value = await self._redis.get(key)
        if value is None:
            return None
        return value.decode() if isinstance(value, bytes) else str(value)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        await self._redis.set(key, value, ex=ex)

    async def incr(self, key: str) -> int:
        return int(await self._redis.incr(key))

    async def expire(self, key: str, seconds: int) -> None:
        await self._redis.expire(key, seconds)

    async def delete(self, key: str) -> None:
        await self._redis.delete(key)

    async def ping(self) -> bool:
        return bool(await self._redis.ping())


class MemoryCache:
    """Test-only cache. Production wiring must use RedisCache."""

    def __init__(self) -> None:
        self._data: dict[str, str] = {}
        self._ttl: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self._data.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._data[key] = value
        if ex is not None:
            self._ttl[key] = ex

    async def incr(self, key: str) -> int:
        current = int(self._data.get(key, "0")) + 1
        self._data[key] = str(current)
        return current

    async def expire(self, key: str, seconds: int) -> None:
        self._ttl[key] = seconds

    async def delete(self, key: str) -> None:
        self._data.pop(key, None)
        self._ttl.pop(key, None)

    async def ping(self) -> bool:
        return True


def json_dumps(payload: dict) -> str:
    return json.dumps(payload)
