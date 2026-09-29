"""Retention policy for verification media. No legal claim is made here."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta


@dataclass(frozen=True)
class VerificationRetentionPolicy:
    """Business default until counsel defines a legal hold.

    Media bytes may be deleted after `media_retention_days` once a request is
    terminal (approved, rejected, cancelled, or expired). Request, review, and
    audit rows stay. This phase does not run automatic deletion.
    """

    media_retention_days: int = 90

    def media_eligible_for_purge(
        self,
        *,
        request_status: str,
        reviewed_at: datetime | None,
        updated_at: datetime,
        now: datetime | None = None,
    ) -> bool:
        terminal = {"APPROVED", "REJECTED", "EXPIRED", "CANCELLED"}
        if request_status not in terminal:
            return False
        anchor = reviewed_at or updated_at
        if anchor.tzinfo is None:
            anchor = anchor.replace(tzinfo=UTC)
        current = now or datetime.now(UTC)
        return current >= anchor + timedelta(days=self.media_retention_days)
