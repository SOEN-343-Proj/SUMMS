from __future__ import annotations

from fastapi import HTTPException

from ..models import vehicle_model


def create_vehicle(payload: dict):
    target = str(payload.pop("target", "marketplace")).strip().lower()

    if target == "marketplace":
        vehicle = vehicle_model.add_marketplace_vehicle(payload)
        return {"success": True, "vehicle": vehicle, "target": target}
    if target == "my_vehicles":
        vehicle = vehicle_model.add_user_vehicle(payload)
        return {"success": True, "vehicle": vehicle, "target": target}

    raise HTTPException(status_code=400, detail="Vehicle target must be marketplace or my_vehicles.")


def create_marketplace_vehicle(payload: dict):
    vehicle = vehicle_model.add_marketplace_vehicle(payload)
    return {"success": True, "vehicle": vehicle}


def update_vehicle_listing(vehicle_id: str, updates: dict, requester_email: str):
    vehicle = vehicle_model.update_vehicle(
        vehicle_id=vehicle_id,
        updates=updates,
        requester_email=requester_email,
    )
    return {"success": True, "vehicle": vehicle}


def delete_vehicle(vehicle_id: str, requester_email: str):
    vehicle = vehicle_model.remove_vehicle(
        vehicle_id=vehicle_id,
        requester_email=requester_email,
    )
    return {"success": True, "vehicle": vehicle}


def list_available_vehicles(vehicle_type: str | None = None):
    return {"vehicles": vehicle_model.get_available_vehicles(vehicle_type=vehicle_type)}


def list_user_vehicles(user_email: str):
    return {"vehicles": vehicle_model.get_user_vehicles(user_email)}


def list_user_marketplace_listings(user_email: str):
    return {"vehicles": vehicle_model.get_user_marketplace_listings(user_email)}


def create_vehicle_rental(
    user_email: str,
    user_name: str,
    vehicle_id: str,
    payment_method: str = "card",
    payment_details: dict | None = None,
):
    rental = vehicle_model.rent_vehicle(
        user_email=user_email,
        user_name=user_name,
        vehicle_id=vehicle_id,
        payment_method=payment_method,
        payment_details=payment_details,
    )
    return {"success": True, "rental": rental}


def complete_vehicle_return(user_email: str, vehicle_id: str):
    rental = vehicle_model.return_rented_vehicle(
        user_email=user_email,
        vehicle_id=vehicle_id,
    )
    return {"success": True, "rental": rental}
