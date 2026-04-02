from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

from ..controllers import auth_controller


class AdminCodeRequest(BaseModel):
    code: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


router = APIRouter()


@router.post("/auth/admin/code")
def validate_admin_code(payload: AdminCodeRequest):
    return auth_controller.validate_admin_code(payload.code)


@router.post("/auth/admin/login")
def admin_login(payload: LoginRequest):
    return auth_controller.admin_login(payload.email, payload.password)


@router.post("/auth/user/login")
def user_login(payload: LoginRequest):
    return auth_controller.user_login(payload.email, payload.password)


@router.post("/auth/user/register")
def user_register(payload: RegisterRequest):
    return auth_controller.user_register(payload.name, payload.email, payload.password)


@router.get("/users")
def list_users():
    return auth_controller.list_users()


@router.get("/admins")
def list_admins():
    return auth_controller.list_admins()
