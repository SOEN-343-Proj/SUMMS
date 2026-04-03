from __future__ import annotations

import unittest
from unittest.mock import patch

from tests.test_support import BackendTestCase

try:
    from fastapi.testclient import TestClient
except Exception:  # pragma: no cover - handled by skip
    TestClient = None


@unittest.skipIf(TestClient is None, "fastapi TestClient requires httpx")
class MobilityRoutesIntegrationTests(BackendTestCase):
    def test_parking_nearest_route_accepts_address_input(self) -> None:
        from src.backend.main import app

        with (
            patch("src.backend.controllers.mobility_controller.parking_model.get_google_maps_api_key", return_value="test-key"),
            patch("src.backend.controllers.mobility_controller.parking_model.geocode_address", return_value=(45.501, -73.567)),
            patch(
                "src.backend.controllers.mobility_controller.parking_model.get_nearby_parking_spots",
                return_value=[
                    {
                        "id": "spot-123",
                        "lat": 45.501,
                        "lng": -73.567,
                        "name": "Downtown Garage",
                        "address": "123 Main St",
                        "distance_km": 0.18,
                    }
                ],
            ),
        ):
            with TestClient(app) as client:
                response = client.get("/parking/nearest", params={"address": "123 Main St"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["spots"][0]["name"], "Downtown Garage")
