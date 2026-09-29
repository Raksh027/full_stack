from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.v1.responses import success
from app.dependencies.admin import get_report_service
from app.dependencies.auth import get_current_user
from app.models.orm import User
from app.schemas.reports import ReportCreate
from app.services.reports import ReportService

router = APIRouter(tags=["Safety"])


@router.post("/reports")
async def create_report(
    request: Request,
    body: ReportCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ReportService, Depends(get_report_service)],
):
    return success(request, await service.create(user, body), 201)
