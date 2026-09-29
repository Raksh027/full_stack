from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.api.v1.responses import success
from app.dependencies.auth import get_current_user
from app.dependencies.interactions import get_chat_service
from app.models.orm import User
from app.schemas.chat import SendMessageRequest, StartConversationRequest
from app.services.chat import ChatService
from app.services.presenters import message_to_app

router = APIRouter(tags=["Chat"])


def to_app_conversation(row: dict[str, Any]) -> dict[str, Any]:
    preview = row.get("lastMessage")
    last = None
    if preview:
        last = {
            "id": row.get("lastMessageId") or row["id"],
            "clientId": None,
            "conversationId": row["id"],
            "senderId": row.get("lastSenderId") or row["user"]["id"],
            "body": preview if isinstance(preview, str) else "",
            "createdAt": row.get("time") or "",
            "status": "sent",
        }
    return {
        "id": row["id"],
        "matchId": row.get("matchId"),
        "user": row["user"],
        "lastMessage": last,
        "unreadCount": row.get("unreadCount") or 0,
        "updatedAt": row.get("time") or "",
        "isRequest": bool(row.get("isRequest")),
    }


@router.get("/conversations")
async def list_conversations(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
):
    raw = await service.list_conversations(user, limit=limit, cursor=cursor)
    items = [to_app_conversation(row) for row in raw.get("items") or []]
    return success(request, {"items": items, "nextCursor": raw.get("nextCursor")})


@router.post("/conversations")
async def start_conversation(
    request: Request,
    body: StartConversationRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    raw = await service.start_direct_message(
        user,
        body.user_id,
        content=body.content or "",
        client_message_id=body.client_message_id or "",
    )
    return success(
        request,
        {
            "conversation": to_app_conversation(raw["conversation"]),
            "message": message_to_app(raw["message"]),
        },
        201,
    )


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    request: Request,
    conversation_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = None,
):
    return success(request, await service.list_messages(user, conversation_id, limit, cursor))


@router.post("/conversations/{conversation_id}/messages")
async def post_message(
    request: Request,
    conversation_id: UUID,
    body: SendMessageRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return success(
        request,
        await service.send_message(
            user,
            conversation_id,
            content=body.content,
            client_message_id=body.client_message_id,
            message_type=body.message_type,
        ),
        201,
    )


@router.post("/conversations/{conversation_id}/read")
async def mark_read(
    request: Request,
    conversation_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return success(request, await service.mark_read(user, conversation_id))


@router.get("/chat/unread-count")
async def unread_count(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
):
    return success(request, await service.unread_summary(user))
