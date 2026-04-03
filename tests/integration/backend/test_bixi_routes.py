from __future__ import annotations

import unittest
from unittest.mock import patch

from tests.test_support import BackendTestCase

try:
    from fastapi.testclient import TestClient
except Exception:  # pragma: no cover - handled by skip
    TestClient = None


@unittest.skipIf(TestClient is None, "fastapi TestClient requires httpx")
class BixiRoutesIntegrationTests(BackendTestCase):
    def test_bixi_reserve_pay_and_return_flow(self) -> None:
        from src.backend.main import app

        with patch("src.backend.Sprint1Implementation.bixi_rental._load_station_feed", return_value=self.sample_bixi_stations()):
            with TestClient(app) as client:
                reserve_response = client.post(
                    "/bixi/rentals/reserve",
                    json={
                        "user_email": "john.doe@student.com",
                        "user_name": "John Doe",
                        "station_id": "station-a",
                    },
                )
                rental_id = reserve_response.json()["rental"]["id"]

                pay_response = client.post(
                    f"/bixi/rentals/{rental_id}/pay",
                    json={
                        "user_email": "john.doe@student.com",
                        "payment_method": "card",
                    },
                )
                return_response = client.post(
                    f"/bixi/rentals/{rental_id}/return",
                    json={
                        "user_email": "john.doe@student.com",
                        "return_station_id": "station-b",
                    },
                )

        self.assertEqual(reserve_response.status_code, 200)
        self.assertEqual(pay_response.status_code, 200)
        self.assertEqual(pay_response.json()["rental"]["status"], "active")
        self.assertEqual(return_response.status_code, 200)
        self.assertEqual(return_response.json()["rental"]["status"], "returned")
        self.assertEqual(return_response.json()["rental"]["payment"]["status"], "captured")
