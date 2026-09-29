"""Realtime chat gateway. Sockets are process-local; events fan out via Redis."""

from app.websocket.chat import ChatWebSocketGateway, chat_websocket

__all__ = ["ChatWebSocketGateway", "chat_websocket"]
