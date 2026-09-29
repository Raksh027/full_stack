"""Hooks for later automated content checks. No AI is implemented."""

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID


class ModerationProvider(ABC):
    @abstractmethod
    async def review_text(self, text: str, context: str) -> dict[str, Any]: ...

    @abstractmethod
    async def review_media(self, storage_key: str) -> dict[str, Any]: ...


class ContentRiskService(ABC):
    @abstractmethod
    async def score_user(self, user_id: UUID) -> dict[str, Any]: ...


class NoopModerationProvider(ModerationProvider):
    async def review_text(self, text: str, context: str) -> dict[str, Any]:
        _ = text, context
        return {"provider": "noop", "decision": "UNREVIEWED", "automated": False}

    async def review_media(self, storage_key: str) -> dict[str, Any]:
        _ = storage_key
        return {"provider": "noop", "decision": "UNREVIEWED", "automated": False}


class NoopContentRiskService(ContentRiskService):
    async def score_user(self, user_id: UUID) -> dict[str, Any]:
        return {"userId": str(user_id), "score": None, "automated": False}
