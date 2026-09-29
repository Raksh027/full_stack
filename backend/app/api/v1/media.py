from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

from app.api.v1.responses import success
from app.core.errors import NotFoundError
from app.core.verification_rules import is_verification_storage_key
from app.dependencies.auth import get_current_user
from app.dependencies.profile import get_profile_service, get_storage
from app.models.orm import User
from app.schemas.profile import UploadUrlRequest
from app.services.profile import ProfileService
from app.services.storage import LocalStorageProvider

router = APIRouter(tags=["Media"])


@router.post("/media/upload-url")
async def create_upload_url(
    request: Request,
    body: UploadUrlRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ProfileService, Depends(get_profile_service)],
):
    return success(request, await service.create_upload_url(user.id, body))


@router.put("/media/local/{storage_key:path}")
async def local_upload(
    request: Request,
    storage_key: str,
    storage: Annotated[LocalStorageProvider, Depends(get_storage)],
    token: Annotated[str, Query()],
):
    payload = storage.verify_upload_token(token, storage_key)
    data = await request.body()
    await storage.save_bytes(storage_key, data, str(payload.get("ct") or "image/jpeg"))
    return success(request, {"stored": True, "storageKey": storage_key})


@router.get("/media/files/{storage_key:path}")
async def serve_local_file(
    storage_key: str,
    storage: Annotated[LocalStorageProvider, Depends(get_storage)],
):
    if is_verification_storage_key(storage_key):
        raise NotFoundError("Media not found.")
    data = await storage.read_bytes(storage_key)
    content_type = "application/octet-stream"
    if storage_key.endswith((".jpg", ".jpeg")):
        content_type = "image/jpeg"
    elif storage_key.endswith(".png"):
        content_type = "image/png"
    elif storage_key.endswith(".webp"):
        content_type = "image/webp"
    return Response(content=data, media_type=content_type)
