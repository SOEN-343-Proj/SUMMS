from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Any

try:
    from .car_rental import get_available_cars, get_user_cars, rent_car, return_rented_car
except ImportError:
    from car_rental import get_available_cars, get_user_cars, rent_car, return_rented_car  # pragma: no cover


class CarRentRequest(BaseModel):
    user_email: EmailStr
    user_name: str
    car_id: str
    payment_method: str = 'card'
    payment_details: dict[str, Any] | None = None


class CarReturnRequest(BaseModel):
    user_email: EmailStr
    car_id: str


router = APIRouter()


@router.get('/cars/available')
def list_available_cars():
    return {'cars': get_available_cars()}


@router.get('/cars/user')
def list_user_cars(user_email: EmailStr):
    return {'cars': get_user_cars(str(user_email))}


@router.post('/cars/rent')
def create_car_rental(payload: CarRentRequest):
    try:
        rental = rent_car(
            user_email=str(payload.user_email),
            user_name=payload.user_name,
            car_id=payload.car_id,
            payment_method=payload.payment_method,
            payment_details=payload.payment_details,
        )
        return {'success': True, 'rental': rental}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Unable to rent car: {str(e)}')


@router.post('/cars/return')
def complete_car_return(payload: CarReturnRequest):
    try:
        rental = return_rented_car(
            user_email=str(payload.user_email),
            car_id=payload.car_id,
        )
        return {'success': True, 'rental': rental}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Unable to return car: {str(e)}')
