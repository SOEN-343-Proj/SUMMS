from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from ..controllers import vehicle_controller
from ..models.vehicle_model import VehicleInUseError


class VehicleCreateRequest(BaseModel):
    listed_by_email: EmailStr
    target: str = "marketplace"
    id: str | None = None
    vehicle_type: str
    make: str
    model: str
    year: int
    daily_rate: float | None = None
    color: str | None = None
    transmission: str | None = None
    seats: int | None = None
    fuel_type: str | None = None
    range_km: int | None = None
    top_speed_kmh: int | None = None
    helmet_included: bool | None = None


class VehicleUpdateRequest(BaseModel):
    user_email: EmailStr
    vehicle_type: str | None = None
    make: str | None = None
    model: str | None = None
    year: int | None = None
    daily_rate: float | None = None
    color: str | None = None
    transmission: str | None = None
    seats: int | None = None
    fuel_type: str | None = None
    range_km: int | None = None
    top_speed_kmh: int | None = None
    helmet_included: bool | None = None


class VehicleRentRequest(BaseModel):
    user_email: EmailStr
    user_name: str
    vehicle_id: str
    payment_method: str = "card"
    payment_details: dict[str, Any] | None = None


class VehicleReturnRequest(BaseModel):
    user_email: EmailStr
    vehicle_id: str


router = APIRouter()


@router.post("/vehicles")
def create_marketplace_vehicle(payload: VehicleCreateRequest):
    try:
        return vehicle_controller.create_vehicle(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to add vehicle: {str(exc)}") from exc


@router.patch("/vehicles/{vehicle_id}")
def update_vehicle_listing(vehicle_id: str, payload: VehicleUpdateRequest):
    try:
        payload_data = payload.model_dump()
        requester_email = str(payload_data.pop("user_email"))
        return vehicle_controller.update_vehicle_listing(
            vehicle_id=vehicle_id,
            updates=payload_data,
            requester_email=requester_email,
        )
    except VehicleInUseError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to update vehicle: {str(exc)}") from exc


@router.delete("/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: str, user_email: EmailStr):
    try:
        return vehicle_controller.delete_vehicle(
            vehicle_id=vehicle_id,
            requester_email=str(user_email),
        )
    except VehicleInUseError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to remove vehicle: {str(exc)}") from exc


@router.get("/vehicles/available")
def list_available_vehicles(vehicle_type: str | None = None):
    return vehicle_controller.list_available_vehicles(vehicle_type=vehicle_type)


@router.get("/vehicles/user")
def list_user_vehicles(user_email: EmailStr):
    return vehicle_controller.list_user_vehicles(str(user_email))


@router.get("/vehicles/listings/user")
def list_user_marketplace_listings(user_email: EmailStr):
    return vehicle_controller.list_user_marketplace_listings(str(user_email))


@router.post("/vehicles/rent")
def create_vehicle_rental(payload: VehicleRentRequest):
    try:
        return vehicle_controller.create_vehicle_rental(
            user_email=str(payload.user_email),
            user_name=payload.user_name,
            vehicle_id=payload.vehicle_id,
            payment_method=payload.payment_method,
            payment_details=payload.payment_details,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to rent vehicle: {str(exc)}") from exc


@router.post("/vehicles/return")
def complete_vehicle_return(payload: VehicleReturnRequest):
    try:
        return vehicle_controller.complete_vehicle_return(
            user_email=str(payload.user_email),
            vehicle_id=payload.vehicle_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to return vehicle: {str(exc)}") from exc
