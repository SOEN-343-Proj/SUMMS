from __future__ import annotations

import time
from typing import Any

try:
    from .payment_system import PaymentProcessor
except ImportError:
    from payment_system import PaymentProcessor  # pragma: no cover


PAYMENT_CURRENCY = 'CAD'


_car_catalog: list[dict[str, Any]] = [
    {
        'id': 'CAR-1001',
        'make': 'Toyota',
        'model': 'Corolla',
        'year': 2023,
        'color': 'Blue',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Gasoline',
        'daily_rate': 58.0,
    },
    {
        'id': 'CAR-1002',
        'make': 'Honda',
        'model': 'Civic',
        'year': 2022,
        'color': 'Black',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Gasoline',
        'daily_rate': 61.5,
    },
    {
        'id': 'CAR-1003',
        'make': 'Hyundai',
        'model': 'Elantra',
        'year': 2024,
        'color': 'White',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Hybrid',
        'daily_rate': 66.0,
    },
    {
        'id': 'CAR-1004',
        'make': 'Mazda',
        'model': 'CX-5',
        'year': 2023,
        'color': 'Red',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Gasoline',
        'daily_rate': 79.0,
    },
    {
        'id': 'CAR-1005',
        'make': 'Tesla',
        'model': 'Model 3',
        'year': 2024,
        'color': 'Gray',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Electric',
        'daily_rate': 98.0,
    },
]

_rented_by_user: dict[str, list[str]] = {}
_car_rentals_by_car_id: dict[str, dict[str, Any]] = {}
_payment_processor = PaymentProcessor()


class CarRentalState:
    status = 'unknown'

    def complete(self, context: CarRentalContext) -> dict[str, Any]:
        raise ValueError('Only active car rentals can be completed.')


class ActiveCarRentalState(CarRentalState):
    status = 'active'

    def complete(self, context: CarRentalContext) -> dict[str, Any]:
        payment = dict(context.record.get('payment') or {})
        car = context.record['car']
        billed_amount = float(payment.get('authorized_amount') or car.get('daily_rate') or 0.0)

        context.record['returned_at'] = time.time()
        context.record['billing'] = {
            'amount_billed': round(billed_amount, 2),
            'currency': payment.get('currency', PAYMENT_CURRENCY),
            'method': payment.get('method'),
            'transaction_id': payment.get('transaction_id'),
        }
        context.transition_to(RETURNED_CAR_RENTAL_STATE)
        return dict(context.record['billing'])


class ReturnedCarRentalState(CarRentalState):
    status = 'returned'


ACTIVE_CAR_RENTAL_STATE = ActiveCarRentalState()
RETURNED_CAR_RENTAL_STATE = ReturnedCarRentalState()

CAR_RENTAL_STATE_BY_STATUS: dict[str, CarRentalState] = {
    ACTIVE_CAR_RENTAL_STATE.status: ACTIVE_CAR_RENTAL_STATE,
    RETURNED_CAR_RENTAL_STATE.status: RETURNED_CAR_RENTAL_STATE,
}


def _car_rental_state_for_status(status: str) -> CarRentalState:
    state = CAR_RENTAL_STATE_BY_STATUS.get(status)
    if not state:
        raise ValueError(f'Unsupported car rental status: {status}')
    return state


class CarRentalContext:
    def __init__(self, record: dict[str, Any]):
        self.record = record
        self.state = _car_rental_state_for_status(str(record['status']))

    def transition_to(self, state: CarRentalState) -> None:
        self.state = state
        self.record['status'] = state.status

    def complete(self) -> dict[str, Any]:
        return self.state.complete(self)


def _serialize_car(car: dict[str, Any]) -> dict[str, Any]:
    car_copy = dict(car)
    rental_record = _car_rentals_by_car_id.get(car_copy['id'])
    if rental_record and rental_record.get('payment'):
        car_copy['payment'] = dict(rental_record['payment'])
    return car_copy


def _find_car(car_id: str) -> dict[str, Any] | None:
    for car in _car_catalog:
        if car['id'] == car_id:
            return car
    return None


def _all_rented_car_ids() -> set[str]:
    rented_ids: set[str] = set()
    for car_ids in _rented_by_user.values():
        for car_id in car_ids:
            rented_ids.add(car_id)
    return rented_ids


def get_available_cars() -> list[dict[str, Any]]:
    rented_ids = _all_rented_car_ids()
    available = [car for car in _car_catalog if car['id'] not in rented_ids]
    return [_serialize_car(car) for car in available]


def get_user_cars(user_email: str) -> list[dict[str, Any]]:
    car_ids = _rented_by_user.get(user_email, [])
    cars: list[dict[str, Any]] = []

    for car_id in car_ids:
        car = _find_car(car_id)
        if car:
            cars.append(_serialize_car(car))

    return cars


def rent_car(
    user_email: str,
    user_name: str,
    car_id: str,
    payment_method: str = 'card',
    payment_details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    car = _find_car(car_id)
    if not car:
        raise ValueError('Selected car was not found.')

    if car_id in _all_rented_car_ids():
        raise ValueError('This car is already rented by another user.')

    user_cars = _rented_by_user.setdefault(user_email, [])
    if car_id in user_cars:
        raise ValueError('This car is already in your rentals.')

    payment_result = _payment_processor.authorize(
        amount=float(car['daily_rate']),
        currency=PAYMENT_CURRENCY,
        payer_email=user_email,
        payment_method=payment_method,
        payment_details=payment_details,
    )
    if payment_result.get('status') != 'authorized':
        raise ValueError(payment_result.get('reason') or 'Payment authorization failed.')

    user_cars.append(car_id)
    _car_rentals_by_car_id[car_id] = {
        'car_id': car_id,
        'user_email': user_email,
        'user_name': user_name,
        'status': ACTIVE_CAR_RENTAL_STATE.status,
        'rented_at': time.time(),
        'returned_at': None,
        'car': dict(car),
        'billing': None,
        'payment': {
        'status': payment_result['status'],
        'method': payment_result['method'],
        'provider': payment_result['provider'],
        'transaction_id': payment_result['transaction_id'],
        'authorized_amount': payment_result['authorized_amount'],
        'currency': payment_result['currency'],
        'receipt': payment_result.get('receipt') or {},
        },
    }

    return {
        'user_email': user_email,
        'user_name': user_name,
        'rented_car': _serialize_car(car),
        'user_cars': get_user_cars(user_email),
    }


def return_rented_car(user_email: str, car_id: str) -> dict[str, Any]:
    car = _find_car(car_id)
    if not car:
        raise ValueError('Selected car was not found.')

    user_cars = _rented_by_user.get(user_email, [])
    if car_id not in user_cars:
        raise ValueError('This car is not in your rentals.')

    user_cars.remove(car_id)
    if not user_cars:
        _rented_by_user.pop(user_email, None)

    rental_record = _car_rentals_by_car_id.get(car_id)
    if not rental_record:
        raise ValueError('Car rental record was not found.')
    if rental_record['user_email'] != user_email:
        raise ValueError('This car rental belongs to another user.')

    rental_context = CarRentalContext(rental_record)
    billing_summary = rental_context.complete()
    returned_car = _serialize_car(car)

    _car_rentals_by_car_id.pop(car_id, None)

    return {
        'returned_car': returned_car,
        'billing': billing_summary,
        'user_cars': get_user_cars(user_email),
    }
