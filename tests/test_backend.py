from __future__ import annotations

import atexit
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

ORIGINAL_CWD = Path.cwd()
RUNTIME_DIR = tempfile.TemporaryDirectory()
os.chdir(RUNTIME_DIR.name)


def _restore_runtime_directory() -> None:
    os.chdir(ORIGINAL_CWD)
    RUNTIME_DIR.cleanup()


atexit.register(_restore_runtime_directory)

from fastapi.testclient import TestClient

from src.backend import analytics_service, transit_adapters
from src.backend.main import app
from src.backend.Sprint1Implementation import bixi_rental
from src.backend.models import parking_model, vehicle_model


def reset_analytics_state() -> None:
    analytics = analytics_service.analytics
    analytics.total_requests = 0
    analytics.parking_searches = 0
    analytics.admin_logins = 0
    analytics.user_logins = 0
    analytics.uber_bixi_searches = 0
    analytics.bixi_reservations = 0
    analytics.bixi_rides_completed = 0
    analytics.vehicle_rentals = 0
    analytics.vehicle_returns = 0
    analytics.vehicle_listings = 0
    analytics.transit_searches = 0
    analytics.service_usage = {}
    analytics.feature_opens = {}
    analytics.event_log = []
    analytics.hourly_buckets = {}


def reset_bixi_state() -> None:
    bixi_rental._bixi_rentals.clear()
    bixi_rental._station_cache["fetched_at"] = 0.0
    bixi_rental._station_cache["stations"] = []


class BackendUnitTests(unittest.TestCase):
    # Verifies that HTML tags, entities, and extra whitespace are normalized into plain text.
    def test_strip_html_text_removes_markup_and_entities(self):
        value = " Walk&nbsp;<b>north</b>\n to <div>Station</div> "

        self.assertEqual(transit_adapters.strip_html_text(value), "Walk north to Station")

    # Verifies that subway routes are relabeled using the UI's Metro naming convention.
    def test_format_transit_line_label_maps_subway_to_metro_label(self):
        label = transit_adapters.format_transit_line_label("Subway", "Green")

        self.assertEqual(label, "Metro Line Green")

    # Verifies that Google-style duration strings like "3660s" are converted into integer seconds.
    def test_parse_google_duration_seconds_reads_duration_payload(self):
        self.assertEqual(transit_adapters.parse_google_duration_seconds("3660s"), 3660)

    # Verifies that raw seconds are formatted into the human-readable hour/minute text shown in routes.
    def test_format_duration_text_from_seconds_formats_hours_and_minutes(self):
        formatted = transit_adapters.format_duration_text_from_seconds(3660)

        self.assertEqual(formatted, "1 hr 1 min")

    # Verifies that nested Google Routes API coordinates are converted into the app's lat/lng shape.
    def test_get_routes_api_lat_lng_extracts_nested_coordinates(self):
        location = {"latLng": {"latitude": "45.5017", "longitude": "-73.5673"}}

        self.assertEqual(
            transit_adapters.get_routes_api_lat_lng(location),
            {"lat": 45.5017, "lng": -73.5673},
        )

    # Verifies that a transit step from the Directions API is mapped into the frontend-friendly transit step format.
    def test_map_direction_step_maps_transit_details(self):
        step = {
            "travel_mode": "TRANSIT",
            "duration": {"text": "12 min"},
            "transit_details": {
                "line": {
                    "vehicle": {"name": "Subway"},
                    "short_name": "Green",
                },
                "departure_stop": {"name": "Peel"},
                "arrival_stop": {"name": "Berri-UQAM"},
                "num_stops": 3,
                "departure_time": {"text": "9:15 AM"},
                "arrival_time": {"text": "9:27 AM"},
            },
        }

        mapped = transit_adapters.map_direction_step(step)

        self.assertEqual(mapped["kind"], "transit")
        self.assertEqual(mapped["mode"], "Metro")
        self.assertEqual(mapped["title"], "Metro Line Green from Peel")
        self.assertEqual(mapped["detail"], "Get off at Berri-UQAM • 3 stops • 12 min")
        self.assertEqual(mapped["lineLabel"], "Metro Line Green")
        self.assertEqual(mapped["departureTime"], "9:15 AM")
        self.assertEqual(mapped["arrivalTime"], "9:27 AM")

    # Verifies that a walking step from the Routes API is mapped into the expected walk-step structure.
    def test_map_routes_api_step_maps_walking_details(self):
        step = {
            "travelMode": "WALK",
            "navigationInstruction": {"instructions": "<b>Head east</b> on Rue Sainte-Catherine"},
            "localizedValues": {
                "distance": {"text": "250 m"},
                "staticDuration": {"text": "4 min"},
            },
        }

        mapped = transit_adapters.map_routes_api_step(step)

        self.assertEqual(mapped["kind"], "walk")
        self.assertEqual(mapped["mode"], "Walk")
        self.assertEqual(mapped["title"], "Head east on Rue Sainte-Catherine")
        self.assertEqual(mapped["detail"], "4 min • 250 m")

    # Verifies that the transit service falls through empty providers and returns the first provider with usable routes.
    def test_transit_directions_service_adapter_uses_first_non_empty_provider(self):
        class EmptyProvider:
            def fetch_routes(self, origin: str, destination: str):
                return []

        class SuccessProvider:
            def fetch_routes(self, origin: str, destination: str):
                return [{"summary": f"{origin} to {destination}"}]

        service = transit_adapters.TransitDirectionsServiceAdapter(
            [
                ("empty", EmptyProvider()),
                ("success", SuccessProvider()),
            ]
        )

        self.assertEqual(
            service.fetch_routes("A", "B"),
            [{"summary": "A to B"}],
        )

    # Verifies that expired parking cache entries are invalidated and removed instead of being reused.
    def test_parking_cache_value_discards_expired_entries(self):
        cache = {"demo": (100.0, ["old spot"])}

        with patch("src.backend.models.parking_model.time.time", return_value=200.0):
            value = parking_model.get_cache_value(cache, "demo", ttl_seconds=30)

        self.assertIsNone(value)
        self.assertNotIn("demo", cache)

    # Verifies that VIN normalization strips punctuation/spacing and uppercases the value before decoding.
    def test_normalize_vin_strips_noise_and_uppercases_characters(self):
        vin = vehicle_model._normalize_vin(" 1hg-cm82633a004352 ")

        self.assertEqual(vin, "1HGCM82633A004352")


class BackendIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def setUp(self):
        self.save_patcher = patch.object(analytics_service.AnalyticsService, "save", return_value=None)
        self.save_patcher.start()
        reset_analytics_state()
        reset_bixi_state()

    def tearDown(self):
        self.save_patcher.stop()

    # Verifies that the health endpoint responds successfully and still increments request analytics.
    def test_health_endpoint_returns_ok_status(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(analytics_service.analytics.total_requests, 1)

    # Verifies that the admin code endpoint accepts the known demo admin code.
    def test_admin_code_endpoint_accepts_known_code(self):
        response = self.client.post("/auth/admin/code", json={"code": "ADMIN2025"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"valid": True})
        self.assertEqual(analytics_service.analytics.total_requests, 1)

    # Verifies that user login returns the expected payload and records login analytics.
    def test_user_login_endpoint_returns_user_payload(self):
        response = self.client.post(
            "/auth/user/login",
            json={
                "email": "john.doe@student.com",
                "password": "student123",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(response.json()["user"]["email"], "john.doe@student.com")
        self.assertEqual(analytics_service.analytics.user_logins, 1)
        self.assertEqual(analytics_service.analytics.service_usage["user_login"], 1)

    # Verifies that unknown analytics events are rejected with a 400 and do not create event log entries.
    def test_unknown_frontend_event_returns_bad_request(self):
        response = self.client.post(
            "/analytics/event",
            json={"event": "not_allowed", "data": {"feature": "demo"}},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Unknown event")
        self.assertEqual(analytics_service.analytics.total_requests, 1)
        self.assertEqual(analytics_service.analytics.event_log, [])

    # Verifies that the parking endpoint returns mocked spot data and records a parking search analytics event.
    def test_nearest_parking_endpoint_returns_mocked_spots(self):
        mock_spots = [
            {
                "id": "spot-1",
                "lat": 45.5017,
                "lng": -73.5673,
                "name": "Place des Arts Parking",
                "address": "Montreal",
                "distance_km": 0.12,
            }
        ]

        with patch(
            "src.backend.controllers.mobility_controller.parking_model.get_google_maps_api_key",
            return_value="test-key",
        ), patch(
            "src.backend.controllers.mobility_controller.parking_model.get_nearby_parking_spots",
            return_value=mock_spots,
        ):
            response = self.client.get(
                "/parking/nearest",
                params={"lat": 45.5017, "lng": -73.5673, "radius": 1},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["spots"][0]["name"], "Place des Arts Parking")
        self.assertEqual(analytics_service.analytics.parking_searches, 1)
        self.assertEqual(analytics_service.analytics.service_usage["parking"], 1)

    # Verifies the full BIXI lifecycle: reserve keeps inventory unchanged, payment activates and removes one bike,
    # return restores bike inventory at the return station, the rental moves from open to history, and summary analytics update.
    def test_bixi_rental_cycle_updates_inventory_payment_and_summary_analytics(self):
        stations = [
            {
                "id": "station-a",
                "name": "McGill Station",
                "address": "123 University",
                "lat": 45.5017,
                "lng": -73.5673,
                "capacity": 10,
                "is_installed": True,
                "is_renting": True,
                "is_returning": True,
                "bikes_available": 3,
                "docks_available": 7,
            },
            {
                "id": "station-b",
                "name": "Place des Arts",
                "address": "456 Sainte-Catherine",
                "lat": 45.5088,
                "lng": -73.5686,
                "capacity": 10,
                "is_installed": True,
                "is_renting": True,
                "is_returning": True,
                "bikes_available": 1,
                "docks_available": 9,
            },
        ]

        with patch("src.backend.Sprint1Implementation.bixi_rental._load_station_feed", return_value=stations):
            initial_station_response = self.client.get(
                "/bixi/stations/nearby",
                params={"lat": 45.5017, "lng": -73.5673, "limit": 12, "radius": 3},
            )
            initial_stations = {station["id"]: station for station in initial_station_response.json()["stations"]}
            self.assertEqual(initial_stations["station-a"]["bikes_available"], 3)
            self.assertEqual(initial_stations["station-b"]["bikes_available"], 1)

            reserve_response = self.client.post(
                "/bixi/rentals/reserve",
                json={
                    "user_email": "rider@example.com",
                    "user_name": "Rider Example",
                    "station_id": "station-a",
                },
            )
            self.assertEqual(reserve_response.status_code, 200)
            reserved_rental = reserve_response.json()["rental"]
            rental_id = reserved_rental["id"]
            self.assertEqual(reserved_rental["status"], "reserved")
            self.assertEqual(reserved_rental["payment"]["status"], "pending")
            self.assertIsNone(reserved_rental["started_at"])
            self.assertIsNone(reserved_rental["returned_at"])

            reserved_state_response = self.client.get(
                "/bixi/rentals/state",
                params={"user_email": "rider@example.com", "history_limit": 5},
            )
            self.assertEqual(reserved_state_response.status_code, 200)
            self.assertEqual(reserved_state_response.json()["open_rental"]["status"], "reserved")
            self.assertEqual(reserved_state_response.json()["history"], [])

            station_after_reserve_response = self.client.get(
                "/bixi/stations/nearby",
                params={"lat": 45.5017, "lng": -73.5673, "limit": 12, "radius": 3},
            )
            stations_after_reserve = {
                station["id"]: station for station in station_after_reserve_response.json()["stations"]
            }
            self.assertEqual(stations_after_reserve["station-a"]["bikes_available"], 3)
            self.assertEqual(stations_after_reserve["station-a"]["docks_available"], 7)

            pay_response = self.client.post(
                f"/bixi/rentals/{rental_id}/pay",
                json={
                    "user_email": "rider@example.com",
                    "payment_method": "card",
                    "payment_details": {
                        "card_brand": "Visa",
                        "card_last4": "4242",
                    },
                },
            )
            self.assertEqual(pay_response.status_code, 200)
            active_rental = pay_response.json()["rental"]
            self.assertEqual(active_rental["status"], "active")
            self.assertEqual(active_rental["payment"]["status"], "authorized")
            self.assertEqual(active_rental["payment"]["authorization_amount"], 4.25)
            self.assertEqual(active_rental["payment"]["method"], "card")
            self.assertEqual(active_rental["payment"]["provider"], "CardGateway")
            self.assertTrue(active_rental["payment"]["transaction_id"])
            self.assertEqual(active_rental["payment"]["receipt"]["card_last4"], "4242")
            self.assertIsNotNone(active_rental["started_at"])
            self.assertIsNone(active_rental["returned_at"])
            self.assertIsNone(active_rental["payment"]["final_cost"])

            station_after_payment_response = self.client.get(
                "/bixi/stations/nearby",
                params={"lat": 45.5017, "lng": -73.5673, "limit": 12, "radius": 3},
            )
            stations_after_payment = {
                station["id"]: station for station in station_after_payment_response.json()["stations"]
            }
            self.assertEqual(stations_after_payment["station-a"]["bikes_available"], 2)
            self.assertEqual(stations_after_payment["station-a"]["docks_available"], 8)
            self.assertEqual(stations_after_payment["station-b"]["bikes_available"], 1)

            return_response = self.client.post(
                f"/bixi/rentals/{rental_id}/return",
                json={
                    "user_email": "rider@example.com",
                    "return_station_id": "station-b",
                },
            )
            self.assertEqual(return_response.status_code, 200)
            returned_rental = return_response.json()["rental"]
            self.assertEqual(returned_rental["status"], "returned")
            self.assertEqual(returned_rental["payment"]["status"], "captured")
            self.assertEqual(returned_rental["return_station"]["id"], "station-b")
            self.assertIsNotNone(returned_rental["returned_at"])
            self.assertGreaterEqual(returned_rental["duration_minutes"], 1)
            self.assertGreater(returned_rental["payment"]["final_cost"], 0)

            station_after_return_response = self.client.get(
                "/bixi/stations/nearby",
                params={"lat": 45.5017, "lng": -73.5673, "limit": 12, "radius": 3},
            )
            stations_after_return = {
                station["id"]: station for station in station_after_return_response.json()["stations"]
            }
            self.assertEqual(stations_after_return["station-a"]["bikes_available"], 2)
            self.assertEqual(stations_after_return["station-a"]["docks_available"], 8)
            self.assertEqual(stations_after_return["station-b"]["bikes_available"], 2)
            self.assertEqual(stations_after_return["station-b"]["docks_available"], 8)

            final_state_response = self.client.get(
                "/bixi/rentals/state",
                params={"user_email": "rider@example.com", "history_limit": 5},
            )
            self.assertEqual(final_state_response.status_code, 200)
            self.assertIsNone(final_state_response.json()["open_rental"])
            self.assertEqual(len(final_state_response.json()["history"]), 1)
            self.assertEqual(final_state_response.json()["history"][0]["status"], "returned")

            analytics_response = self.client.get("/bixi/analytics/summary")
            self.assertEqual(analytics_response.status_code, 200)
            analytics = analytics_response.json()
            self.assertEqual(analytics["total_rentals"], 1)
            self.assertEqual(analytics["reserved_rentals"], 0)
            self.assertEqual(analytics["active_rentals"], 0)
            self.assertEqual(analytics["completed_rentals"], 1)
            self.assertGreater(analytics["total_revenue"], 0)
            self.assertGreaterEqual(analytics["average_duration_minutes"], 1)
            self.assertEqual(analytics["popular_pickup_station"], "McGill Station")


if __name__ == "__main__":
    unittest.main()
