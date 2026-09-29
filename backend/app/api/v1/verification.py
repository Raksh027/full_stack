from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from app.api.v1.responses import success
from app.core.eligibility import parse_user_id
from app.dependencies.auth import get_current_user
from app.dependencies.verification import get_verification_review_service, get_verification_service
from app.models.orm import User
from app.schemas.verification import (
    VerificationReviewRequest,
    VerificationStartRequest,
    VerificationSubmitRequest,
    VerificationUploadRequest,
)
from app.services.verification import VerificationReviewService, VerificationService

router = APIRouter(prefix="/verification", tags=["Verification"])


@router.get("/status")
async def verification_status(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[VerificationService, Depends(get_verification_service)],
):
    return success(request, await service.get_status(user))


@router.post("/start")
async def start_verification(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[VerificationService, Depends(get_verification_service)],
    body: VerificationStartRequest | None = None,
):
    payload = body or VerificationStartRequest()
    return success(request, await service.start(user, payload.verification_type))


@router.post("/upload-url")
async def verification_upload_url(
    request: Request,
    body: VerificationUploadRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[VerificationService, Depends(get_verification_service)],
):
    return success(
        request,
        await service.create_upload_url(user, body.content_type, body.filename, body.byte_size),
    )


@router.post("/submit")
async def submit_verification(
    request: Request,
    body: VerificationSubmitRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[VerificationService, Depends(get_verification_service)],
):
    keys = list(body.storage_keys or [])
    if body.storage_key:
        keys.append(body.storage_key)
    return success(request, await service.submit(user, keys, body.media_type))


@router.post("/cancel")
async def cancel_verification(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[VerificationService, Depends(get_verification_service)],
):
    return success(request, await service.cancel(user))


@router.post("/retry")
async def retry_verification(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[VerificationService, Depends(get_verification_service)],
    body: VerificationStartRequest | None = None,
):
    payload = body or VerificationStartRequest()
    return success(request, await service.start(user, payload.verification_type))


@router.get("/media/{media_id}")
async def verification_media(
    media_id: str,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[VerificationService, Depends(get_verification_service)],
):
    parsed = parse_user_id(media_id, field="mediaId")
    data, content_type = await service.get_own_media_bytes(user, parsed)
    return Response(content=data, media_type=content_type)


@router.post("/review")
async def review_verification(
    request: Request,
    body: VerificationReviewRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[VerificationReviewService, Depends(get_verification_review_service)],
):
    request_id = parse_user_id(body.request_id, field="requestId")
    return success(
        request,
        await service.review(user, request_id, body.action, body.reason_code, body.notes),
    )
