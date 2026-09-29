"""Social events and RSVPs.

Revision ID: 0011_events
Revises: 0010_subscription_e2e
Create Date: 2026-09-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_events"
down_revision: str | None = "0010_subscription_e2e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "host_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.String(4000), nullable=False, server_default=""),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cover_storage_key", sa.String(512), nullable=True),
        sa.Column("cover_url", sa.String(1024), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="PUBLISHED"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("ends_at >= starts_at", name="ck_events_ends_after_starts"),
        sa.CheckConstraint("capacity IS NULL OR capacity > 0", name="ck_events_capacity_positive"),
        sa.CheckConstraint(
            "latitude IS NULL OR (latitude >= -90 AND latitude <= 90)",
            name="ck_events_latitude_range",
        ),
        sa.CheckConstraint(
            "longitude IS NULL OR (longitude >= -180 AND longitude <= 180)",
            name="ck_events_longitude_range",
        ),
    )
    op.create_index("ix_events_starts_at", "events", ["starts_at"])
    op.create_index("ix_events_host_user_id", "events", ["host_user_id"])
    op.create_index("ix_events_status", "events", ["status"])
    op.create_index("ix_events_status_starts_at_id", "events", ["status", "starts_at", "id"])

    op.create_table(
        "event_rsvps",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "event_id",
            sa.Uuid(),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="GOING"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("event_id", "user_id", name="uq_event_rsvps_event_user"),
    )
    op.create_index("ix_event_rsvps_event_id", "event_rsvps", ["event_id"])
    op.create_index("ix_event_rsvps_user_id", "event_rsvps", ["user_id"])
    op.create_index("ix_event_rsvps_event_status", "event_rsvps", ["event_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_event_rsvps_event_status", table_name="event_rsvps")
    op.drop_index("ix_event_rsvps_user_id", table_name="event_rsvps")
    op.drop_index("ix_event_rsvps_event_id", table_name="event_rsvps")
    op.drop_table("event_rsvps")
    op.drop_index("ix_events_status_starts_at_id", table_name="events")
    op.drop_index("ix_events_status", table_name="events")
    op.drop_index("ix_events_host_user_id", table_name="events")
    op.drop_index("ix_events_starts_at", table_name="events")
    op.drop_table("events")
