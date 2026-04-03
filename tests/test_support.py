from __future__ import annotations

import os
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.backend import analytics_service, credentials, observer
from src.backend.Sprint1Implementation import bixi_rental, vehicle_rental
from src.backend.models import location_model, parking_model


ANALYTICS_EVENTS = [
    "request_received",
    "admin_login",
    "user_login",
    "parking_search",
    "uber_bixi_search",
    "feature_opened",
    "bixi_reserved",
    "bixi_payment",
    "bixi_returned",
    "vehicle_rented",
    "vehicle_returned",
    "vehicle_listed",
    "transit_route_searched",
]


class BackendTestCase(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self._original_cwd = os.getcwd()
        self._tmpdir = tempfile.TemporaryDirectory()
        os.chdir(self._tmpdir.name)

        self._user_credentials = deepcopy(credentials.user_credentials)
        self._admin_credentials = deepcopy(credentials.admin_credentials)
        self._vehicle_catalog = deepcopy(vehicle_rental._vehicle_catalog)
        self._rented_by_user = deepcopy(vehicle_rental._rented_by_user)
        self._vehicle_rentals = deepcopy(vehicle_rental._vehicle_rentals_by_vehicle_id)
        self._bixi_station_cache = deepcopy(bixi_rental._station_cache)
        self._bixi_rentals = deepcopy(bixi_rental._bixi_rentals)
        self._location_search_cache = deepcopy(location_model.SEARCH_CACHE)
        self._location_geocode_cache = deepcopy(location_model.GEOCODE_CACHE)
        self._location_reverse_cache = deepcopy(location_model.REVERSE_CACHE)
        self._parking_nearby_cache = deepcopy(parking_model.NEARBY_CACHE)
        self._parking_geocode_cache = deepcopy(parking_model.GEOCODE_CACHE)

        analytics_service.ANALYTICS_FILE = os.path.join(self._tmpdir.name, "analytics_data.json")
        observer.event_manager._observers = {}
        analytics_service.analytics = analytics_service.AnalyticsService()
        for event_name in ANALYTICS_EVENTS:
            observer.event_manager.subscribe(event_name, analytics_service.analytics)

    def tearDown(self) -> None:
        credentials.user_credentials[:] = self._user_credentials
        credentials.admin_credentials[:] = self._admin_credentials
        vehicle_rental._vehicle_catalog[:] = self._vehicle_catalog
        vehicle_rental._rented_by_user.clear()
        vehicle_rental._rented_by_user.update(self._rented_by_user)
        vehicle_rental._vehicle_rentals_by_vehicle_id.clear()
        vehicle_rental._vehicle_rentals_by_vehicle_id.update(self._vehicle_rentals)
        bixi_rental._station_cache.clear()
        bixi_rental._station_cache.update(self._bixi_station_cache)
        bixi_rental._bixi_rentals.clear()
        bixi_rental._bixi_rentals.update(self._bixi_rentals)
        location_model.SEARCH_CACHE.clear()
        location_model.SEARCH_CACHE.update(self._location_search_cache)
        location_model.GEOCODE_CACHE.clear()
        location_model.GEOCODE_CACHE.update(self._location_geocode_cache)
        location_model.REVERSE_CACHE.clear()
        location_model.REVERSE_CACHE.update(self._location_reverse_cache)
        parking_model.NEARBY_CACHE.clear()
        parking_model.NEARBY_CACHE.update(self._parking_nearby_cache)
        parking_model.GEOCODE_CACHE.clear()
        parking_model.GEOCODE_CACHE.update(self._parking_geocode_cache)

        observer.event_manager._observers = {}
        os.chdir(self._original_cwd)
        self._tmpdir.cleanup()
        super().tearDown()

    @staticmethod
    def sample_bixi_stations() -> list[dict[str, object]]:
        return [
            {
                "id": "station-a",
                "name": "Station A",
                "address": "100 Main St",
                "lat": 45.5017,
                "lng": -73.5673,
                "capacity": 15,
                "is_installed": True,
                "is_renting": True,
                "is_returning": True,
                "bikes_available": 5,
                "docks_available": 10,
            },
            {
                "id": "station-b",
                "name": "Station B",
                "address": "200 Main St",
                "lat": 45.5030,
                "lng": -73.5650,
                "capacity": 10,
                "is_installed": True,
                "is_renting": True,
                "is_returning": True,
                "bikes_available": 2,
                "docks_available": 3,
            },
        ]
