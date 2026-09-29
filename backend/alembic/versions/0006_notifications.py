"""Notification inbox, preferences, and device token lifecycle.

Revision ID: 0006_notifications
Revises: 0005_interactions_chat
Create Date: 2026-09-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006_notifications"
down_revision: str | None = "0005_interactions_chat"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("device_tokens", sa.Column("device_id", sa.String(128), nullable=True))
    op.add_column("device_tokens", sa.Column("app_version", sa.String(32), nullable=True))
    op.add_column(
        "device_tokens",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "device_tokens", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index("ix_device_tokens_token", "device_tokens", ["token"])
    op.create_index("ix_device_tokens_user_active", "device_tokens", ["user_id", "is_active"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("body", sa.String(320), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("related_entity_type", sa.String(40), nullable=True),
        sa.Column("related_entity_id", sa.Uuid(), nullable=True),
        sa.Column("event_key", sa.String(160), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_status", sa.String(32), nullable=False, server_default="CREATED"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("user_id", "event_key", name="uq_notifications_user_event"),
    )
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])
    op.create_index("ix_notifications_user_unread", "notifications", ["user_id", "is_read"])

    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("matches", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("likes", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("favorites", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("messages", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("message_preview", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("general", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("user_id", name="uq_notification_preferences_user_id"),
    )
    op.create_index("ix_notification_preferences_user_id", "notification_preferences", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_notification_preferences_user_id", table_name="notification_preferences")
    op.drop_table("notification_preferences")
    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_index("ix_notifications_user_created", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_device_tokens_user_active", table_name="device_tokens")
    op.drop_index("ix_device_tokens_token", table_name="device_tokens")
    op.drop_column("device_tokens", "last_seen_at")
    op.drop_column("device_tokens", "is_active")
    op.drop_column("device_tokens", "app_version")
    op.drop_column("device_tokens", "device_id")
