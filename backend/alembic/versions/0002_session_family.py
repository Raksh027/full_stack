"""Add refresh-token family id for reuse detection.

Revision ID: 0002_session_family
Revises: 0001_initial
Create Date: 2026-09-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_session_family"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("family_id", sa.Uuid(), nullable=True))
    op.execute("UPDATE sessions SET family_id = id WHERE family_id IS NULL")
    op.alter_column("sessions", "family_id", nullable=False)
    op.create_index("ix_sessions_family_id", "sessions", ["family_id"])


def downgrade() -> None:
    op.drop_index("ix_sessions_family_id", table_name="sessions")
    op.drop_column("sessions", "family_id")
