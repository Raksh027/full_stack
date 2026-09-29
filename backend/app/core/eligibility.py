from uuid import UUID

from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.models.orm import ProfileVisibility, User, UserStatus

MESSAGING_BLOCKED_STATUSES = frozenset(
    {
        UserStatus.SUSPENDED.value,
        UserStatus.BANNED.value,
        UserStatus.PENDING_DELETION.value,
        UserStatus.DELETED.value,
    }
)

INTERACTION_BLOCKED_STATUSES = MESSAGING_BLOCKED_STATUSES


def parse_user_id(raw: str, *, field: str = "userId") -> UUID:
    try:
        return UUID(raw)
    except ValueError as exc:
        raise AppError("VALIDATION_ERROR", f"Invalid {field}.", 422) from exc


def account_is_active(user: User | None) -> bool:
    if user is None or user.deleted_at is not None:
        return False
    return user.status == UserStatus.ACTIVE.value


def account_can_message(user: User | None) -> bool:
    if user is None or user.deleted_at is not None:
        return False
    return user.status not in MESSAGING_BLOCKED_STATUSES


def target_is_visible_for_interaction(user: User) -> bool:
    if not account_is_active(user):
        return False
    profile = user.profile
    if profile is None:
        return False
    return profile.visibility != ProfileVisibility.HIDDEN.value


def require_interactable_target(target: User | None) -> User:
    if target is None or target.deleted_at is not None:
        raise NotFoundError("User not found.")
    if target.status in INTERACTION_BLOCKED_STATUSES:
        raise NotFoundError("User not found.")
    if not target_is_visible_for_interaction(target):
        raise NotFoundError("User not found.")
    return target


def require_not_self(actor_id: UUID, target_id: UUID, action: str) -> None:
    if actor_id == target_id:
        raise AppError("VALIDATION_ERROR", f"You cannot {action} yourself.", 422)


def require_not_blocked(blocked: bool) -> None:
    if blocked:
        raise ForbiddenError("This interaction is not allowed.")
