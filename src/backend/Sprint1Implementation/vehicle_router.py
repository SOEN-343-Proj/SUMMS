from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Any

try:
    from .vehicle_rental import (
        VehicleInUseError,
        add_marketplace_vehicle,
        get_available_vehicles,
        get_user_marketplace_listings,
        get_user_vehicles,
        rent_vehicle,
        update_marketplace_vehicle,
        return_rented_vehicle,
    )
except ImportError:
    from vehicle_rental import (  # pragma: no cover
        VehicleInUseError,
        add_marketplace_vehicle,
        get_available_vehicles,
        get_user_marketplace_listings,
        get_user_vehicles,
        rent_vehicle,
        update_marketplace_vehicle,
        return_rented_vehicle,
    )


class VehicleCreateRequest(BaseModel):
    listed_by_email: EmailStr
    id: str | None = None
    vehicle_type: str
    make: str
    model: str
    year: int
    daily_rate: float
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
    payment_method: str = 'card'
    payment_details: dict[str, Any] | None = None


class VehicleReturnRequest(BaseModel):
    user_email: EmailStr
    vehicle_id: str


router = APIRouter()


@router.post('/vehicles')
def create_marketplace_vehicle(payload: VehicleCreateRequest):
    try:
        vehicle = add_marketplace_vehicle(payload.model_dump())
        return {'success': True, 'vehicle': vehicle}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Unable to add vehicle: {str(e)}')


@router.patch('/vehicles/{vehicle_id}')
def update_vehicle_listing(vehicle_id: str, payload: VehicleUpdateRequest):
    try:
        payload_data = payload.model_dump()
        requester_email = str(payload_data.pop('user_email'))
        vehicle = update_marketplace_vehicle(
            vehicle_id=vehicle_id,
            updates=payload_data,
            requester_email=requester_email,
        )
        return {'success': True, 'vehicle': vehicle}
    except VehicleInUseError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Unable to update vehicle: {str(e)}')


@router.get('/vehicles/available')
def list_available_vehicles(vehicle_type: str | None = None):
    return {'vehicles': get_available_vehicles(vehicle_type=vehicle_type)}


@router.get('/vehicles/user')
def list_user_vehicles(user_email: EmailStr):
    return {'vehicles': get_user_vehicles(str(user_email))}


@router.get('/vehicles/listings/user')
def list_user_marketplace_listings(user_email: EmailStr):
    return {'vehicles': get_user_marketplace_listings(str(user_email))}


@router.post('/vehicles/rent')
def create_vehicle_rental(payload: VehicleRentRequest):
    try:
        rental = rent_vehicle(
            user_email=str(payload.user_email),
            user_name=payload.user_name,
            vehicle_id=payload.vehicle_id,
            payment_method=payload.payment_method,
            payment_details=payload.payment_details,
        )
        return {'success': True, 'rental': rental}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Unable to rent vehicle: {str(e)}')


@router.post('/vehicles/return')
def complete_vehicle_return(payload: VehicleReturnRequest):
    try:
        rental = return_rented_vehicle(
            user_email=str(payload.user_email),
            vehicle_id=payload.vehicle_id,
        )
        return {'success': True, 'rental': rental}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Unable to return vehicle: {str(e)}')
