from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.core.errors import UnauthorizedError
from app.core.realtime import ConnectionHub, PresenceStore
from app.websocket.chat import _resolve_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Realtime"])

EVENT_ALIASES = {
    "MESSAGE_RECEIVED": "message.new",
    "MESSAGE_SENT": "message.new",
    "MESSAGE_READ": "message.read",
    "TYPING_START": "typing",
    "TYPING_STOP": "typing",
    "USER_ONLINE": "presence",
    "USER_OFFLINE": "presence",
    "MATCH_CREATED": "match.new",
    "LIKE_RECEIVED": "like.received",
    "OFFER_RECEIVED": "like.received",
    "FAVORITE_RECEIVED": "like.received",
    "PROFILE_VIEW": "profile.view",
    "PROFILE_ACTIVITY": "profile.view",
    "TRAVEL_UPDATE": "travel.update",
    "EVENT_UPDATE": "event.update",
    "VERIFICATION_RESULT": "verification.update",
    "VERIFICATION_SUBMITTED": "verification.update",
    "VERIFICATION_APPROVED": "verification.update",
    "VERIFICATION_REJECTED": "verification.update",
    "SUBSCRIPTION_EVENT": "subscription.update",
    "SAFETY_ALERT": "safety.alert",
}


def remap_event(event_type: str, data: dict[str, Any]) -> dict[str, Any] | None:
    mapped = EVENT_ALIASES.get(event_type)
    if mapped is None:
        return None
    payload = dict(data)
    if event_type in {"MESSAGE_RECEIVED", "MESSAGE_SENT"}:
        payload = {
            "id": data.get("id"),
            "clientId": data.get("clientMessageId") or data.get("clientId"),
            "conversationId": data.get("conversationId"),
            "senderId": data.get("senderId"),
            "body": data.get("content") or data.get("body") or data.get("text") or "",
            "createdAt": data.get("createdAt") or data.get("time"),
            "status": str(data.get("status") or "sent").lower(),
        }
    elif event_type == "MESSAGE_READ":
        payload = {
            "conversationId": data.get("conversationId"),
            "readerId": data.get("readerId"),
            "lastReadMessageId": data.get("lastReadMessageId"),
            "readAt": data.get("readAt") or datetime.now(UTC).isoformat(),
        }
    elif event_type in {"TYPING_START", "TYPING_STOP"}:
        payload = {
            "conversationId": data.get("conversationId"),
            "userId": data.get("userId"),
            "isTyping": event_type == "TYPING_START",
        }
    elif event_type in {"USER_ONLINE", "USER_OFFLINE"}:
        payload = {"userId": data.get("userId"), "isOnline": event_type == "USER_ONLINE"}
    return {"type": mapped, "data": payload}


@router.websocket("/ws")
async def mobile_gateway(websocket: WebSocket) -> None:
    try:
        user = await _resolve_user(websocket)
    except UnauthorizedError:
        await websocket.close(code=4401)
        return
    except Exception:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    hub: ConnectionHub = websocket.app.state.hub
    presence: PresenceStore = websocket.app.state.presence
    hub.add(websocket, user.id, None)
    await presence.add_connection(user.id)
    await presence.heartbeat(user.id, datetime.now(UTC).isoformat())
    try:
        while True:
            message = await websocket.receive_json()
            event_type = str(message.get("type") or "")
            data = message.get("data") or {}
            if event_type in {"ping", "PING"}:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({"type": "pong"})
                continue
            if event_type == "typing":
                conversation_id = data.get("conversationId")
                is_typing = bool(data.get("isTyping"))
                if conversation_id:
                    from app.core.realtime import conversation_channel, encode_event

                    await websocket.app.state.broker.publish(
                        conversation_channel(UUID(str(conversation_id))),
                        encode_event(
                            "TYPING_START" if is_typing else "TYPING_STOP",
                            {
                                "conversationId": str(conversation_id),
                                "userId": str(user.id),
                            },
                        ),
                    )
                continue
            if event_type == "presence.subscribe":
                user_ids = [UUID(str(item)) for item in data.get("userIds") or []]
                online = await presence.online_map(user_ids)
                for user_id, is_on in online.items():
                    await websocket.send_json(
                        {"type": "presence", "data": {"userId": str(user_id), "isOnline": is_on}}
                    )
    except WebSocketDisconnect:
        pass
    finally:
        hub.remove(websocket)
        await presence.remove_connection(user.id)
        logger.info("mobile_ws_disconnect user_id=%s", user.id)
