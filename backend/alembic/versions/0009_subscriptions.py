"""Subscription catalog, subscriptions, entitlements, webhook idempotency.

Revision ID: 0009_subscriptions
Revises: 0008_moderation
Create Date: 2026-09-06
"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0009_subscriptions"
down_revision: str | None = "0008_moderation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PRODUCTS = (
    ("GOOGLE", "com.boomboom.premium.monthly", "PREMIUM_MONTHLY", "1 Month", "P1M"),
    ("GOOGLE", "com.boomboom.premium.quarterly", "PREMIUM_QUARTERLY", "3 Months", "P3M"),
    ("GOOGLE", "com.boomboom.premium.yearly", "PREMIUM_YEARLY", "12 Months", "P1Y"),
    ("APPLE", "com.boomboom.premium.monthly", "PREMIUM_MONTHLY", "1 Month", "P1M"),
    ("APPLE", "com.boomboom.premium.quarterly", "PREMIUM_QUARTERLY", "3 Months", "P3M"),
    ("APPLE", "com.boomboom.premium.yearly", "PREMIUM_YEARLY", "12 Months", "P1Y"),
)


def upgrade() -> None:
    op.create_table(
        "subscription_products",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("platform", sa.String(16), nullable=False),
        sa.Column("product_id", sa.String(128), nullable=False),
        sa.Column("plan_code", sa.String(40), nullable=False),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("billing_period", sa.String(16), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("platform", "product_id", name="uq_subscription_products_platform_product"),
    )
    op.create_index("ix_subscription_products_plan_code", "subscription_products", ["plan_code"])
    op.create_index("ix_subscription_products_active", "subscription_products", ["active"])

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.String(16), nullable=False),
        sa.Column("product_id", sa.String(128), nullable=False),
        sa.Column("plan_code", sa.String(40), nullable=False),
        sa.Column("provider_ref_hash", sa.String(64), nullable=False),
        sa.Column("provider_ref_hint", sa.String(12), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("auto_renewing", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grace_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("platform", "provider_ref_hash", name="uq_subscriptions_platform_ref"),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])
    op.create_index("ix_subscriptions_expires_at", "subscriptions", ["expires_at"])
    op.create_index("ix_subscriptions_product_id", "subscriptions", ["product_id"])

    op.create_table(
        "subscription_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "subscription_id",
            sa.Uuid(),
            sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(48), nullable=False),
        sa.Column("provider_event_id", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("provider_event_id", name="uq_subscription_events_provider_event"),
    )
    op.create_index("ix_subscription_events_user_id", "subscription_events", ["user_id"])
    op.create_index("ix_subscription_events_created_at", "subscription_events", ["created_at"])

    op.create_table(
        "entitlements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("product_id", sa.String(128), nullable=True),
        sa.Column(
            "subscription_id",
            sa.Uuid(),
            sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "code", name="uq_entitlements_user_code"),
    )
    op.create_index("ix_entitlements_user_active", "entitlements", ["user_id", "active"])
    op.create_index("ix_entitlements_expires_at", "entitlements", ["expires_at"])

    op.create_table(
        "billing_webhook_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("event_type", sa.String(48), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("provider", "event_id", name="uq_billing_webhook_provider_event"),
    )

    products = sa.table(
        "subscription_products",
        sa.column("id", sa.Uuid()),
        sa.column("platform", sa.String()),
        sa.column("product_id", sa.String()),
        sa.column("plan_code", sa.String()),
        sa.column("display_name", sa.String()),
        sa.column("billing_period", sa.String()),
        sa.column("active", sa.Boolean()),
    )
    op.bulk_insert(
        products,
        [
            {
                "id": uuid4(),
                "platform": platform,
                "product_id": product_id,
                "plan_code": plan_code,
                "display_name": name,
                "billing_period": period,
                "active": True,
            }
            for platform, product_id, plan_code, name, period in PRODUCTS
        ],
    )


def downgrade() -> None:
    op.drop_table("billing_webhook_events")
    op.drop_index("ix_entitlements_expires_at", table_name="entitlements")
    op.drop_index("ix_entitlements_user_active", table_name="entitlements")
    op.drop_table("entitlements")
    op.drop_index("ix_subscription_events_created_at", table_name="subscription_events")
    op.drop_index("ix_subscription_events_user_id", table_name="subscription_events")
    op.drop_table("subscription_events")
    op.drop_index("ix_subscriptions_product_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_expires_at", table_name="subscriptions")
    op.drop_index("ix_subscriptions_status", table_name="subscriptions")
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index("ix_subscription_products_active", table_name="subscription_products")
    op.drop_index("ix_subscription_products_plan_code", table_name="subscription_products")
    op.drop_table("subscription_products")
