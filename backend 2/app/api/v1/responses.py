from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel


def success(request: Request, data: Any, status_code: int = 200) -> JSONResponse:
    if isinstance(data, BaseModel):
        payload = data.model_dump(by_alias=True)
    else:
        payload = jsonable_encoder(data)
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "data": payload,
            "request_id": getattr(request.state, "request_id", "-"),
        },
    )
