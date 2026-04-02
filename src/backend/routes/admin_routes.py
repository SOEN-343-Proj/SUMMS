from __future__ import annotations

from fastapi import APIRouter

from ..controllers import admin_controller


router = APIRouter()


@router.get("/admin/analytics")
def get_admin_analytics():
    return admin_controller.get_admin_analytics()
