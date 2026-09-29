from collections.abc import Callable
from typing import Annotated

from fastapi import Depends

from app.core.errors import ForbiddenError
from app.dependencies.auth import get_current_user
from app.models.orm import User, UserRole

STAFF_ROLES = frozenset({UserRole.REVIEWER.value, UserRole.ADMIN.value})
ADMIN_ROLES = frozenset({UserRole.ADMIN.value})

PERMISSIONS: dict[str, frozenset[str]] = {
    "admin.dashboard": STAFF_ROLES,
    "admin.verification": STAFF_ROLES,
    "admin.reports.read": STAFF_ROLES,
    "admin.reports.write": ADMIN_ROLES,
    "admin.users.read": STAFF_ROLES,
    "admin.users.moderate": ADMIN_ROLES,
    "admin.audit": ADMIN_ROLES,
    "admin.roles": ADMIN_ROLES,
    "admin.events.read": STAFF_ROLES,
    "admin.events.moderate": ADMIN_ROLES,
}


def has_permission(user: User, permission: str) -> bool:
    allowed = PERMISSIONS.get(permission, frozenset())
    return user.role in allowed


def require_permission(permission: str) -> Callable:
    async def _inner(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role == UserRole.USER.value or not has_permission(user, permission):
            raise ForbiddenError("Admin access required.")
        return user

    return _inner


def require_staff(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role not in STAFF_ROLES:
        raise ForbiddenError("Staff access required.")
    return user


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role not in ADMIN_ROLES:
        raise ForbiddenError("Admin access required.")
    return user
