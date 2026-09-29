from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Any, Protocol
from uuid import UUID

from app.core.cache import CacheBackend

logger = logging.getLogger(__name__)

CHAT_CHANNEL_PREFIX = "chat:conv:"
NOTIFY_CHANNEL_PREFIX = "notify:user:"
PRESENCE_CHANNEL = "chat:presence"
PRESENCE_KEY = "presence:{user_id}"
PRESENCE_CONN_KEY = "presence:conn:{user_id}"
PRESENCE_FOCUS_KEY = "presence:focus:{user_id}"


class RealtimeBroker(Protocol):
    async def publish(self, channel: str, payload: str) -> None: ...

    def listen(self, patterns: list[str]) -> AsyncIterator[tuple[str, str]]: ...


class MemoryBroker:
    """In-process pub/sub for tests. Production must use RedisBroker."""

    def __init__(self) -> None:
        self._queues: list[asyncio.Queue[tuple[str, str]]] = []

    async def publish(self, channel: str, payload: str) -> None:
        for queue in list(self._queues):
            await queue.put((channel, payload))

    async def listen(self, patterns: list[str]) -> AsyncIterator[tuple[str, str]]:
        queue: asyncio.Queue[tuple[str, str]] = asyncio.Queue()
        self._queues.append(queue)
        try:
            while True:
                channel, payload = await queue.get()
                if _matches_any(channel, patterns):
                    yield channel, payload
        finally:
            if queue in self._queues:
                self._queues.remove(queue)


class RedisBroker:
    def __init__(self, redis) -> None:
        self._redis = redis

    async def publish(self, channel: str, payload: str) -> None:
        await self._redis.publish(channel, payload)

    async def listen(self, patterns: list[str]) -> AsyncIterator[tuple[str, str]]:
        pubsub = self._redis.pubsub()
        await pubsub.psubscribe(*patterns)
        try:
            async for message in pubsub.listen():
                if message is None:
                    continue
                kind = message.get("type")
                if kind not in {"pmessage", "message"}:
                    continue
                channel = message.get("channel")
                data = message.get("data")
                if isinstance(channel, bytes):
                    channel = channel.decode()
                if isinstance(data, bytes):
                    data = data.decode()
                if channel and data:
                    yield str(channel), str(data)
        finally:
            await pubsub.aclose()


class PresenceStore:
    def __init__(self, cache: CacheBackend, ttl_seconds: int = 45) -> None:
        self._cache = cache
        self._ttl = ttl_seconds

    async def heartbeat(self, user_id: UUID, last_seen_iso: str) -> None:
        await self._cache.set(PRESENCE_KEY.format(user_id=user_id), last_seen_iso, ex=self._ttl)

    async def set_focus(self, user_id: UUID, conversation_id: UUID) -> None:
        await self._cache.set(
            PRESENCE_FOCUS_KEY.format(user_id=user_id),
            str(conversation_id),
            ex=self._ttl * 4,
        )

    async def clear_focus(self, user_id: UUID, conversation_id: UUID | None = None) -> None:
        key = PRESENCE_FOCUS_KEY.format(user_id=user_id)
        if conversation_id is not None:
            current = await self._cache.get(key)
            if current != str(conversation_id):
                return
        await self._cache.delete(key)

    async def focused_conversation(self, user_id: UUID) -> UUID | None:
        raw = await self._cache.get(PRESENCE_FOCUS_KEY.format(user_id=user_id))
        if not raw:
            return None
        try:
            return UUID(raw)
        except ValueError:
            return None

    async def add_connection(self, user_id: UUID) -> int:
        key = PRESENCE_CONN_KEY.format(user_id=user_id)
        count = await self._cache.incr(key)
        await self._cache.expire(key, self._ttl * 4)
        return count

    async def remove_connection(self, user_id: UUID) -> int:
        key = PRESENCE_CONN_KEY.format(user_id=user_id)
        raw = await self._cache.get(key)
        current = int(raw or "0")
        nxt = max(current - 1, 0)
        if nxt == 0:
            await self._cache.delete(key)
            await self._cache.delete(PRESENCE_KEY.format(user_id=user_id))
        else:
            await self._cache.set(key, str(nxt), ex=self._ttl * 4)
        return nxt

    async def is_online(self, user_id: UUID) -> bool:
        return await self._cache.get(PRESENCE_KEY.format(user_id=user_id)) is not None

    async def last_seen(self, user_id: UUID) -> str | None:
        return await self._cache.get(PRESENCE_KEY.format(user_id=user_id))

    async def online_map(self, user_ids: list[UUID]) -> dict[UUID, bool]:
        result: dict[UUID, bool] = {}
        for user_id in user_ids:
            result[user_id] = await self.is_online(user_id)
        return result


class ConnectionHub:
    """Process-local WebSocket registry. Cross-instance fan-out uses Redis."""

    def __init__(self) -> None:
        self.by_conversation: dict[UUID, set[Any]] = defaultdict(set)
        self.by_user: dict[UUID, set[Any]] = defaultdict(set)
        self.meta: dict[Any, tuple[UUID, UUID | None]] = {}

    def add(self, websocket: Any, user_id: UUID, conversation_id: UUID | None) -> None:
        if conversation_id is not None:
            self.by_conversation[conversation_id].add(websocket)
        self.by_user[user_id].add(websocket)
        self.meta[websocket] = (user_id, conversation_id)

    def remove(self, websocket: Any) -> tuple[UUID, UUID | None] | None:
        meta = self.meta.pop(websocket, None)
        if meta is None:
            return None
        user_id, conversation_id = meta
        sockets = self.by_conversation.get(conversation_id) if conversation_id else None
        if sockets is not None:
            sockets.discard(websocket)
            if not sockets:
                self.by_conversation.pop(conversation_id, None)
        user_sockets = self.by_user.get(user_id)
        if user_sockets is not None:
            user_sockets.discard(websocket)
            if not user_sockets:
                self.by_user.pop(user_id, None)
        return meta

    def conversation_sockets(self, conversation_id: UUID) -> list[Any]:
        return list(self.by_conversation.get(conversation_id, ()))

    def user_sockets(self, user_id: UUID) -> list[Any]:
        return list(self.by_user.get(user_id, ()))


def conversation_channel(conversation_id: UUID) -> str:
    return f"{CHAT_CHANNEL_PREFIX}{conversation_id}"


def user_notify_channel(user_id: UUID) -> str:
    return f"{NOTIFY_CHANNEL_PREFIX}{user_id}"


def encode_event(event_type: str, data: dict[str, Any]) -> str:
    return json.dumps({"type": event_type, "data": data}, default=str)


def decode_event(payload: str) -> dict[str, Any]:
    parsed = json.loads(payload)
    if not isinstance(parsed, dict) or "type" not in parsed:
        raise ValueError("invalid event")
    parsed.setdefault("data", {})
    return parsed


def _matches_any(channel: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        if pattern.endswith("*"):
            if channel.startswith(pattern[:-1]):
                return True
        elif channel == pattern:
            return True
    return True
