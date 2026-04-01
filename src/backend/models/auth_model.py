from __future__ import annotations

from ..credentials import (
    authenticate_admin,
    authenticate_user,
    get_all_admins,
    get_all_users,
    register_user,
    verify_admin_code,
)


def validate_admin_code(code: str) -> bool:
    return verify_admin_code(code)


def login_admin(email: str, password: str):
    return authenticate_admin(email, password)


def login_user(email: str, password: str):
    return authenticate_user(email, password)


def create_user(email: str, password: str, name: str):
    return register_user(email, password, name)


def list_users():
    return get_all_users()


def list_admins():
    return get_all_admins()
