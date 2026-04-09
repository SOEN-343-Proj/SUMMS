from __future__ import annotations

import atexit
import os
import sys
import tempfile
import unittest
from copy import deepcopy
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

from src.backend import analytics_service
from src.backend.main import app
from src.backend.Sprint1Implementation import bixi_rental, vehicle_rental
from src.backend.models import parking_model

INITIAL_VEHICLE_CATALOG = deepcopy(vehicle_rental._vehicle_catalog)


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


def reset_vehicle_state() -> None:
    vehicle_rental._vehicle_catalog.clear()
    vehicle_rental._vehicle_catalog.extend(deepcopy(INITIAL_VEHICLE_CATALOG))
    vehicle_rental._rented_by_user.clear()
    vehicle_rental._vehicle_rentals_by_vehicle_id.clear()


def reset_parking_state() -> None:
    parking_model.NEARBY_CACHE.clear()
    parking_model.GEOCODE_CACHE.clear()


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
        reset_vehicle_state()
        reset_parking_state()

    def tearDown(self):
        self.save_patcher.stop()

    def post_frontend_event(self, event_name: str, data: dict | None = None):
        return self.client.post(
            "/analytics/event",
            json={"event": event_name, "data": data or {}},
        )

    def get_admin_analytics(self):
        response = self.client.get("/admin/analytics")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_health_endpoint_returns_ok_status(self):
        """Health check should return an OK payload and increment request analytics."""
        # Hit the simplest backend endpoint to confirm the app is up and responding.
        response = self.client.get("/health")

        # Verify both the response body and the request-tracking middleware side effect.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(analytics_service.analytics.total_requests, 1)

    def test_nearest_parking_endpoint_returns_mocked_spots(self):
        """Parking search should return nearby spots and show up in admin analytics."""
        # Use fixed parking data so this test focuses on our backend behavior, not Google APIs.
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

        # Mock the parking lookup dependencies and call the public parking endpoint.
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

        # Confirm the API returns the mocked parking data in the expected shape.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["spots"][0]["name"], "Place des Arts Parking")

        # Confirm the feature also increments the in-memory analytics counters.
        self.assertEqual(analytics_service.analytics.parking_searches, 1)
        self.assertEqual(analytics_service.analytics.service_usage["parking"], 1)

        # Confirm the admin analytics endpoint reflects the same parking activity.
        admin_analytics = self.get_admin_analytics()
        self.assertEqual(admin_analytics["parking_searches"], 1)
        self.assertEqual(admin_analytics["service_usage"]["parking"], 1)
        self.assertTrue(any(entry["event"] == "parking_search" for entry in admin_analytics["event_log"]))

    def test_bixi_rental_cycle_updates_inventory_payment_and_summary_analytics(self):
        """BIXI lifecycle should reserve, pay, return, and update rider and admin analytics."""
        # Create two predictable stations so we can track inventory changes through the entire ride.
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

        # Replace the live BIXI station feed with our fixed station data.
        with patch("src.backend.Sprint1Implementation.bixi_rental._load_station_feed", return_value=stations):
            # Check the starting inventory before any reservation is created.
            initial_station_response = self.client.get(
                "/bixi/stations/nearby",
                params={"lat": 45.5017, "lng": -73.5673, "limit": 12, "radius": 3},
            )
            initial_stations = {station["id"]: station for station in initial_station_response.json()["stations"]}
            self.assertEqual(initial_stations["station-a"]["bikes_available"], 3)
            self.assertEqual(initial_stations["station-b"]["bikes_available"], 1)

            # Reserve a bike and capture the generated rental id for the next steps.
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

            # Simulate the frontend analytics event that would normally fire after reserving.
            self.assertEqual(
                self.post_frontend_event(
                    "bixi_reserved",
                    {"station_name": "McGill Station", "email": "rider@example.com"},
                ).status_code,
                200,
            )

            # The user should now have one open reserved rental and no completed history yet.
            reserved_state_response = self.client.get(
                "/bixi/rentals/state",
                params={"user_email": "rider@example.com", "history_limit": 5},
            )
            self.assertEqual(reserved_state_response.status_code, 200)
            self.assertEqual(reserved_state_response.json()["open_rental"]["status"], "reserved")
            self.assertEqual(reserved_state_response.json()["history"], [])

            # A reservation should not remove a bike until payment activates the ride.
            station_after_reserve_response = self.client.get(
                "/bixi/stations/nearby",
                params={"lat": 45.5017, "lng": -73.5673, "limit": 12, "radius": 3},
            )
            stations_after_reserve = {
                station["id"]: station for station in station_after_reserve_response.json()["stations"]
            }
            self.assertEqual(stations_after_reserve["station-a"]["bikes_available"], 3)
            self.assertEqual(stations_after_reserve["station-a"]["docks_available"], 7)

            # Authorize payment to activate the rental and unlock the bike.
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

            # Simulate the matching frontend analytics event for the payment step.
            self.assertEqual(
                self.post_frontend_event(
                    "bixi_payment",
                    {"payment_method": "card", "email": "rider@example.com"},
                ).status_code,
                200,
            )

            # Once active, one bike should be removed from the pickup station inventory.
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

            # Return the bike to the second station to complete the rental lifecycle.
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

            # Simulate the frontend analytics event that fires after a successful return.
            self.assertEqual(
                self.post_frontend_event(
                    "bixi_returned",
                    {"station_name": "Place des Arts", "email": "rider@example.com"},
                ).status_code,
                200,
            )

            # After return, the bike should reappear at the destination station.
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

            # The rental should move out of the open slot and into completed history.
            final_state_response = self.client.get(
                "/bixi/rentals/state",
                params={"user_email": "rider@example.com", "history_limit": 5},
            )
            self.assertEqual(final_state_response.status_code, 200)
            self.assertIsNone(final_state_response.json()["open_rental"])
            self.assertEqual(len(final_state_response.json()["history"]), 1)
            self.assertEqual(final_state_response.json()["history"][0]["status"], "returned")

            # The BIXI summary endpoint should reflect one full completed ride.
            summary_response = self.client.get("/bixi/analytics/summary")
            self.assertEqual(summary_response.status_code, 200)
            summary = summary_response.json()
            self.assertEqual(summary["total_rentals"], 1)
            self.assertEqual(summary["reserved_rentals"], 0)
            self.assertEqual(summary["active_rentals"], 0)
            self.assertEqual(summary["completed_rentals"], 1)
            self.assertGreater(summary["total_revenue"], 0)
            self.assertGreaterEqual(summary["average_duration_minutes"], 1)
            self.assertEqual(summary["popular_pickup_station"], "McGill Station")

            # The admin analytics dashboard should also show the BIXI activity and event log entries.
            admin_analytics = self.get_admin_analytics()
            self.assertEqual(admin_analytics["bixi_reservations"], 1)
            self.assertEqual(admin_analytics["bixi_rides_completed"], 1)
            self.assertEqual(admin_analytics["service_usage"]["bixi"], 1)
            self.assertTrue(any(entry["event"] == "bixi_reserved" for entry in admin_analytics["event_log"]))
            self.assertTrue(any(entry["event"] == "bixi_payment" for entry in admin_analytics["event_log"]))
            self.assertTrue(any(entry["event"] == "bixi_returned" for entry in admin_analytics["event_log"]))

    def test_transit_directions_endpoint_returns_routes_and_updates_admin_analytics(self):
        """Public transit planning should return route options and appear in admin analytics."""
        # Build a representative transit route payload that looks like what the frontend expects.
        mock_routes = [
            {
                "summary": "Metro and walk",
                "durationText": "18 min",
                "startAddress": "1455 De Maisonneuve Blvd W",
                "endAddress": "175 Sainte-Catherine St W",
                "steps": [
                    {
                        "kind": "walk",
                        "mode": "Walk",
                        "title": "Walk to Guy-Concordia",
                        "detail": "4 min - 250 m",
                    },
                    {
                        "kind": "transit",
                        "mode": "Metro",
                        "title": "Metro Line Green from Guy-Concordia",
                        "detail": "Get off at Place-des-Arts - 2 stops - 9 min",
                    },
                ],
            }
        ]

        # Stub the route planner dependencies so the test validates our controller and analytics flow.
        with patch(
            "src.backend.controllers.mobility_controller.parking_model.get_google_maps_api_key",
            return_value="test-key",
        ), patch(
            "src.backend.controllers.mobility_controller.transit_model.get_transit_routes",
            return_value=mock_routes,
        ):
            response = self.client.get(
                "/transit/directions",
                params={
                    "origin": "1455 De Maisonneuve Blvd W, Montreal",
                    "destination": "175 Sainte-Catherine St W, Montreal",
                },
            )

        # Verify the route planner returns the mocked transit option to the client.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["routes"]), 1)
        self.assertEqual(response.json()["routes"][0]["summary"], "Metro and walk")

        # Simulate the frontend analytics event that is fired after a route search completes.
        self.assertEqual(
            self.post_frontend_event(
                "transit_route_searched",
                {
                    "origin": "Concordia University",
                    "destination": "Place des Arts",
                    "route_count": 1,
                },
            ).status_code,
            200,
        )

        # Confirm admin analytics shows the transit search and logs the event.
        admin_analytics = self.get_admin_analytics()
        self.assertEqual(admin_analytics["transit_searches"], 1)
        self.assertEqual(admin_analytics["service_usage"]["transit"], 1)
        self.assertTrue(any(entry["event"] == "transit_route_searched" for entry in admin_analytics["event_log"]))

    def test_vehicle_marketplace_lifecycle_updates_user_state_and_admin_analytics(self):
        """Vehicle listing should support create, update, rent, return, and admin analytics."""
        # Create a new marketplace vehicle that can be updated and rented in later steps.
        create_response = self.client.post(
            "/vehicles",
            json={
                "listed_by_email": "owner@example.com",
                "target": "marketplace",
                "id": "feature-van-9001",
                "vehicle_type": "van",
                "make": "Ford",
                "model": "Transit",
                "year": 2024,
                "daily_rate": 72.5,
                "color": "Silver",
                "transmission": "Automatic",
                "seats": 2,
                "fuel_type": "Gasoline",
            },
        )

        # Confirm the vehicle was created and normalize the generated id for later requests.
        self.assertEqual(create_response.status_code, 200)
        created_vehicle = create_response.json()["vehicle"]
        vehicle_id = created_vehicle["id"]
        self.assertEqual(vehicle_id, "FEATURE-VAN-9001")
        self.assertEqual(create_response.json()["target"], "marketplace")

        # Simulate the frontend analytics event recorded when a user lists a vehicle.
        self.assertEqual(
            self.post_frontend_event(
                "vehicle_listed",
                {
                    "vehicle_type": "van",
                    "make": "Ford",
                    "model": "Transit",
                    "email": "owner@example.com",
                },
            ).status_code,
            200,
        )

        # The owner's marketplace listings should now contain the new vehicle.
        listings_response = self.client.get(
            "/vehicles/listings/user",
            params={"user_email": "owner@example.com"},
        )
        self.assertEqual(listings_response.status_code, 200)
        self.assertEqual(len(listings_response.json()["vehicles"]), 1)
        self.assertEqual(listings_response.json()["vehicles"][0]["id"], vehicle_id)

        # Update a few listing fields to prove editing works before the rental begins.
        update_response = self.client.patch(
            f"/vehicles/{vehicle_id}",
            json={
                "user_email": "owner@example.com",
                "vehicle_type": "van",
                "make": "Ford",
                "model": "Transit",
                "year": 2024,
                "daily_rate": 80,
                "color": "Graphite",
                "transmission": "Automatic",
                "seats": 3,
                "fuel_type": "Gasoline",
            },
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["vehicle"]["daily_rate"], 80.0)
        self.assertEqual(update_response.json()["vehicle"]["color"], "Graphite")
        self.assertEqual(update_response.json()["vehicle"]["seats"], 3)

        # Confirm the edited vehicle is visible in the public available-vehicles list.
        available_before_rent_response = self.client.get(
            "/vehicles/available",
            params={"vehicle_type": "van"},
        )
        self.assertEqual(available_before_rent_response.status_code, 200)
        self.assertEqual(len(available_before_rent_response.json()["vehicles"]), 1)
        self.assertEqual(available_before_rent_response.json()["vehicles"][0]["id"], vehicle_id)

        # Rent the vehicle as a different user and attach wallet payment details.
        rent_response = self.client.post(
            "/vehicles/rent",
            json={
                "user_email": "renter@example.com",
                "user_name": "Renter Example",
                "vehicle_id": vehicle_id,
                "payment_method": "wallet",
                "payment_details": {"wallet_id": "WALLET-RENTER"},
            },
        )
        self.assertEqual(rent_response.status_code, 200)
        rental = rent_response.json()["rental"]
        self.assertEqual(rental["rented_vehicle"]["id"], vehicle_id)
        self.assertEqual(rental["rented_vehicle"]["payment"]["status"], "authorized")
        self.assertEqual(rental["rented_vehicle"]["payment"]["method"], "wallet")
        self.assertEqual(rental["rented_vehicle"]["payment"]["authorized_amount"], 80.0)

        # Simulate the frontend analytics event that is sent when the rental starts.
        self.assertEqual(
            self.post_frontend_event(
                "vehicle_rented",
                {
                    "vehicle_type": "van",
                    "make": "Ford",
                    "model": "Transit",
                    "email": "renter@example.com",
                },
            ).status_code,
            200,
        )

        # While rented, the vehicle should disappear from the available inventory.
        available_while_rented_response = self.client.get(
            "/vehicles/available",
            params={"vehicle_type": "van"},
        )
        self.assertEqual(available_while_rented_response.status_code, 200)
        self.assertEqual(available_while_rented_response.json()["vehicles"], [])

        # The renter's personal vehicle dashboard should now show the active rental.
        user_vehicles_response = self.client.get(
            "/vehicles/user",
            params={"user_email": "renter@example.com"},
        )
        self.assertEqual(user_vehicles_response.status_code, 200)
        self.assertEqual(len(user_vehicles_response.json()["vehicles"]), 1)
        self.assertEqual(user_vehicles_response.json()["vehicles"][0]["vehicle_source"], "rented")

        # Return the vehicle and verify billing details are produced.
        return_response = self.client.post(
            "/vehicles/return",
            json={
                "user_email": "renter@example.com",
                "vehicle_id": vehicle_id,
            },
        )
        self.assertEqual(return_response.status_code, 200)
        returned_rental = return_response.json()["rental"]
        self.assertEqual(returned_rental["returned_vehicle"]["id"], vehicle_id)
        self.assertEqual(returned_rental["billing"]["amount_billed"], 80.0)
        self.assertEqual(returned_rental["billing"]["method"], "wallet")

        # Simulate the frontend analytics event that is sent once the renter returns the vehicle.
        self.assertEqual(
            self.post_frontend_event(
                "vehicle_returned",
                {
                    "vehicle_type": "van",
                    "make": "Ford",
                    "model": "Transit",
                    "email": "renter@example.com",
                },
            ).status_code,
            200,
        )

        # After return, the vehicle should be rentable again.
        available_after_return_response = self.client.get(
            "/vehicles/available",
            params={"vehicle_type": "van"},
        )
        self.assertEqual(available_after_return_response.status_code, 200)
        self.assertEqual(len(available_after_return_response.json()["vehicles"]), 1)
        self.assertEqual(available_after_return_response.json()["vehicles"][0]["id"], vehicle_id)

        # The admin dashboard should now show the full list-create-rent-return lifecycle.
        admin_analytics = self.get_admin_analytics()
        self.assertEqual(admin_analytics["vehicle_listings"], 1)
        self.assertEqual(admin_analytics["vehicle_rentals"], 1)
        self.assertEqual(admin_analytics["vehicle_returns"], 1)
        self.assertEqual(admin_analytics["service_usage"]["vehicle_rental"], 1)
        self.assertTrue(any(entry["event"] == "vehicle_listed" for entry in admin_analytics["event_log"]))
        self.assertTrue(any(entry["event"] == "vehicle_rented" for entry in admin_analytics["event_log"]))
        self.assertTrue(any(entry["event"] == "vehicle_returned" for entry in admin_analytics["event_log"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
