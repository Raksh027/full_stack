"""Razorpay subscription catalog (INR).

Revision ID: 0019_razorpay_products
Revises: 0018_email_changed_at
Create Date: 2026-09-29
"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0019_razorpay_products"
down_revision: str | None = "0018_email_changed_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PRODUCTS = (
    (
        "RAZORPAY",
        "boomboom_premium_monthly",
        "PREMIUM_MONTHLY",
        "1 Month",
        "P1M",
        {"amountPaise": 49900, "currency": "INR", "displayPrice": "₹499"},
    ),
    (
        "RAZORPAY",
        "boomboom_premium_semiannual",
        "PREMIUM_SEMIANNUAL",
        "6 Months",
        "P6M",
        {"amountPaise": 199900, "currency": "INR", "displayPrice": "₹1,999"},
    ),
    (
        "RAZORPAY",
        "boomboom_premium_yearly",
        "PREMIUM_YEARLY",
        "12 Months",
        "P1Y",
        {"amountPaise": 299900, "currency": "INR", "displayPrice": "₹2,999"},
    ),
)


def upgrade() -> None:
    products = sa.table(
        "subscription_products",
        sa.column("id", sa.Uuid()),
        sa.column("platform", sa.String()),
        sa.column("product_id", sa.String()),
        sa.column("plan_code", sa.String()),
        sa.column("display_name", sa.String()),
        sa.column("billing_period", sa.String()),
        sa.column("active", sa.Boolean()),
        sa.column("metadata", JSONB()),
    )
    op.bulk_insert(
        products,
        [
            {
                "id": uuid4(),
                "platform": platform,
                "product_id": product_id,
                "plan_code": plan_code,
                "display_name": display_name,
                "billing_period": period,
                "active": True,
                "metadata": metadata,
            }
            for platform, product_id, plan_code, display_name, period, metadata in PRODUCTS
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM subscription_products WHERE platform = 'RAZORPAY' "
            "AND product_id IN ("
            "'boomboom_premium_monthly',"
            "'boomboom_premium_semiannual',"
            "'boomboom_premium_yearly'"
            ")"
        )
    )
