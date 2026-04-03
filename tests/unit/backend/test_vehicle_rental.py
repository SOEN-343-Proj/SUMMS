from __future__ import annotations

from src.backend.Sprint1Implementation import vehicle_rental

from tests.test_support import BackendTestCase


class VehicleRentalUnitTests(BackendTestCase):
    def test_build_vehicle_record_for_personal_vehicle_sets_personal_source(self) -> None:
        record = vehicle_rental._build_vehicle_record(
            {
                "listed_by_email": "owner@cityflow.com",
                "vehicle_type": "Scooter",
                "make": "NIU",
                "model": "KQi Air",
                "year": 2024,
                "seats": 1,
            },
            vehicle_source="personal",
        )

        self.assertEqual(record["vehicle_source"], "personal")
        self.assertEqual(record["vehicle_type"], "scooter")
        self.assertEqual(record["daily_rate"], 0.0)

    def test_rent_vehicle_tracks_active_rental_and_removes_it_from_available_inventory(self) -> None:
        result = vehicle_rental.rent_vehicle(
            user_email="john.doe@student.com",
            user_name="John Doe",
            vehicle_id="VEHICLE-1001",
            payment_method="card",
        )

        self.assertEqual(result["rented_vehicle"]["id"], "VEHICLE-1001")
        self.assertIn("VEHICLE-1001", vehicle_rental._rented_by_user["john.doe@student.com"])
        self.assertIn("payment", vehicle_rental._vehicle_rentals_by_vehicle_id["VEHICLE-1001"])

        available_ids = {vehicle["id"] for vehicle in vehicle_rental.get_available_vehicles()}
        self.assertNotIn("VEHICLE-1001", available_ids)

    def test_return_vehicle_bills_user_and_clears_rental_state(self) -> None:
        vehicle_rental.rent_vehicle(
            user_email="john.doe@student.com",
            user_name="John Doe",
            vehicle_id="VEHICLE-1002",
            payment_method="wallet",
        )

        result = vehicle_rental.return_rented_vehicle(
            user_email="john.doe@student.com",
            vehicle_id="VEHICLE-1002",
        )

        self.assertEqual(result["returned_vehicle"]["id"], "VEHICLE-1002")
        self.assertEqual(result["billing"]["amount_billed"], 61.5)
        self.assertEqual(result["billing"]["currency"], "CAD")
        self.assertNotIn("VEHICLE-1002", vehicle_rental._vehicle_rentals_by_vehicle_id)
        self.assertNotIn("john.doe@student.com", vehicle_rental._rented_by_user)

    def test_update_vehicle_requires_owner_permissions(self) -> None:
        with self.assertRaisesRegex(PermissionError, "You can only update vehicles you own."):
            vehicle_rental.update_vehicle(
                vehicle_id="VEHICLE-1003",
                updates={"color": "Green"},
                requester_email="someone-else@cityflow.com",
            )
