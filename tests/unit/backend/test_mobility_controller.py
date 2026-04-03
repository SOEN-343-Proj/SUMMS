from __future__ import annotations

from unittest.mock import patch

from src.backend import analytics_service
from src.backend.controllers import mobility_controller

from tests.test_support import BackendTestCase


class MobilityControllerUnitTests(BackendTestCase):
    def test_get_nearest_parking_geocodes_address_and_tracks_event(self) -> None:
        with (
            patch("src.backend.controllers.mobility_controller.parking_model.get_google_maps_api_key", return_value="test-key"),
            patch("src.backend.controllers.mobility_controller.parking_model.geocode_address", return_value=(45.5, -73.56)),
            patch(
                "src.backend.controllers.mobility_controller.parking_model.get_nearby_parking_spots",
                return_value=[{"id": "spot-1", "lat": 45.5, "lng": -73.56, "name": "Lot A", "distance_km": 0.2}],
            ),
        ):
            result = mobility_controller.get_nearest_parking(address="1455 De Maisonneuve Blvd W")

        self.assertEqual(result["count"], 1)
        self.assertEqual(result["spots"][0]["id"], "spot-1")
        self.assertEqual(analytics_service.analytics.parking_searches, 1)
        self.assertEqual(analytics_service.analytics.service_usage["parking"], 1)
