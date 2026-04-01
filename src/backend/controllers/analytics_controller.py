from __future__ import annotations

from fastapi import HTTPException

from ..models import analytics_model
from ..observer import event_manager


def track_frontend_event(event_name: str, data: dict | None = None):
    if not analytics_model.is_allowed_frontend_event(event_name):
        raise HTTPException(status_code=400, detail="Unknown event")

    event_manager.notify(event_name, data)
    return {"ok": True}
