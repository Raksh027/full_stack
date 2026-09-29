from __future__ import annotations

import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Protocol
from uuid import UUID, uuid4

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from app.config import Settings
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.core.profile_rules import ALLOWED_IMAGE_TYPES
from app.core.security import decode_token
from app.core.verification_rules import is_verification_storage_key


class StorageProvider(Protocol):
    async def create_upload_target(
        self,
        user_id: UUID,
        content_type: str,
        filename: str,
        byte_size: int,
        purpose: str = "profile",
        event_id: UUID | None = None,
    ) -> dict: ...

    async def save_bytes(self, storage_key: str, data: bytes, content_type: str) -> None: ...

    async def object_exists(self, storage_key: str) -> bool: ...

    async def read_bytes(self, storage_key: str) -> bytes: ...

    async def delete_object(self, storage_key: str) -> None: ...

    async def delete_user_prefix(self, user_id: UUID) -> None: ...

    def public_url(self, storage_key: str, request_base: str) -> str: ...

    def verify_upload_token(self, token: str, storage_key: str) -> dict: ...


def sniff_image_type(data: bytes) -> str | None:
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def extension_for(content_type: str, filename: str) -> str:
    allowed = ALLOWED_IMAGE_TYPES.get(content_type.lower())
    if not allowed:
        raise AppError("PROFILE_MEDIA_INVALID", "This file type is not allowed.", 422)
    suffix = Path(filename).suffix.lower()
    if suffix not in allowed:
        suffix = next(iter(allowed))
    return suffix


class LocalStorageProvider:
    """Development object storage. Swap for S3/R2/GCS later."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._root = Path(settings.media_storage_path).resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    async def create_upload_target(
        self,
        user_id: UUID,
        content_type: str,
        filename: str,
        byte_size: int,
        purpose: str = "profile",
        event_id: UUID | None = None,
    ) -> dict:
        if byte_size > self._settings.media_max_bytes:
            raise AppError("PROFILE_MEDIA_INVALID", "File is too large.", 422)
        content_type = content_type.lower()
        suffix = extension_for(content_type, filename)
        if purpose == "verification":
            storage_key = f"{user_id}/verification/{uuid4()}{suffix}"
        elif purpose == "event":
            if event_id is None:
                raise AppError("VALIDATION_ERROR", "An event is required for this upload.", 422)
            storage_key = f"{user_id}/events/{event_id}/{uuid4()}{suffix}"
        else:
            storage_key = f"{user_id}/{uuid4()}{suffix}"
        expires = datetime.now(UTC) + timedelta(seconds=self._settings.media_upload_expire_seconds)
        token = jwt.encode(
            {
                "sub": str(user_id),
                "key": storage_key,
                "ct": content_type,
                "typ": "upload",
                "purpose": purpose,
                "exp": int(expires.timestamp()),
            },
            self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
        )
        return {
            "uploadUrl": f"/api/v1/media/local/{storage_key}?token={token}",
            "storageKey": storage_key,
            "headers": {"Content-Type": content_type},
            "expiresAt": expires.isoformat(),
        }

    async def save_bytes(self, storage_key: str, data: bytes, content_type: str) -> None:
        if len(data) > self._settings.media_max_bytes:
            raise AppError("PROFILE_MEDIA_INVALID", "File is too large.", 422)
        sniffed = sniff_image_type(data)
        if sniffed is None or sniffed != content_type.lower():
            raise AppError(
                "PROFILE_MEDIA_INVALID",
                "File content does not match an allowed image type.",
                422,
            )
        path = self._safe_path(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    async def object_exists(self, storage_key: str) -> bool:
        return self._safe_path(storage_key).is_file()

    async def read_bytes(self, storage_key: str) -> bytes:
        path = self._safe_path(storage_key)
        if not path.is_file():
            raise NotFoundError("Media not found.")
        return path.read_bytes()

    async def delete_object(self, storage_key: str) -> None:
        path = self._safe_path(storage_key)
        if path.is_file():
            path.unlink()

    async def delete_user_prefix(self, user_id: UUID) -> None:
        folder = self._safe_path(str(user_id))
        if folder.is_dir():
            shutil.rmtree(folder)

    def public_url(self, storage_key: str, request_base: str) -> str:
        if is_verification_storage_key(storage_key):
            raise ForbiddenError("Verification media is not publicly addressable.")
        base = self._settings.media_public_base_url.strip() or request_base.rstrip("/")
        return f"{base}/api/v1/media/files/{storage_key}"

    def verify_upload_token(self, token: str, storage_key: str) -> dict:
        try:
            payload = decode_token(self._settings, token)
        except ExpiredSignatureError as exc:
            raise AppError("PROFILE_MEDIA_INVALID", "Upload URL expired.", 400) from exc
        except InvalidTokenError as exc:
            raise ForbiddenError("Invalid upload token.") from exc
        if payload.get("typ") != "upload":
            raise ForbiddenError("Invalid upload token.")
        if payload.get("key") != storage_key:
            raise ForbiddenError("Upload token does not match this object.")
        return payload

    def _safe_path(self, storage_key: str) -> Path:
        if ".." in storage_key or storage_key.startswith(("/", "\\")):
            raise ForbiddenError("Invalid storage key.")
        path = (self._root / storage_key).resolve()
        if not str(path).startswith(str(self._root)):
            raise ForbiddenError("Invalid storage key.")
        return path
