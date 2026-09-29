from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.config import get_settings
from app.core.cache import CacheBackend
from app.core.errors import AppError, UnauthorizedError
from app.core.otp import MockOTPProvider, OTPService
from app.core.rate_limit import RateLimiter
from app.core.realtime import (
    ConnectionHub,
    PresenceStore,
    conversation_channel,
    decode_event,
    encode_event,
)
from app.services.auth import AuthService
from app.services.chat import ChatService
from app.services.notifications import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Chat"])

IDLE_TIMEOUT_SECONDS = 60
HEARTBEAT_SECONDS = 25


class ChatWebSocketGateway:
    def __init__(self) -> None:
        self.enabled = True


def _token_from_socket(websocket: WebSocket) -> str | None:
    header = websocket.headers.get("authorization") or websocket.headers.get("Authorization")
    if header and header.lower().startswith("bearer "):
        return header.split(" ", 1)[1].strip()
    token = websocket.query_params.get("token") or websocket.query_params.get("access_token")
    return token


async def _resolve_user(websocket: WebSocket):
    token = _token_from_socket(websocket)
    if not token:
        raise UnauthorizedError()
    settings = get_settings()
    cache: CacheBackend = websocket.app.state.cache
    factory = websocket.app.state.session_factory
    async with factory() as session:
        service = AuthService(
            session=session,
            settings=settings,
            otp=OTPService(cache, settings, MockOTPProvider()),
            limiter=RateLimiter(cache),
            cache=cache,
            request_id=websocket.query_params.get("request_id", "-"),
            ip=websocket.client.host if websocket.client else None,
            user_agent=websocket.headers.get("user-agent"),
        )
        return await service.resolve_user(token)


def _chat_service(websocket: WebSocket, session, request_id: str = "-") -> ChatService:
    settings = get_settings()
    cache: CacheBackend = websocket.app.state.cache
    presence = getattr(websocket.app.state, "presence", None) or PresenceStore(cache)
    notifier = NotificationService(
        session=session,
        settings=settings,
        limiter=RateLimiter(cache),
        request_id=request_id,
        jobs=getattr(websocket.app.state, "jobs", None),
        presence=presence,
        broker=getattr(websocket.app.state, "broker", None),
    )
    return ChatService(
        session=session,
        settings=settings,
        limiter=RateLimiter(cache),
        request_id=request_id,
        broker=getattr(websocket.app.state, "broker", None),
        presence=presence,
        notifier=notifier,
    )


async def _send_json(websocket: WebSocket, payload: dict[str, Any]) -> None:
    if websocket.client_state != WebSocketState.CONNECTED:
        return
    await websocket.send_json(payload)


@router.websocket("/ws/chat/{conversation_id}")
async def chat_websocket(websocket: WebSocket, conversation_id: UUID) -> None:
    request_id = websocket.query_params.get("request_id", "-")
    try:
        user = await _resolve_user(websocket)
    except Exception:
        logger.info("ws_auth_failed request_id=%s", request_id)
        await websocket.close(code=4401)
        return

    factory = websocket.app.state.session_factory
    async with factory() as session:
        service = _chat_service(websocket, session, request_id)
        try:
            peer_id = await service.authorize_socket(user, conversation_id)
        except AppError:
            await websocket.close(code=4403)
            return

    await websocket.accept()
    hub: ConnectionHub = websocket.app.state.hub
    presence: PresenceStore = websocket.app.state.presence
    broker = websocket.app.state.broker
    hub.add(websocket, user.id, conversation_id)
    connections = await presence.add_connection(user.id)
    now = datetime.now(UTC).isoformat()
    await presence.heartbeat(user.id, now)
    await presence.set_focus(user.id, conversation_id)
    if connections == 1:
        await broker.publish(
            conversation_channel(conversation_id),
            encode_event(
                "USER_ONLINE",
                {"userId": str(user.id), "conversationId": str(conversation_id)},
            ),
        )
    logger.info(
        "ws_connect request_id=%s conversation_id=%s",
        request_id,
        conversation_id,
    )

    last_activity = datetime.now(UTC)
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=HEARTBEAT_SECONDS)
            except TimeoutError:
                idle = (datetime.now(UTC) - last_activity).total_seconds()
                if idle > IDLE_TIMEOUT_SECONDS:
                    await websocket.close(code=4408)
                    break
                await _send_json(websocket, {"type": "PONG", "data": {}})
                await presence.heartbeat(user.id, datetime.now(UTC).isoformat())
                continue
            last_activity = datetime.now(UTC)
            await presence.heartbeat(user.id, last_activity.isoformat())
            try:
                envelope = decode_event(raw)
            except (ValueError, json.JSONDecodeError):
                await _send_json(
                    websocket,
                    {
                        "type": "ERROR",
                        "data": {"code": "VALIDATION_ERROR", "message": "Invalid event."},
                    },
                )
                continue
            event_type = str(envelope.get("type") or "").upper()
            data = envelope.get("data") or {}
            if not isinstance(data, dict):
                data = {}
            data.pop("user_id", None)
            data.pop("userId", None)
            data.pop("sender_id", None)
            data.pop("senderId", None)

            if event_type == "PING":
                await _send_json(websocket, {"type": "PONG", "data": {}})
                continue
            if event_type == "TYPING_START":
                await service_call(
                    websocket,
                    lambda svc: svc.publish_ephemeral(user, conversation_id, "TYPING_START"),
                )
                continue
            if event_type == "TYPING_STOP":
                await service_call(
                    websocket,
                    lambda svc: svc.publish_ephemeral(user, conversation_id, "TYPING_STOP"),
                )
                continue
            if event_type == "MARK_READ":
                await service_call(
                    websocket,
                    lambda svc: svc.mark_read(user, conversation_id),
                )
                continue
            if event_type == "SEND_MESSAGE":
                try:
                    async with factory() as session:
                        svc = _chat_service(websocket, session, request_id)
                        payload = await svc.send_message(
                            user,
                            conversation_id,
                            content=str(data.get("content") or data.get("text") or ""),
                            client_message_id=str(
                                data.get("clientMessageId") or data.get("client_message_id") or ""
                            ),
                            message_type=str(
                                data.get("messageType") or data.get("message_type") or "TEXT"
                            ),
                        )
                    await _send_json(websocket, {"type": "MESSAGE_SENT", "data": payload})
                except AppError as exc:
                    await _send_json(
                        websocket,
                        {"type": "ERROR", "data": {"code": exc.code, "message": exc.message}},
                    )
                continue
            await _send_json(
                websocket,
                {
                    "type": "ERROR",
                    "data": {"code": "VALIDATION_ERROR", "message": "Unknown event."},
                },
            )
    except WebSocketDisconnect:
        pass
    finally:
        hub.remove(websocket)
        remaining = await presence.remove_connection(user.id)
        still_focused = any(
            meta[0] == user.id and meta[1] == conversation_id for meta in hub.meta.values()
        )
        if not still_focused:
            await presence.clear_focus(user.id, conversation_id)
        if remaining == 0:
            await broker.publish(
                conversation_channel(conversation_id),
                encode_event(
                    "USER_OFFLINE",
                    {"userId": str(user.id), "conversationId": str(conversation_id)},
                ),
            )
        logger.info(
            "ws_disconnect request_id=%s conversation_id=%s",
            request_id,
            conversation_id,
        )
        _ = peer_id


