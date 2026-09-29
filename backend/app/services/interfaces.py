"""Future feature boundaries. Implementations belong to later phases."""

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID


class ProfileService(ABC):
    @abstractmethod
    async def get_me(self, user_id: UUID) -> Any: ...

    @abstractmethod
    async def update_me(self, user_id: UUID, payload: dict) -> Any: ...


class DiscoveryService(ABC):
    @abstractmethod
    async def feed(self, user_id: UUID, filters: dict) -> list[Any]: ...


class MatchingService(ABC):
    @abstractmethod
    async def like(self, user_id: UUID, target_id: UUID) -> Any: ...

    @abstractmethod
    async def dislike(self, user_id: UUID, target_id: UUID) -> None: ...


class LikesService(MatchingService):
    """Implemented by InteractionService."""

    pass


class ChatService(ABC):
    @abstractmethod
    async def list_conversations(self, user_id: UUID) -> list[Any]: ...


class NotificationService(ABC):
    @abstractmethod
    async def list_for_user(self, user_id: UUID) -> list[Any]: ...


class MediaService(ABC):
    @abstractmethod
    async def attach(self, user_id: UUID, url: str) -> Any: ...


class VerificationService(ABC):
    @abstractmethod
    async def submit_selfie(self, user_id: UUID, object_key: str) -> Any: ...


class VerificationReviewService(ABC):
    @abstractmethod
    async def review(self, reviewer_id: UUID, request_id: UUID, action: str) -> Any: ...


class EventService(ABC):
    @abstractmethod
    async def list_events(self, user: Any, limit: int, cursor: str | None) -> dict[str, Any]: ...

    @abstractmethod
    async def get_event(self, user: Any, event_id: UUID) -> dict[str, Any]: ...

    @abstractmethod
    async def create_event(self, user: Any, payload: Any) -> dict[str, Any]: ...

    @abstractmethod
    async def update_event(self, user: Any, event_id: UUID, payload: Any) -> dict[str, Any]: ...

    @abstractmethod
    async def cancel_event(self, user: Any, event_id: UUID) -> dict[str, Any]: ...

    @abstractmethod
    async def rsvp(self, user: Any, event_id: UUID) -> dict[str, Any]: ...

    @abstractmethod
    async def cancel_rsvp(self, user: Any, event_id: UUID) -> dict[str, Any]: ...

    @abstractmethod
    async def create_cover_upload_url(
        self, user: Any, event_id: UUID, payload: Any
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def set_cover(self, user: Any, event_id: UUID, storage_key: str) -> dict[str, Any]: ...

    @abstractmethod
    async def remove_cover(self, user: Any, event_id: UUID) -> dict[str, Any]: ...


class TonightService(ABC):
    @abstractmethod
    async def list_plans(self, user_id: UUID) -> list[Any]: ...


class TravelService(ABC):
    @abstractmethod
    async def list_plans(self, user_id: UUID) -> list[Any]: ...


class SubscriptionService(ABC):
    @abstractmethod
    async def current(self, user_id: UUID) -> Any: ...


class SafetyService(ABC):
    @abstractmethod
    async def report(self, reporter_id: UUID, target_id: UUID, reason: str) -> None: ...

    @abstractmethod
    async def block(self, user_id: UUID, target_id: UUID) -> None: ...


class AdminService(ABC):
    @abstractmethod
    async def moderate_user(self, actor_id: UUID, target_id: UUID, status: str) -> None: ...


class FavoritesService(ABC):
    @abstractmethod
    async def add(self, user_id: UUID, target_id: UUID) -> None: ...
