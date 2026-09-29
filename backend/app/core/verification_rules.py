from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.core.errors import AppError, ForbiddenError
from app.models.orm import (
    User,
    UserRole,
    UserStatus,
    VerificationRejectionReason,
    VerificationRequestStatus,
    VerificationReviewAction,
    VerificationStatus,
    VerificationType,
)

ACTIVE_REQUEST_STATUSES = frozenset(
    {
        VerificationRequestStatus.PENDING.value,
        VerificationRequestStatus.IN_REVIEW.value,
    }
)
TERMINAL_REQUEST_STATUSES = frozenset(
    {
        VerificationRequestStatus.APPROVED.value,
        VerificationRequestStatus.REJECTED.value,
        VerificationRequestStatus.EXPIRED.value,
        VerificationRequestStatus.CANCELLED.value,
    }
)
RETRYABLE_REQUEST_STATUSES = frozenset(
    {
        VerificationRequestStatus.REJECTED.value,
        VerificationRequestStatus.EXPIRED.value,
        VerificationRequestStatus.CANCELLED.value,
    }
)
REJECTION_REASONS = frozenset(item.value for item in VerificationRejectionReason)
VERIFICATION_TYPES = frozenset(item.value for item in VerificationType)
REVIEWER_ROLES = frozenset({UserRole.REVIEWER.value, UserRole.ADMIN.value})

REJECTION_MESSAGES = {
    VerificationRejectionReason.IMAGE_UNCLEAR.value: (
        "The selfie was not clear enough. Try again with better lighting."
    ),
    VerificationRejectionReason.FACE_NOT_VISIBLE.value: (
        "We could not see your face clearly. Face the camera and try again."
    ),
    VerificationRejectionReason.DUPLICATE_SUBMISSION.value: (
        "This submission could not be accepted. Please start a new request."
    ),
    VerificationRejectionReason.INVALID_SUBMISSION.value: (
        "The submitted photo could not be used. Please take a new selfie."
    ),
    VerificationRejectionReason.FAILED_VERIFICATION.value: (
        "Verification was not approved. You can try again."
    ),
}


def parse_verification_type(raw: str | None) -> str:
    value = (raw or VerificationType.SELFIE_VERIFICATION.value).strip().upper()
    if value not in VERIFICATION_TYPES:
        raise AppError("VALIDATION_ERROR", "Unsupported verification type.", 422)
    return value


def parse_reason_code(raw: str | None) -> str:
    value = (raw or "").strip().upper()
    if value not in REJECTION_REASONS:
        raise AppError("VALIDATION_ERROR", "Invalid rejection reason.", 422)
    return value


def public_rejection_message(reason_code: str | None) -> str | None:
    if not reason_code:
        return None
    return REJECTION_MESSAGES.get(
        reason_code, REJECTION_MESSAGES[VerificationRejectionReason.FAILED_VERIFICATION.value]
    )


def account_can_verify(user: User | None) -> None:
    if user is None or user.deleted_at is not None:
        raise ForbiddenError("This account cannot start verification.")
    if user.status != UserStatus.ACTIVE.value:
        raise ForbiddenError("This account cannot start verification.")


def is_reviewer(user: User) -> bool:
    return user.role in REVIEWER_ROLES


def require_reviewer(user: User) -> None:
    if not is_reviewer(user):
        raise ForbiddenError("Reviewer access required.")


def default_expiry(days: int) -> datetime:
    return datetime.now(UTC) + timedelta(days=days)


def profile_status_from_request(status: str, current: str) -> str:
    if status in ACTIVE_REQUEST_STATUSES:
        return VerificationStatus.PENDING.value
    if status == VerificationRequestStatus.APPROVED.value:
        return VerificationStatus.VERIFIED.value
    if status == VerificationRequestStatus.REJECTED.value:
        return VerificationStatus.REJECTED.value
    if current == VerificationStatus.VERIFIED.value:
        return VerificationStatus.VERIFIED.value
    return VerificationStatus.UNVERIFIED.value


def public_user_status(profile_status: str | None, request_status: str | None) -> str:
    if profile_status == VerificationStatus.VERIFIED.value:
        return VerificationRequestStatus.APPROVED.value
    if request_status:
        return request_status
    if profile_status == VerificationStatus.PENDING.value:
        return VerificationRequestStatus.PENDING.value
    if profile_status == VerificationStatus.REJECTED.value:
        return VerificationRequestStatus.REJECTED.value
    return "NOT_STARTED"


def next_action_for(status: str) -> str:
    if status == "NOT_STARTED":
        return "START"
    if status == VerificationRequestStatus.PENDING.value:
        return "SUBMIT"
    if status == VerificationRequestStatus.IN_REVIEW.value:
        return "WAIT"
    if status == VerificationRequestStatus.APPROVED.value:
        return "DONE"
    if status in RETRYABLE_REQUEST_STATUSES:
        return "RETRY"
    return "START"


def owns_storage_key(user_id: UUID, storage_key: str) -> bool:
    return storage_key.startswith(f"{user_id}/")


def is_verification_storage_key(storage_key: str) -> bool:
    normalized = storage_key.replace("\\", "/")
    parts = normalized.split("/")
    return len(parts) >= 3 and parts[1] == "verification"


def parse_review_action(raw: str) -> str:
    value = raw.strip().upper()
    allowed = {item.value for item in VerificationReviewAction}
    if value not in allowed:
        raise AppError("VALIDATION_ERROR", "Invalid review action.", 422)
    return value
