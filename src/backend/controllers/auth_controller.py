from __future__ import annotations

from fastapi import HTTPException

from ..models import auth_model
from ..observer import event_manager


def validate_admin_code(code: str) -> dict[str, bool]:
    return {"valid": auth_model.validate_admin_code(code)}


def admin_login(email: str, password: str):
    admin = auth_model.login_admin(email, password)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    event_manager.notify("admin_login", {"email": email})
    return {"success": True, "admin": admin}


def user_login(email: str, password: str):
    user = auth_model.login_user(email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user credentials")

    event_manager.notify("user_login", {"email": email})
    return {"success": True, "user": user}


def user_register(name: str, email: str, password: str):
    result = auth_model.create_user(email, password, name)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


def list_users():
    return {"users": auth_model.list_users()}


def list_admins():
    return {"admins": auth_model.list_admins()}
