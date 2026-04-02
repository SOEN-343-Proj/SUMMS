from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..controllers import analytics_controller


class FrontendEventRequest(BaseModel):
    event: str
    data: dict[str, Any] | None = None


router = APIRouter()


@router.post("/analytics/event")
def track_frontend_event(payload: FrontendEventRequest):
    return analytics_controller.track_frontend_event(payload.event, payload.data)
