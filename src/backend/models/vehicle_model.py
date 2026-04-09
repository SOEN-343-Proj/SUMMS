from __future__ import annotations

import re

from ..Sprint1Implementation.vehicle_rental import (
    VehicleInUseError,
    add_marketplace_vehicle,
    add_user_vehicle,
    get_available_vehicles,
    get_user_marketplace_listings,
    get_user_vehicles,
    remove_vehicle,
    rent_vehicle,
    return_rented_vehicle,
    update_vehicle,
    update_marketplace_vehicle,
)


def _normalize_vin(vin: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(vin)).upper()


__all__ = [
    "VehicleInUseError",
    "_normalize_vin",
    "add_marketplace_vehicle",
    "add_user_vehicle",
    "get_available_vehicles",
    "get_user_marketplace_listings",
    "get_user_vehicles",
    "remove_vehicle",
    "rent_vehicle",
    "return_rented_vehicle",
    "update_vehicle",
    "update_marketplace_vehicle",
]
