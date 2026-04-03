from __future__ import annotations

from unittest.mock import patch

from src.backend.Sprint1Implementation import bixi_rental

from tests.test_support import BackendTestCase


class BixiRentalUnitTests(BackendTestCase):
    def test_reserve_and_pay_transition_rental_to_active_with_payment_metadata(self) -> None:
        with patch.object(bixi_rental, "_load_station_feed", return_value=self.sample_bixi_stations()):
            reserved = bixi_rental.reserve_bixi_bike(
                user_email="john.doe@student.com",
                user_name="John Doe",
                station_id="station-a",
            )
            paid = bixi_rental.pay_for_bixi_rental(
                rental_id=reserved["id"],
                user_email="john.doe@student.com",
                payment_method="transit_pass",
            )

        self.assertEqual(reserved["status"], "reserved")
        self.assertEqual(paid["status"], "active")
        self.assertEqual(paid["payment"]["status"], "authorized")
        self.assertEqual(paid["payment"]["method"], "transit_pass")
        self.assertTrue(paid["payment"]["transaction_id"].startswith("PASS-"))

    def test_return_bixi_rental_computes_final_cost_and_moves_it_to_history(self) -> None:
        with patch.object(bixi_rental, "_load_station_feed", return_value=self.sample_bixi_stations()):
            reserved = bixi_rental.reserve_bixi_bike(
                user_email="john.doe@student.com",
                user_name="John Doe",
                station_id="station-a",
            )
            rental_id = reserved["id"]
            bixi_rental.pay_for_bixi_rental(
                rental_id=rental_id,
                user_email="john.doe@student.com",
                payment_method="card",
            )
            bixi_rental._bixi_rentals[rental_id]["started_at"] = 1000.0

            with patch.object(bixi_rental.time, "time", return_value=1121.0):
                returned = bixi_rental.return_bixi_rental(
                    rental_id=rental_id,
                    user_email="john.doe@student.com",
                    return_station_id="station-b",
                )

        self.assertEqual(returned["status"], "returned")
        self.assertEqual(returned["payment"]["status"], "captured")
        self.assertEqual(returned["payment"]["final_cost"], 3.29)

        state = bixi_rental.get_user_bixi_rental_state("john.doe@student.com")
        self.assertIsNone(state["open_rental"])
        self.assertEqual(len(state["history"]), 1)
        self.assertEqual(state["history"][0]["id"], rental_id)

    def test_station_overlay_reflects_active_and_returned_rentals(self) -> None:
        station_a, station_b = self.sample_bixi_stations()
        bixi_rental._bixi_rentals.update(
            {
                "active-rental": {
                    "id": "active-rental",
                    "status": "active",
                    "user_email": "john.doe@student.com",
                    "user_name": "John Doe",
                    "pickup_station": bixi_rental._station_summary(station_a),
                    "return_station": None,
                    "reserved_at": 1000.0,
                    "started_at": 1010.0,
                    "returned_at": None,
                },
                "returned-rental": {
                    "id": "returned-rental",
                    "status": "returned",
                    "user_email": "jane.smith@student.com",
                    "user_name": "Jane Smith",
                    "pickup_station": bixi_rental._station_summary(station_a),
                    "return_station": bixi_rental._station_summary(station_b),
                    "reserved_at": 900.0,
                    "started_at": 910.0,
                    "returned_at": 980.0,
                },
            }
        )

        overlay_a = bixi_rental._apply_station_overlay(station_a)
        overlay_b = bixi_rental._apply_station_overlay(station_b)

        self.assertEqual(overlay_a["bikes_available"], 3)
        self.assertEqual(overlay_a["docks_available"], 12)
        self.assertEqual(overlay_b["bikes_available"], 3)
        self.assertEqual(overlay_b["docks_available"], 2)
