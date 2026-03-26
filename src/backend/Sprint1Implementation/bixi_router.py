from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Any

try:
    from .bixi_rental import (
        get_mock_payment_methods,
        get_bixi_analytics_summary,
        get_nearby_bixi_stations,
        get_user_bixi_rental_state,
        pay_for_bixi_rental,
        reserve_bixi_bike,
        return_bixi_rental,
    )
except ImportError:
    from .bixi_rental import (  # pragma: no cover
        get_mock_payment_methods,
        get_bixi_analytics_summary,
        get_nearby_bixi_stations,
        get_user_bixi_rental_state,
        pay_for_bixi_rental,
        reserve_bixi_bike,
        return_bixi_rental,
    )


class BixiReservationRequest(BaseModel):
    user_email: EmailStr
    user_name: str
    station_id: str


class BixiUserRequest(BaseModel):
    user_email: EmailStr
    payment_method: str = 'card'
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
        stations = get_nearby_bixi_stations(lat=lat, lng=lng, limit=limit, radius_km=radius)
        return {"stations": stations, "count": len(stations)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unable to load BIXI stations: {str(e)}")


@router.get("/bixi/rentals/state")
def get_bixi_rental_state(user_email: EmailStr, history_limit: int = 5):
    try:
        return get_user_bixi_rental_state(str(user_email), history_limit=history_limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to load BIXI rental state: {str(e)}")


@router.post("/bixi/rentals/reserve")
def create_bixi_reservation(payload: BixiReservationRequest):
    try:
        rental = reserve_bixi_bike(
            user_email=str(payload.user_email),
            user_name=payload.user_name,
            station_id=payload.station_id,
        )
        return {"success": True, "rental": rental}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to reserve BIXI bike: {str(e)}")


@router.post("/bixi/rentals/{rental_id}/pay")
def pay_bixi_reservation(rental_id: str, payload: BixiUserRequest):
    try:
        rental = pay_for_bixi_rental(
            rental_id=rental_id,
            user_email=str(payload.user_email),
            payment_method=payload.payment_method,
            payment_details=payload.payment_details,
        )
        return {"success": True, "rental": rental}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to activate BIXI rental: {str(e)}")


@router.get('/bixi/payments/methods')
def list_mock_methods():
    return {'methods': get_mock_payment_methods()}


@router.post("/bixi/rentals/{rental_id}/return")
def complete_bixi_return(rental_id: str, payload: BixiReturnRequest):
    try:
        rental = return_bixi_rental(
            rental_id=rental_id,
            user_email=str(payload.user_email),
            return_station_id=payload.return_station_id,
        )
        return {"success": True, "rental": rental}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to return BIXI bike: {str(e)}")


@router.get("/bixi/analytics/summary")
def get_bixi_summary():
    try:
        return get_bixi_analytics_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to load BIXI analytics: {str(e)}")
