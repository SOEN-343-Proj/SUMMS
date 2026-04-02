from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from ..controllers import bixi_controller


class BixiReservationRequest(BaseModel):
    user_email: EmailStr
    user_name: str
    station_id: str


class BixiUserRequest(BaseModel):
    user_email: EmailStr
    payment_method: str = "card"
    payment_details: dict[str, Any] | None = None


class BixiReturnRequest(BaseModel):
    user_email: EmailStr
    return_station_id: str


router = APIRouter()


@router.get("/bixi/stations/nearby")
def list_nearby_bixi_stations(
    lat: float,
    lng: float,
    limit: int = 12,
    radius: float = 3,
):
    try:
        return bixi_controller.list_nearby_bixi_stations(lat=lat, lng=lng, limit=limit, radius=radius)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to load BIXI stations: {str(exc)}") from exc


@router.get("/bixi/rentals/state")
def get_bixi_rental_state(user_email: EmailStr, history_limit: int = 5):
    try:
        return bixi_controller.get_bixi_rental_state(str(user_email), history_limit=history_limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load BIXI rental state: {str(exc)}") from exc


@router.post("/bixi/rentals/reserve")
def create_bixi_reservation(payload: BixiReservationRequest):
    try:
        return bixi_controller.create_bixi_reservation(
            user_email=str(payload.user_email),
            user_name=payload.user_name,
            station_id=payload.station_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to reserve BIXI bike: {str(exc)}") from exc


@router.post("/bixi/rentals/{rental_id}/pay")
def pay_bixi_reservation(rental_id: str, payload: BixiUserRequest):
    try:
        return bixi_controller.pay_bixi_reservation(
            rental_id=rental_id,
            user_email=str(payload.user_email),
            payment_method=payload.payment_method,
            payment_details=payload.payment_details,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to activate BIXI rental: {str(exc)}") from exc


@router.get("/bixi/payments/methods")
def list_mock_methods():
    return bixi_controller.list_payment_methods()


@router.post("/bixi/rentals/{rental_id}/return")
def complete_bixi_return(rental_id: str, payload: BixiReturnRequest):
    try:
        return bixi_controller.complete_bixi_return(
            rental_id=rental_id,
            user_email=str(payload.user_email),
            return_station_id=payload.return_station_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to return BIXI bike: {str(exc)}") from exc


@router.get("/bixi/analytics/summary")
def get_bixi_summary():
    try:
        return bixi_controller.get_bixi_summary()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load BIXI analytics: {str(exc)}") from exc
