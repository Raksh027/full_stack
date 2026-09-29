from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import (
    Conversation,
    ConversationMember,
    Match,
    Message,
    MessageStatus,
)


class ChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_conversation(self, conversation_id: UUID) -> Conversation | None:
        return await self._session.get(Conversation, conversation_id)

    async def get_member(self, conversation_id: UUID, user_id: UUID) -> ConversationMember | None:
        result = await self._session.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_peer_id(self, conversation_id: UUID, user_id: UUID) -> UUID | None:
        result = await self._session.execute(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id != user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_match_for_conversation(self, conversation_id: UUID) -> Match | None:
        result = await self._session.execute(
            select(Match)
            .join(Conversation, Conversation.match_id == Match.id)
            .where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: UUID, limit: int) -> list[tuple[Conversation, UUID]]:
        member = ConversationMember
        result = await self._session.execute(
            select(Conversation, member.user_id)
            .join(member, member.conversation_id == Conversation.id)
            .where(
                Conversation.id.in_(
                    select(ConversationMember.conversation_id).where(
                        ConversationMember.user_id == user_id
                    )
                )
            )
            .order_by(
                Conversation.last_message_at.desc().nulls_last(),
                Conversation.updated_at.desc(),
            )
        )
        rows = result.all()
        grouped: dict[UUID, Conversation] = {}
        peers: dict[UUID, UUID] = {}
        for conversation, member_user_id in rows:
            grouped[conversation.id] = conversation
            if member_user_id != user_id:
                peers[conversation.id] = member_user_id
        ordered = list(grouped.values())[:limit]
        return [(item, peers[item.id]) for item in ordered if item.id in peers]

    async def get_by_client_id(
        self, conversation_id: UUID, sender_id: UUID, client_message_id: str
    ) -> Message | None:
        result = await self._session.execute(
            select(Message).where(
                Message.conversation_id == conversation_id,
                Message.sender_id == sender_id,
                Message.client_message_id == client_message_id,
            )
        )
        return result.scalar_one_or_none()

    async def insert_message(
        self,
        *,
        conversation_id: UUID,
        sender_id: UUID,
        client_message_id: str,
        content: str,
        message_type: str,
    ) -> tuple[Message, bool]:
        existing = await self.get_by_client_id(conversation_id, sender_id, client_message_id)
        if existing is not None:
            return existing, False
        stmt = (
            pg_insert(Message)
            .values(
                id=uuid4(),
                conversation_id=conversation_id,
                sender_id=sender_id,
                client_message_id=client_message_id,
                content=content,
                message_type=message_type,
                status=MessageStatus.SENT.value,
            )
            .on_conflict_do_nothing(constraint="uq_messages_client_id")
            .returning(Message.id)
        )
        result = await self._session.execute(stmt)
        inserted_id = result.scalar_one_or_none()
        await self._session.flush()
        row = await self.get_by_client_id(conversation_id, sender_id, client_message_id)
        assert row is not None
        return row, inserted_id is not None

    async def touch_conversation(self, conversation: Conversation, message: Message) -> None:
        preview = message.content[:240]
        conversation.last_message_id = message.id
        conversation.last_message_at = message.created_at
        conversation.last_message_preview = preview
        conversation.updated_at = datetime.now(UTC)
        await self._session.flush()

    async def list_messages(
        self,
        conversation_id: UUID,
        *,
        limit: int,
        before_created: datetime | None,
        before_id: UUID | None,
    ) -> list[Message]:
        conditions = [Message.conversation_id == conversation_id, Message.deleted_at.is_(None)]
        if before_created is not None and before_id is not None:
            conditions.append(
                or_(
                    Message.created_at < before_created,
                    and_(Message.created_at == before_created, Message.id < before_id),
                )
            )
        result = await self._session.execute(
            select(Message)
            .where(*conditions)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def mark_delivered(self, message_id: UUID) -> Message | None:
        message = await self._session.get(Message, message_id)
        if message is None or message.delivered_at is not None:
            return message
        now = datetime.now(UTC)
        message.delivered_at = now
        if message.status == MessageStatus.SENT.value:
            message.status = MessageStatus.DELIVERED.value
        await self._session.flush()
        return message

    async def mark_read_up_to(
        self, conversation_id: UUID, reader_id: UUID, message: Message
    ) -> list[Message]:
        now = datetime.now(UTC)
        member = await self.get_member(conversation_id, reader_id)
        if member is None:
            return []
        member.last_read_message_id = message.id
        member.last_read_at = now
        result = await self._session.execute(
            select(Message).where(
                Message.conversation_id == conversation_id,
                Message.sender_id != reader_id,
                Message.deleted_at.is_(None),
                Message.status != MessageStatus.READ.value,
                or_(
                    Message.created_at < message.created_at,
                    and_(Message.created_at == message.created_at, Message.id <= message.id),
                ),
            )
        )
        updated = list(result.scalars())
        for item in updated:
            item.status = MessageStatus.READ.value
            item.read_at = now
            if item.delivered_at is None:
                item.delivered_at = now
        await self._session.flush()
        return updated

    async def latest_message(self, conversation_id: UUID) -> Message | None:
        result = await self._session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id, Message.deleted_at.is_(None))
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def unread_count(self, conversation_id: UUID, user_id: UUID) -> int:
        member = await self.get_member(conversation_id, user_id)
        conditions = [
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.deleted_at.is_(None),
        ]
        if member is not None and member.last_read_message_id is not None:
            last = await self._session.get(Message, member.last_read_message_id)
            if last is not None:
                conditions.append(
                    or_(
                        Message.created_at > last.created_at,
                        and_(Message.created_at == last.created_at, Message.id > last.id),
                    )
                )
        result = await self._session.execute(
            select(func.count()).select_from(Message).where(*conditions)
        )
        return int(result.scalar_one())

    async def unread_counts(self, user_id: UUID) -> dict[UUID, int]:
        result = await self._session.execute(
            select(ConversationMember.conversation_id).where(ConversationMember.user_id == user_id)
        )
        conversation_ids = list(result.scalars())
        counts: dict[UUID, int] = {}
        for conversation_id in conversation_ids:
            counts[conversation_id] = await self.unread_count(conversation_id, user_id)
        return counts

    async def close_for_match(self, match_id: UUID) -> None:
        await self._session.execute(
            update(Conversation)
            .where(Conversation.match_id == match_id)
            .values(status="CLOSED", updated_at=datetime.now(UTC))
        )
        await self._session.flush()
