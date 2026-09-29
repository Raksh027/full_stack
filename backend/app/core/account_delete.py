from app.core.errors import AppError

ALLOWED_DELETE_REASONS = frozenset(
    {"noNeed", "privacy", "alternative", "difficult", "other"}
)

MAX_DELETE_DETAILS = 500


def normalize_delete_reason(
    reason: str | None, details: str | None = None
) -> tuple[str, str | None]:
    value = (reason or "").strip()
    note = (details or "").strip() or None
    if not value:
        raise AppError("VALIDATION_ERROR", "Please choose a reason for deleting your account.", 422)
    if value not in ALLOWED_DELETE_REASONS:
        raise AppError("VALIDATION_ERROR", "Invalid deletion reason.", 422)
    if value == "other" and not note:
        raise AppError("VALIDATION_ERROR", "Please tell us why you are leaving.", 422)
    if note and len(note) > MAX_DELETE_DETAILS:
        raise AppError("VALIDATION_ERROR", "Please keep your reason under 500 characters.", 422)
    if value != "other":
        note = None
    return value, note
