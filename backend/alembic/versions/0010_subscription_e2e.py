"""Webhook processing state and provider event ordering.

Revision ID: 0010_subscription_e2e
Revises: 0009_subscriptions
Create Date: 2026-09-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_subscription_e2e"
down_revision: str | None = "0009_subscriptions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("provider_observed_at", sa.DateTime(timezone=True)))
    op.add_column("subscription_events", sa.Column("platform", sa.String(16)))
    op.add_column("subscription_events", sa.Column("product_id", sa.String(128)))
    op.add_column("subscription_events", sa.Column("processing_status", sa.String(32)))
    op.add_column("subscription_events", sa.Column("reconciliation_result", sa.String(64)))
    op.add_column(
        "billing_webhook_events",
        sa.Column("status", sa.String(32), nullable=False, server_default="PROCESSED"),
    )
    op.add_column("billing_webhook_events", sa.Column("platform", sa.String(16)))
    op.add_column("billing_webhook_events", sa.Column("product_id", sa.String(128)))
    op.add_column("billing_webhook_events", sa.Column("processing_result", sa.String(64)))
    op.add_column("billing_webhook_events", sa.Column("error_category", sa.String(40)))
    op.add_column("billing_webhook_events", sa.Column("duration_ms", sa.Integer()))
    op.add_column(
        "billing_webhook_events", sa.Column("provider_observed_at", sa.DateTime(timezone=True))
    )
    op.add_column("billing_webhook_events", sa.Column("processed_at", sa.DateTime(timezone=True)))
    op.create_index("ix_billing_webhook_status", "billing_webhook_events", ["status"])


def downgrade() -> None:
    op.drop_index("ix_billing_webhook_status", table_name="billing_webhook_events")
    op.drop_column("billing_webhook_events", "processed_at")
    op.drop_column("billing_webhook_events", "provider_observed_at")
    op.drop_column("billing_webhook_events", "duration_ms")
    op.drop_column("billing_webhook_events", "error_category")
    op.drop_column("billing_webhook_events", "processing_result")
    op.drop_column("billing_webhook_events", "product_id")
    op.drop_column("billing_webhook_events", "platform")
    op.drop_column("billing_webhook_events", "status")
    op.drop_column("subscription_events", "reconciliation_result")
    op.drop_column("subscription_events", "processing_status")
    op.drop_column("subscription_events", "product_id")
    op.drop_column("subscription_events", "platform")
    op.drop_column("subscriptions", "provider_observed_at")
