"""Provider boundary. No vendor SDK is wired in this phase."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID, uuid4


class VerificationProvider(ABC):
    """Session adapter for a future third-party selfie/identity provider.

    Implementations must not perform biometric matching unless a real vendor
    is configured. This interface only tracks session lifecycle.
    """

    @abstractmethod
    async def create_verification_session(
        self, user_id: UUID, verification_type: str
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def submit_verification(
        self, session_id: str, media_refs: list[str]
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def get_verification_status(self, session_id: str) -> dict[str, Any]: ...

    @abstractmethod
    async def cancel_verification(self, session_id: str) -> dict[str, Any]: ...


class MockVerificationProvider(VerificationProvider):
    """In-process session store for development and automated tests.

    It records that a selfie was submitted. It does not detect liveness,
    compare faces, or verify government identity.
    """

    def __init__(self) -> None:
        self.sessions: dict[str, dict[str, Any]] = {}
        self.failures: set[str] = set()

    def fail_next(self, operation: str) -> None:
        self.failures.add(operation)

    def _maybe_fail(self, operation: str) -> None:
        if operation in self.failures:
            self.failures.discard(operation)
            raise RuntimeError(f"provider_{operation}_failed")

    async def create_verification_session(
        self, user_id: UUID, verification_type: str
    ) -> dict[str, Any]:
        self._maybe_fail("create")
        session_id = str(uuid4())
        self.sessions[session_id] = {
            "sessionId": session_id,
            "userId": str(user_id),
            "verificationType": verification_type,
            "status": "CREATED",
            "mediaRefs": [],
        }
        return dict(self.sessions[session_id])

    async def submit_verification(self, session_id: str, media_refs: list[str]) -> dict[str, Any]:
        self._maybe_fail("submit")
        session = self.sessions.get(session_id)
        if session is None:
            raise KeyError(session_id)
        session["status"] = "SUBMITTED"
        session["mediaRefs"] = list(media_refs)
        return dict(session)

    async def get_verification_status(self, session_id: str) -> dict[str, Any]:
        self._maybe_fail("status")
        session = self.sessions.get(session_id)
        if session is None:
            raise KeyError(session_id)
        return dict(session)

    async def cancel_verification(self, session_id: str) -> dict[str, Any]:
        self._maybe_fail("cancel")
        session = self.sessions.get(session_id)
        if session is None:
            raise KeyError(session_id)
        session["status"] = "CANCELLED"
        return dict(session)


class RecordingVerificationProvider(MockVerificationProvider):
    def __init__(self) -> None:
        super().__init__()
        self.calls: list[str] = []

    async def create_verification_session(
        self, user_id: UUID, verification_type: str
    ) -> dict[str, Any]:
        self.calls.append("create")
        return await super().create_verification_session(user_id, verification_type)

    async def submit_verification(self, session_id: str, media_refs: list[str]) -> dict[str, Any]:
        self.calls.append("submit")
        return await super().submit_verification(session_id, media_refs)

    async def get_verification_status(self, session_id: str) -> dict[str, Any]:
        self.calls.append("status")
        return await super().get_verification_status(session_id)

    async def cancel_verification(self, session_id: str) -> dict[str, Any]:
        self.calls.append("cancel")
        return await super().cancel_verification(session_id)
