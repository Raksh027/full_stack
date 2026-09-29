import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.errors import AppError

logger = logging.getLogger(__name__)


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "-")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {"code": exc.code, "message": exc.message},
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        message = "; ".join(
            f"{'.'.join(str(x) for x in err.get('loc', []))}: {err.get('msg')}"
            for err in exc.errors()
        )
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": {"code": "VALIDATION_ERROR", "message": message},
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning("db_integrity request_id=%s", _request_id(request))
        return JSONResponse(
            status_code=409,
            content={
                "success": False,
                "error": {"code": "CONFLICT", "message": "Resource already exists."},
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(SQLAlchemyError)
    async def db_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.exception("db_error request_id=%s", _request_id(request))
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": {"code": "DATABASE_UNAVAILABLE", "message": "Database error."},
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled request_id=%s", _request_id(request))
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {"code": "INTERNAL_ERROR", "message": "Something went wrong."},
                "request_id": _request_id(request),
            },
        )
