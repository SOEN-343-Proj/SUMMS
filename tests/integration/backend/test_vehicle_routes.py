from __future__ import annotations

import unittest

from tests.test_support import BackendTestCase

try:
    from fastapi.testclient import TestClient
except Exception:  # pragma: no cover - handled by skip
    TestClient = None


@unittest.skipIf(TestClient is None, "fastapi TestClient requires httpx")
class VehicleRoutesIntegrationTests(BackendTestCase):
    def test_vehicle_marketplace_lifecycle(self) -> None:
        from src.backend.main import app

        with TestClient(app) as client:
            create_response = client.post(
                "/vehicles",
                json={
                    "listed_by_email": "owner@cityflow.com",
                    "target": "marketplace",
                    "vehicle_type": "car",
                    "make": "Ford",
                    "model": "Escape",
                    "year": 2024,
                    "daily_rate": 75,
                    "seats": 5,
                },
            )
            vehicle_id = create_response.json()["vehicle"]["id"]

            rent_response = client.post(
                "/vehicles/rent",
                json={
                    "user_email": "john.doe@student.com",
                    "user_name": "John Doe",
                    "vehicle_id": vehicle_id,
                    "payment_method": "card",
                },
            )
            available_after_rent = client.get("/vehicles/available")
            return_response = client.post(
                "/vehicles/return",
                json={"user_email": "john.doe@student.com", "vehicle_id": vehicle_id},
            )

        self.assertEqual(create_response.status_code, 200)
        self.assertEqual(rent_response.status_code, 200)
        self.assertNotIn(vehicle_id, {vehicle["id"] for vehicle in available_after_rent.json()["vehicles"]})
        self.assertEqual(return_response.status_code, 200)
        self.assertEqual(return_response.json()["rental"]["billing"]["amount_billed"], 75.0)

    def test_vehicle_permission_and_in_use_conflicts(self) -> None:
        from src.backend.main import app

        with TestClient(app) as client:
            create_response = client.post(
                "/vehicles",
                json={
                    "listed_by_email": "owner@cityflow.com",
                    "target": "marketplace",
                    "vehicle_type": "car",
                    "make": "Nissan",
                    "model": "Sentra",
                    "year": 2023,
                    "daily_rate": 63,
                    "seats": 5,
                },
            )
            vehicle_id = create_response.json()["vehicle"]["id"]

            forbidden_update = client.patch(
                f"/vehicles/{vehicle_id}",
                json={"user_email": "intruder@cityflow.com", "color": "Black"},
            )

            client.post(
                "/vehicles/rent",
                json={
                    "user_email": "john.doe@student.com",
                    "user_name": "John Doe",
                    "vehicle_id": vehicle_id,
                    "payment_method": "wallet",
                },
            )

            conflict_delete = client.delete(f"/vehicles/{vehicle_id}", params={"user_email": "owner@cityflow.com"})

        self.assertEqual(forbidden_update.status_code, 403)
        self.assertEqual(conflict_delete.status_code, 409)
