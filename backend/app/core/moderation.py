"""Content checks before a message is persisted or published.

Future AI/moderation providers should be inserted here. This phase only
rejects empty or oversized text.
"""

from app.core.errors import AppError

MAX_TEXT_LENGTH = 4000


def moderate_text_message(content: str) -> str:
    text = (content or "").strip()
    if not text:
        raise AppError("VALIDATION_ERROR", "Message cannot be empty.", 422)
    if len(text) > MAX_TEXT_LENGTH:
        raise AppError(
            "VALIDATION_ERROR",
            f"Message cannot exceed {MAX_TEXT_LENGTH} characters.",
            422,
        )
    return text