async def service_call(websocket: WebSocket, action) -> None:
    factory = websocket.app.state.session_factory
    async with factory() as session:
        svc = _chat_service(websocket, session)
        try:
            await action(svc)
        except AppError as exc:
            await _send_json(
                websocket,
                {"type": "ERROR", "data": {"code": exc.code, "message": exc.message}},
            )


async def run_event_fanout(app) -> None:
    hub: ConnectionHub = app.state.hub
    broker = app.state.broker
    factory = app.state.session_factory
    async for channel, payload in broker.listen(["chat:conv:*", "notify:user:*"]):
        try:
            event = decode_event(payload)
        except (ValueError, json.JSONDecodeError):
            continue
        if channel.startswith("notify:user:"):
            try:
                user_id = UUID(channel.rsplit(":", 1)[-1])
            except ValueError:
                continue
            data = event.get("data") or {}
            event_type = str(event.get("type") or "")
            from app.websocket.gateway import remap_event

            remapped = remap_event(event_type, data)
            envelopes = [{"type": "notification.new", "data": data}]
            if remapped is not None:
                envelopes.append(remapped)
            for websocket in hub.user_sockets(user_id):
                for envelope in envelopes:
                    try:
                        await _send_json(websocket, envelope)
                    except Exception:
                        logger.info("ws_notify_failed user_id=%s", user_id)
            continue
        if not channel.startswith("chat:conv:"):
            continue
        try:
            conversation_id = UUID(channel.rsplit(":", 1)[-1])
        except ValueError:
            continue
        event_type = str(event.get("type") or "")
        data = event.get("data") or {}
        sender_id = str(data.get("senderId") or "")
        delivered_needed: UUID | None = None
        for websocket in hub.conversation_sockets(conversation_id):
            meta = hub.meta.get(websocket)
            if meta is None:
                continue
            user_id, _ = meta
            if event_type == "MESSAGE_SENT" and str(user_id) != sender_id:
                continue
            if event_type == "MESSAGE_RECEIVED" and str(user_id) == sender_id:
                continue
            typing = event_type in {"TYPING_START", "TYPING_STOP"}
            if typing and str(user_id) == str(data.get("userId") or ""):
                continue
            try:
                await _send_json(websocket, event)
                from app.websocket.gateway import remap_event

                remapped = remap_event(event_type, data)
                for user_socket in hub.user_sockets(user_id):
                    if remapped and hub.meta.get(user_socket, (None, None))[1] is None:
                        await _send_json(user_socket, remapped)
                inbound = event_type == "MESSAGE_RECEIVED" and str(user_id) != sender_id
                if inbound and data.get("id"):
                    delivered_needed = UUID(str(data["id"]))
            except Exception:
                logger.info("ws_deliver_failed conversation_id=%s", conversation_id)
        if delivered_needed is not None:
            try:
                async with factory() as session:
                    cache: CacheBackend = app.state.cache
                    svc = ChatService(
                        session=session,
                        settings=get_settings(),
                        limiter=RateLimiter(cache),
                        request_id="-",
                        broker=broker,
                        presence=app.state.presence,
                    )
                    await svc.mark_delivered(delivered_needed, conversation_id)
            except Exception:
                logger.info("ws_delivered_update_failed conversation_id=%s", conversation_id)
