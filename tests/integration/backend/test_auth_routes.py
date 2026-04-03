from __future__ import annotations

import unittest

from tests.test_support import BackendTestCase

try:
    from fastapi.testclient import TestClient
except Exception:  # pragma: no cover - handled by skip
    TestClient = None


@unittest.skipIf(TestClient is None, "fastapi TestClient requires httpx")
class AuthRoutesIntegrationTests(BackendTestCase):
    def test_admin_and_user_auth_endpoints(self) -> None:
        from src.backend.main import app

        with TestClient(app) as client:
            admin_code = client.post("/auth/admin/code", json={"code": "ADMIN2025"})
            admin_login = client.post(
                "/auth/admin/login",
                json={"email": "admin@cityflow.com", "password": "SecureAdmin123!"},
            )
            register = client.post(
                "/auth/user/register",
                json={"name": "Taylor User", "email": "taylor.user@student.com", "password": "student999"},
            )
            user_login = client.post(
                "/auth/user/login",
                json={"email": "taylor.user@student.com", "password": "student999"},
            )

        self.assertEqual(admin_code.status_code, 200)
        self.assertTrue(admin_code.json()["valid"])
        self.assertEqual(admin_login.status_code, 200)
        self.assertEqual(admin_login.json()["admin"]["role"], "admin")
        self.assertEqual(register.status_code, 200)
        self.assertTrue(register.json()["success"])
        self.assertEqual(user_login.status_code, 200)
        self.assertEqual(user_login.json()["user"]["email"], "taylor.user@student.com")
