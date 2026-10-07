from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

from app.api.v1.responses import success
from app.core.eligibility import parse_user_id
from app.core.errors import AppError
from app.core.rbac import require_admin, require_permission, require_staff
from app.dependencies.admin import get_admin_service
from app.dependencies.subscriptions import get_subscription_service
from app.models.orm import User
from app.schemas.admin import (
    AdminBanBody,
    AdminEventActionBody,
    AdminMediaRemoveBody,
    AdminReportAssignBody,
    AdminReportResolveBody,
    AdminReviewBody,
    AdminSuspendBody,
)
from app.services.admin import AdminService
from app.services.subscriptions import SubscriptionService

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard")
async def dashboard(
    request: Request,
    actor: Annotated[User, Depends(require_staff)],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    return success(request, await service.dashboard(actor))


@router.get("/users")
async def list_users(
    request: Request,
    actor: Annotated[User, Depends(require_permission("admin.users.read"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
    q: str | None = None,
    status: str | None = None,
    verification_status: Annotated[str | None, Query(alias="verificationStatus")] = None,
    created_after: Annotated[str | None, Query(alias="createdAfter")] = None,
    created_before: Annotated[str | None, Query(alias="createdBefore")] = None,
    limit: int = 20,
    offset: int = 0,
):
    _ = actor
    return success(
        request,
        await service.list_users(
            query=q,
            status=status,
            verification_status=verification_status,
            created_after=created_after,
            created_before=created_before,
            limit=limit,
            offset=offset,
        ),
    )


@router.get("/users/{user_id}")
async def user_detail(
    request: Request,
    user_id: UUID,
    actor: Annotated[User, Depends(require_permission("admin.users.read"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    _ = actor
    return success(request, await service.user_detail(user_id))


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    request: Request,
    user_id: UUID,
    actor: Annotated[User, Depends(require_admin)],
    service: Annotated[AdminService, Depends(get_admin_service)],
    body: AdminSuspendBody | None = None,
):
    payload = body or AdminSuspendBody()
    return success(request, await service.suspend(actor, user_id, payload.hours, payload.reason))


@router.post("/users/{user_id}/ban")
async def ban_user(
    request: Request,
    user_id: UUID,
    actor: Annotated[User, Depends(require_admin)],
    service: Annotated[AdminService, Depends(get_admin_service)],
    body: AdminBanBody | None = None,
):
    payload = body or AdminBanBody()
    return success(request, await service.ban(actor, user_id, payload.reason))


@router.post("/users/{user_id}/restore")
async def restore_user(
    request: Request,
    user_id: UUID,
    actor: Annotated[User, Depends(require_admin)],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    return success(request, await service.restore(actor, user_id))


@router.post("/users/{user_id}/media/remove")
async def remove_media(
    request: Request,
    user_id: UUID,
    body: AdminMediaRemoveBody,
    actor: Annotated[User, Depends(require_admin)],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    media_id = parse_user_id(body.media_id, field="mediaId")
    return success(request, await service.remove_media(actor, user_id, media_id, body.reason))


@router.get("/verification/queue")
async def verification_queue(
    request: Request,
    actor: Annotated[User, Depends(require_permission("admin.verification"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    _ = actor
    return success(request, await service.verification_queue(status, limit, offset))


@router.get("/verification/{request_id}")
async def verification_detail(
    request: Request,
    request_id: UUID,
    actor: Annotated[User, Depends(require_permission("admin.verification"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    _ = actor
    return success(request, await service.verification_detail(request_id))


@router.get("/verification/{request_id}/media/{media_id}")
async def verification_media(
    request_id: UUID,
    media_id: UUID,
    actor: Annotated[User, Depends(require_permission("admin.verification"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    data, content_type = await service.verification_media_bytes(actor, request_id, media_id)
    return Response(content=data, media_type=content_type)


@router.post("/verification/{request_id}/review")
async def review_verification(
    request: Request,
    request_id: UUID,
    body: AdminReviewBody,
    actor: Annotated[User, Depends(require_permission("admin.verification"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    return success(
        request,
        await service.review_verification(
            actor, request_id, body.action, body.reason_code, body.notes
        ),
    )


@router.get("/reports")
async def list_reports(
    request: Request,
    actor: Annotated[User, Depends(require_permission("admin.reports.read"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
    status: str | None = None,
    severity: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    _ = actor
    return success(
        request,
        await service.list_reports(
            status=status, severity=severity, assigned=None, limit=limit, offset=offset
        ),
    )


@router.get("/reports/{report_id}")
async def report_detail(
    request: Request,
    report_id: UUID,
    actor: Annotated[User, Depends(require_permission("admin.reports.read"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    return success(request, await service.report_detail(actor, report_id))


@router.post("/reports/{report_id}/assign")
async def assign_report(
    request: Request,
    report_id: UUID,
    actor: Annotated[User, Depends(require_admin)],
    service: Annotated[AdminService, Depends(get_admin_service)],
    body: AdminReportAssignBody | None = None,
):
    payload = body or AdminReportAssignBody()
    return success(request, await service.assign_report(actor, report_id, payload.reviewer_id))


@router.post("/reports/{report_id}/resolve")
async def resolve_report(
    request: Request,
    report_id: UUID,
    body: AdminReportResolveBody,
    actor: Annotated[User, Depends(require_admin)],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    if not body.resolution_code:
        raise AppError("VALIDATION_ERROR", "resolutionCode is required.", 422)
    return success(
        request,
        await service.resolve_report(actor, report_id, body.resolution_code, body.notes),
    )


@router.post("/reports/{report_id}/dismiss")
async def dismiss_report(
    request: Request,
    report_id: UUID,
    actor: Annotated[User, Depends(require_admin)],
    service: Annotated[AdminService, Depends(get_admin_service)],
    body: AdminReportResolveBody | None = None,
):
    notes = body.notes if body else None
    return success(request, await service.dismiss_report(actor, report_id, notes))


@router.get("/audit-logs")
async def audit_logs(
    request: Request,
    actor: Annotated[User, Depends(require_admin)],
    service: Annotated[AdminService, Depends(get_admin_service)],
    action: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    _ = actor
    return success(request, await service.list_audit(action, None, limit, offset))


@router.get("/subscriptions")
async def list_subscriptions(
    request: Request,
    actor: Annotated[User, Depends(require_permission("admin.users.read"))],
    billing: Annotated[SubscriptionService, Depends(get_subscription_service)],
    status: str | None = None,
    platform: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    _ = actor
    return success(request, await billing.admin_list(status, platform, limit, offset))


@router.get("/users/{user_id}/subscription")
async def user_subscription(
    request: Request,
    user_id: UUID,
    actor: Annotated[User, Depends(require_permission("admin.users.read"))],
    billing: Annotated[SubscriptionService, Depends(get_subscription_service)],
):
    _ = actor
    return success(request, await billing.admin_user(user_id))


@router.get("/events")
async def list_events(
    request: Request,
    actor: Annotated[User, Depends(require_permission("admin.events.read"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
    q: str | None = None,
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    _ = actor
    return success(
        request,
        await service.list_events(query=q, status=status, limit=limit, offset=offset),
    )


@router.get("/events/{event_id}")
async def event_detail(
    request: Request,
    event_id: UUID,
    actor: Annotated[User, Depends(require_permission("admin.events.read"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
):
    _ = actor
    return success(request, await service.event_detail(event_id))


@router.post("/events/{event_id}/hide")
async def hide_event(
    request: Request,
    event_id: UUID,
    actor: Annotated[User, Depends(require_permission("admin.events.moderate"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
    body: AdminEventActionBody | None = None,
):
    payload = body or AdminEventActionBody()
    return success(request, await service.hide_event(actor, event_id, payload.reason))


@router.post("/events/{event_id}/restore")
async def restore_event(
    request: Request,
    event_id: UUID,
    actor: Annotated[User, Depends(require_permission("admin.events.moderate"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
    body: AdminEventActionBody | None = None,
):
    payload = body or AdminEventActionBody()
    return success(request, await service.restore_event(actor, event_id, payload.reason))


@router.post("/events/{event_id}/cover/remove")
async def remove_event_cover(
    request: Request,
    event_id: UUID,
    actor: Annotated[User, Depends(require_permission("admin.events.moderate"))],
    service: Annotated[AdminService, Depends(get_admin_service)],
    body: AdminEventActionBody | None = None,
):
    payload = body or AdminEventActionBody()
    return success(request, await service.remove_event_cover(actor, event_id, payload.reason))
