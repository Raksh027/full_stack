"""UserAuth: track last email change for 30-day cooldown.

Revision ID: 0018_email_changed_at
Revises: 0017_location_place_levels
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018_email_changed_at"
down_revision: str | None = "0017_location_place_levels"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_auth",
        sa.Column("email_changed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_auth", "email_changed_at")
