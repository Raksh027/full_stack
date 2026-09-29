import asyncio
import uuid

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

from app.core.jobs import MemoryJobQueue, RedisJobQueue
from app.core.push import RecordingPushProvider
from app.core.realtime import PresenceStore
from app.models.orm import NotificationDeliveryStatus, NotificationType
from app.workers.notifications import consume_notification_jobs, deliver_notification_job


class _Row:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _Inbox:
    def __init__(self, row):
        self.row = row
        self.status = None

    async def get(self, _notification_id):
        return self.row

    async def set_status(self, _notification_id, status):
        self.status = status
        self.row.delivery_status = status


class _Devices:
    def __init__(self, tokens):
        self.tokens = tokens
        self.deactivated = []

    async def list_active_for_user(self, _user_id):
        return [_Row(token=token) for token in self.tokens]

    async def deactivate_tokens(self, tokens):
        self.deactivated.extend(tokens)


@pytest.mark.asyncio
async def test_memory_job_queue_roundtrip() -> None:
    jobs = MemoryJobQueue()
    await jobs.enqueue({"notification_id": "n1", "attempt": 0})
    payload = await jobs.dequeue(0)
    assert payload["notification_id"] == "n1"
    assert await jobs.dequeue(0) is None


@pytest.mark.asyncio
async def test_invalid_token_deactivates(monkeypatch) -> None:
    jobs = MemoryJobQueue()
    push = RecordingPushProvider()
    push.invalid_tokens.add("dead-token")
    row = _Row(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        type=NotificationType.LIKE_RECEIVED.value,
        title="New like",
        body="Someone liked you",
        data_json={"type": "LIKE_RECEIVED", "entity_id": "l1"},
        related_entity_id=uuid.uuid4(),
        event_key="like:l1",
        delivery_status=NotificationDeliveryStatus.QUEUED.value,
    )
    inbox = _Inbox(row)
    devices = _Devices(["dead-token"])

    monkeypatch.setattr("app.workers.notifications.NotificationRepository", lambda _session: inbox)
    monkeypatch.setattr("app.workers.notifications.DeviceTokenRepository", lambda _session: devices)

    class _Session:
        async def commit(self):
            return None

        async def rollback(self):
            return None

    await deliver_notification_job(
        session=_Session(),
        jobs=jobs,
        push=push,
        presence=None,
        payload={"notification_id": str(row.id), "attempt": 0},
    )
    assert inbox.status == NotificationDeliveryStatus.INVALID_TOKEN.value
    assert devices.deactivated == ["dead-token"]


@pytest.mark.asyncio
async def test_retry_on_provider_failure(monkeypatch) -> None:
    jobs = MemoryJobQueue()
    push = RecordingPushProvider()
    push.fail_retryable = True
    row = _Row(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        type=NotificationType.MATCH_CREATED.value,
        title="It's a match",
        body="You have a new match",
        data_json={"type": "MATCH_CREATED", "entity_id": "m1"},
        related_entity_id=uuid.uuid4(),
        event_key="match:m1",
        delivery_status=NotificationDeliveryStatus.QUEUED.value,
    )
    inbox = _Inbox(row)
    devices = _Devices(["token-1"])
    monkeypatch.setattr("app.workers.notifications.NotificationRepository", lambda _session: inbox)
    monkeypatch.setattr("app.workers.notifications.DeviceTokenRepository", lambda _session: devices)

    class _Session:
        async def commit(self):
            return None

        async def rollback(self):
            return None

    session = _Session()
    await deliver_notification_job(
        session,
        jobs,
        push,
        None,
        {"notification_id": str(row.id), "attempt": 0},
    )
    retried = await jobs.dequeue(0)
    assert retried is not None
    assert retried["attempt"] == 1


@pytest.mark.asyncio
async def test_skips_push_when_focused_on_conversation(monkeypatch) -> None:
    from app.core.cache import MemoryCache

    conversation_id = uuid.uuid4()
    user_id = uuid.uuid4()
    presence = PresenceStore(MemoryCache())
    await presence.set_focus(user_id, conversation_id)
    row = _Row(
        id=uuid.uuid4(),
        user_id=user_id,
        type=NotificationType.NEW_MESSAGE.value,
        title="New message",
        body="You have a new message",
        data_json={"type": "NEW_MESSAGE", "entity_id": str(conversation_id)},
        related_entity_id=conversation_id,
        event_key="message:x",
        delivery_status=NotificationDeliveryStatus.QUEUED.value,
    )
    inbox = _Inbox(row)
    devices = _Devices(["token-1"])
    push = RecordingPushProvider()
    monkeypatch.setattr("app.workers.notifications.NotificationRepository", lambda _session: inbox)
    monkeypatch.setattr("app.workers.notifications.DeviceTokenRepository", lambda _session: devices)

    class _Session:
        async def commit(self):
            return None

        async def rollback(self):
            return None

    await deliver_notification_job(
        _Session(),
        MemoryJobQueue(),
        push,
        presence,
        {"notification_id": str(row.id), "attempt": 0},
    )
    assert push.sent == []
    assert inbox.status is None


