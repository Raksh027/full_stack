from typing import Any

from app.core.errors import UnauthorizedError


def social_email(provider: str, claims: dict[str, Any]) -> str:
    """Stable login email from a social token. Apple/Facebook may omit email."""
    email = str(claims.get("email") or "").strip().lower()
    if email:
        return email
    if provider == "apple":
        sub = str(claims.get("sub") or "").strip()
        if sub:
            return f"{sub}@privaterelay.appleid.com"
    if provider == "facebook":
        facebook_id = str(claims.get("id") or "").strip()
        if facebook_id:
            return f"fb_{facebook_id}@privaterelay.boomboom.app"
    raise UnauthorizedError(f"{provider.title()} account has no email.")
