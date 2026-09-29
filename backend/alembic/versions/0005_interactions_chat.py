"""Likes, favorites, matches, conversations, and messages.

Revision ID: 0005_interactions_chat
Revises: 0004_discovery
Create Date: 2026-09-06
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_interactions_chat"
down_revision: str | None = "0004_discovery"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "likes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "target_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("actor_id", "target_id", name="uq_likes_actor_target"),
        sa.CheckConstraint("actor_id <> target_id", name="ck_likes_not_self"),
    )
    op.create_index("ix_likes_actor_target", "likes", ["actor_id", "target_id"])
    op.create_index("ix_likes_target_actor", "likes", ["target_id", "actor_id"])

    op.create_table(
        "favorites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "target_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("user_id", "target_user_id", name="uq_favorites_user_target"),
        sa.CheckConstraint("user_id <> target_user_id", name="ck_favorites_not_self"),
    )
    op.create_index("ix_favorites_user_target", "favorites", ["user_id", "target_user_id"])
    op.create_index("ix_favorites_user_created", "favorites", ["user_id", "created_at"])

    op.create_table(
        "matches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_a_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "user_b_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("unmatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unmatched_by_id", sa.Uuid(), nullable=True),
        sa.Column("blocked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("user_a_id", "user_b_id", name="uq_matches_pair"),
        sa.CheckConstraint("user_a_id < user_b_id", name="ck_matches_canonical_order"),
    )
    op.create_index("ix_matches_user_a_id", "matches", ["user_a_id"])
    op.create_index("ix_matches_user_b_id", "matches", ["user_b_id"])
    op.create_index("ix_matches_status", "matches", ["status"])
    op.create_index("ix_matches_status_updated", "matches", ["status", "updated_at"])

    op.create_table(
        "conversations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "match_id",
            sa.Uuid(),
            sa.ForeignKey("matches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_message_preview", sa.String(240), nullable=True),
        sa.Column("last_message_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("match_id", name="uq_conversations_match_id"),
    )
    op.create_index("ix_conversations_match_id", "conversations", ["match_id"])
    op.create_index("ix_conversations_updated_at", "conversations", ["updated_at"])
    op.create_index("ix_conversations_last_message_at", "conversations", ["last_message_at"])

    op.create_table(
        "conversation_members",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.Uuid(),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("last_read_message_id", sa.Uuid(), nullable=True),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("conversation_id", "user_id", name="uq_conversation_members_pair"),
    )
    op.create_index("ix_conversation_members_user_id", "conversation_members", ["user_id"])
    op.create_index(
        "ix_conversation_members_conversation_id",
        "conversation_members",
        ["conversation_id"],
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.Uuid(),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("client_message_id", sa.String(80), nullable=False),
        sa.Column("message_type", sa.String(32), nullable=False, server_default="TEXT"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("media_url", sa.String(1024), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="SENT"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint(
            "conversation_id",
            "sender_id",
            "client_message_id",
            name="uq_messages_client_id",
        ),
    )
    op.create_index(
        "ix_messages_conversation_created",
        "messages",
        ["conversation_id", "created_at"],
    )
    op.create_index("ix_messages_conversation_sender", "messages", ["conversation_id", "sender_id"])
    op.create_index("ix_messages_conversation_status", "messages", ["conversation_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_messages_conversation_status", table_name="messages")
    op.drop_index("ix_messages_conversation_sender", table_name="messages")
    op.drop_index("ix_messages_conversation_created", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_conversation_members_conversation_id", table_name="conversation_members")
    op.drop_index("ix_conversation_members_user_id", table_name="conversation_members")
    op.drop_table("conversation_members")
    op.drop_index("ix_conversations_last_message_at", table_name="conversations")
    op.drop_index("ix_conversations_updated_at", table_name="conversations")
    op.drop_index("ix_conversations_match_id", table_name="conversations")
    op.drop_table("conversations")
    op.drop_index("ix_matches_status_updated", table_name="matches")
    op.drop_index("ix_matches_status", table_name="matches")
    op.drop_index("ix_matches_user_b_id", table_name="matches")
    op.drop_index("ix_matches_user_a_id", table_name="matches")
    op.drop_table("matches")
    op.drop_index("ix_favorites_user_created", table_name="favorites")
    op.drop_index("ix_favorites_user_target", table_name="favorites")
    op.drop_table("favorites")
    op.drop_index("ix_likes_target_actor", table_name="likes")
    op.drop_index("ix_likes_actor_target", table_name="likes")
    op.drop_table("likes")