class _FakeRedis:
    def __init__(self) -> None:
        self.items: list[bytes] = []
        self.brpop_error: BaseException | None = None

    async def lpush(self, _key, value):
        raw = value.encode() if isinstance(value, str) else value
        self.items.insert(0, raw)

    async def brpop(self, _key, timeout=0):
        if self.brpop_error is not None:
            raise self.brpop_error
        if not self.items:
            return None
        return ("jobs:notifications", self.items.pop())


class _SessionFactory:
    def __init__(self, session):
        self._session = session

    def __call__(self):
        return self

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *_exc):
        return None


class _QueueScript:
    def __init__(self, outcomes: list):
        self.outcomes = list(outcomes)
        self.dequeues = 0
        self._idle = asyncio.Event()

    async def dequeue(self, timeout: float = 5):
        self.dequeues += 1
        if not self.outcomes:
            await self._idle.wait()
            return None
        item = self.outcomes.pop(0)
        if isinstance(item, BaseException):
            raise item
        return item

    async def enqueue(self, payload):
        return None


async def _run_until_cancel(coro):
    task = asyncio.create_task(coro)
    try:
        await asyncio.sleep(0)
        for _ in range(20):
            if task.done():
                break
            await asyncio.sleep(0)
        assert not task.done()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    finally:
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


@pytest.mark.asyncio
async def test_redis_dequeue_empty_queue_returns_none() -> None:
    jobs = RedisJobQueue(_FakeRedis())
    assert await jobs.dequeue(timeout=1) is None


@pytest.mark.asyncio
async def test_redis_dequeue_timeout_returns_none_not_raise() -> None:
    redis = _FakeRedis()
    redis.brpop_error = RedisTimeoutError("Timeout reading from redis:6379")
    jobs = RedisJobQueue(redis)
    assert await jobs.dequeue(timeout=5) is None


@pytest.mark.asyncio
async def test_redis_dequeue_processes_queued_job_once() -> None:
    redis = _FakeRedis()
    jobs = RedisJobQueue(redis)
    await jobs.enqueue({"notification_id": "n-once", "attempt": 0})
    first = await jobs.dequeue(timeout=1)
    second = await jobs.dequeue(timeout=1)
    assert first == {"notification_id": "n-once", "attempt": 0}
    assert second is None


@pytest.mark.asyncio
async def test_redis_dequeue_connection_error_propagates() -> None:
    redis = _FakeRedis()
    redis.brpop_error = RedisConnectionError("Connection refused")
    jobs = RedisJobQueue(redis)
    with pytest.raises(RedisConnectionError):
        await jobs.dequeue(timeout=1)


@pytest.mark.asyncio
async def test_worker_empty_queue_does_not_crash() -> None:
    jobs = _QueueScript([None, None])
    await _run_until_cancel(
        consume_notification_jobs(
            jobs, RecordingPushProvider(), None, _SessionFactory(_SessionStub())
        ),
    )
    assert jobs.dequeues >= 2


@pytest.mark.asyncio
async def test_worker_timeout_does_not_terminate() -> None:
    jobs = _QueueScript([TimeoutError("Timeout reading from redis:6379")])
    await _run_until_cancel(
        consume_notification_jobs(
            jobs, RecordingPushProvider(), None, _SessionFactory(_SessionStub())
        ),
    )
    assert not jobs.outcomes


@pytest.mark.asyncio
async def test_worker_connection_error_retries_with_backoff() -> None:
    sleeps: list[float] = []

    async def _sleep(delay: float):
        sleeps.append(delay)

    jobs = _QueueScript(
        [
            RedisConnectionError("down"),
            RedisConnectionError("down"),
            None,
        ]
    )
    await _run_until_cancel(
        consume_notification_jobs(
            jobs,
            RecordingPushProvider(),
            None,
            _SessionFactory(_SessionStub()),
            retry_initial=0.5,
            retry_max=2.0,
            sleeper=_sleep,
        ),
    )
    assert sleeps[:2] == [0.5, 1.0]


@pytest.mark.asyncio
async def test_worker_processes_successful_job_once(monkeypatch) -> None:
    nid = uuid.uuid4()
    row = _Row(
        id=nid,
        user_id=uuid.uuid4(),
        type=NotificationType.LIKE_RECEIVED.value,
        title="New like",
        body="Someone liked you",
        data_json={"type": "LIKE_RECEIVED"},
        related_entity_id=uuid.uuid4(),
        event_key="like:l1",
        delivery_status=NotificationDeliveryStatus.QUEUED.value,
    )
    inbox = _Inbox(row)
    devices = _Devices(["token-1"])
    push = RecordingPushProvider()
    monkeypatch.setattr("app.workers.notifications.NotificationRepository", lambda _session: inbox)
    monkeypatch.setattr("app.workers.notifications.DeviceTokenRepository", lambda _session: devices)

    jobs = _QueueScript([{"notification_id": str(nid), "attempt": 0}])
    await _run_until_cancel(
        consume_notification_jobs(jobs, push, None, _SessionFactory(_SessionStub())),
    )
    assert len(push.sent) == 1
    assert inbox.status == NotificationDeliveryStatus.SENT.value
    assert jobs.dequeues >= 1


class _SessionStub:
    async def commit(self):
        return None

    async def rollback(self):
        return None
