from __future__ import annotations

import time
from typing import Any

try:
    from .payment_system import PaymentProcessor
except ImportError:
    from payment_system import PaymentProcessor  # pragma: no cover


PAYMENT_CURRENCY = 'CAD'


_vehicle_catalog: list[dict[str, Any]] = [
    {
        'id': 'VEHICLE-1001',
        'vehicle_type': 'car',
        'make': 'Toyota',
        'model': 'Corolla',
        'year': 2023,
        'color': 'Blue',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Gasoline',
        'daily_rate': 58.0,
        'listed_by_email': 'system@cityflow.com',
    },
    {
        'id': 'VEHICLE-1002',
        'vehicle_type': 'car',
        'make': 'Honda',
        'model': 'Civic',
        'year': 2022,
        'color': 'Black',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Gasoline',
        'daily_rate': 61.5,
        'listed_by_email': 'system@cityflow.com',
    },
    {
        'id': 'VEHICLE-1003',
        'vehicle_type': 'car',
        'make': 'Hyundai',
        'model': 'Elantra',
        'year': 2024,
        'color': 'White',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Hybrid',
        'daily_rate': 66.0,
        'listed_by_email': 'system@cityflow.com',
    },
    {
        'id': 'VEHICLE-1004',
        'vehicle_type': 'car',
        'make': 'Mazda',
        'model': 'CX-5',
        'year': 2023,
        'color': 'Red',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Gasoline',
        'daily_rate': 79.0,
        'listed_by_email': 'system@cityflow.com',
    },
    {
        'id': 'VEHICLE-1005',
        'vehicle_type': 'car',
        'make': 'Tesla',
        'model': 'Model 3',
        'year': 2024,
        'color': 'Gray',
        'transmission': 'Automatic',
        'seats': 5,
        'fuel_type': 'Electric',
        'daily_rate': 98.0,
        'listed_by_email': 'system@cityflow.com',
    },
    {
        'id': 'VEHICLE-2001',
        'vehicle_type': 'moped',
        'make': 'Vespa',
        'model': 'Primavera 50',
        'year': 2023,
        'color': 'Mint',
        'transmission': 'Automatic',
        'seats': 2,
        'fuel_type': 'Gasoline',
        'daily_rate': 42.0,
        'helmet_included': True,
        'top_speed_kmh': 45,
        'listed_by_email': 'system@cityflow.com',
    },
    {
        'id': 'VEHICLE-3001',
        'vehicle_type': 'scooter',
        'make': 'NIU',
        'model': 'KQi3 Pro',
        'year': 2024,
        'color': 'Matte Black',
        'transmission': 'Single Speed',
        'seats': 1,
        'fuel_type': 'Electric',
        'daily_rate': 28.0,
        'range_km': 50,
        'top_speed_kmh': 32,
        'listed_by_email': 'system@cityflow.com',
    },
    {
        'id': 'VEHICLE-4001',
        'vehicle_type': 'ebike',
        'make': 'Rad Power',
        'model': 'RadCity 5 Plus',
        'year': 2024,
        'color': 'Silver',
        'transmission': '7-Speed',
        'seats': 1,
        'fuel_type': 'Electric',
        'daily_rate': 36.0,
        'range_km': 72,
        'top_speed_kmh': 32,
        'listed_by_email': 'system@cityflow.com',
    },
]

_rented_by_user: dict[str, list[str]] = {}
_vehicle_rentals_by_vehicle_id: dict[str, dict[str, Any]] = {}
_payment_processor = PaymentProcessor()


class VehicleInUseError(ValueError):
    pass


class VehicleRentalState:
    status = 'unknown'

    def complete(self, context: VehicleRentalContext) -> dict[str, Any]:
        raise ValueError('Only active vehicle rentals can be completed.')


class ActiveVehicleRentalState(VehicleRentalState):
    status = 'active'

    def complete(self, context: VehicleRentalContext) -> dict[str, Any]:
        payment = dict(context.record.get('payment') or {})
        vehicle = context.record['vehicle']
        billed_amount = float(payment.get('authorized_amount') or vehicle.get('daily_rate') or 0.0)

        context.record['returned_at'] = time.time()
        context.record['billing'] = {
            'amount_billed': round(billed_amount, 2),
            'currency': payment.get('currency', PAYMENT_CURRENCY),
            'method': payment.get('method'),
            'transaction_id': payment.get('transaction_id'),
        }
        context.transition_to(RETURNED_VEHICLE_RENTAL_STATE)
        return dict(context.record['billing'])


class ReturnedVehicleRentalState(VehicleRentalState):
    status = 'returned'


ACTIVE_VEHICLE_RENTAL_STATE = ActiveVehicleRentalState()
RETURNED_VEHICLE_RENTAL_STATE = ReturnedVehicleRentalState()

VEHICLE_RENTAL_STATE_BY_STATUS: dict[str, VehicleRentalState] = {
    ACTIVE_VEHICLE_RENTAL_STATE.status: ACTIVE_VEHICLE_RENTAL_STATE,
    RETURNED_VEHICLE_RENTAL_STATE.status: RETURNED_VEHICLE_RENTAL_STATE,
}


def _vehicle_rental_state_for_status(status: str) -> VehicleRentalState:
    state = VEHICLE_RENTAL_STATE_BY_STATUS.get(status)
    if not state:
        raise ValueError(f'Unsupported vehicle rental status: {status}')
    return state


class VehicleRentalContext:
    def __init__(self, record: dict[str, Any]):
        self.record = record
        self.state = _vehicle_rental_state_for_status(str(record['status']))

    def transition_to(self, state: VehicleRentalState) -> None:
        self.state = state
        self.record['status'] = state.status

    def complete(self) -> dict[str, Any]:
        return self.state.complete(self)


def _serialize_vehicle(vehicle: dict[str, Any]) -> dict[str, Any]:
    vehicle_copy = dict(vehicle)
    rental_record = _vehicle_rentals_by_vehicle_id.get(vehicle_copy['id'])
    if rental_record and rental_record.get('payment'):
        vehicle_copy['payment'] = dict(rental_record['payment'])
    return vehicle_copy


def _find_vehicle(vehicle_id: str) -> dict[str, Any] | None:
    for vehicle in _vehicle_catalog:
        if vehicle['id'] == vehicle_id:
            return vehicle
    return None


def _next_vehicle_id() -> str:
    existing_numbers: list[int] = []
    for vehicle in _vehicle_catalog:
        vehicle_id = str(vehicle.get('id', ''))
        if not vehicle_id.startswith('VEHICLE-'):
            continue
        suffix = vehicle_id.replace('VEHICLE-', '', 1)
        if suffix.isdigit():
            existing_numbers.append(int(suffix))

    next_number = (max(existing_numbers) + 1) if existing_numbers else 1001
    return f'VEHICLE-{next_number:04d}'


def _all_rented_vehicle_ids() -> set[str]:
    rented_ids: set[str] = set()
    for vehicle_ids in _rented_by_user.values():
        for vehicle_id in vehicle_ids:
            rented_ids.add(vehicle_id)
    return rented_ids


def _validate_vehicle_numeric_fields(vehicle: dict[str, Any]) -> None:
    if int(vehicle.get('year') or 0) <= 0:
        raise ValueError('Year must be a positive number.')
    if float(vehicle.get('daily_rate') or 0) <= 0:
        raise ValueError('Daily rate must be greater than 0.')
    if int(vehicle.get('seats') or 0) <= 0:
        raise ValueError('Seats must be greater than 0.')


def get_available_vehicles(vehicle_type: str | None = None) -> list[dict[str, Any]]:
    rented_ids = _all_rented_vehicle_ids()
    available = [vehicle for vehicle in _vehicle_catalog if vehicle['id'] not in rented_ids]

    if vehicle_type:
        normalized_type = vehicle_type.strip().lower()
        if normalized_type:
            available = [
                vehicle for vehicle in available
                if str(vehicle.get('vehicle_type', '')).lower() == normalized_type
            ]

    return [_serialize_vehicle(vehicle) for vehicle in available]


def add_marketplace_vehicle(vehicle_data: dict[str, Any]) -> dict[str, Any]:
    vehicle_type = str(vehicle_data.get('vehicle_type') or '').strip().lower()
    make = str(vehicle_data.get('make') or '').strip()
    model = str(vehicle_data.get('model') or '').strip()
    listed_by_email = str(vehicle_data.get('listed_by_email') or '').strip().lower()

    if not vehicle_type:
        raise ValueError('Vehicle type is required.')
    if not make:
        raise ValueError('Make is required.')
    if not model:
        raise ValueError('Model is required.')
    if not listed_by_email:
        raise ValueError('Listing owner email is required.')

    year = int(vehicle_data.get('year') or 0)
    daily_rate = float(vehicle_data.get('daily_rate') or 0)

    raw_vehicle_id = str(vehicle_data.get('id') or '').strip()
    vehicle_id = raw_vehicle_id.upper() if raw_vehicle_id else _next_vehicle_id()
    if _find_vehicle(vehicle_id):
        raise ValueError('A vehicle with this ID already exists.')

    created_vehicle: dict[str, Any] = {
        'id': vehicle_id,
        'vehicle_type': vehicle_type,
        'make': make,
        'model': model,
        'year': year,
        'daily_rate': round(daily_rate, 2),
        'color': vehicle_data.get('color') or 'Unspecified',
        'transmission': vehicle_data.get('transmission') or 'Automatic',
        'fuel_type': vehicle_data.get('fuel_type') or 'Unknown',
        'seats': int(vehicle_data.get('seats') or 1),
        'listed_by_email': listed_by_email,
    }

    _validate_vehicle_numeric_fields(created_vehicle)

    if vehicle_data.get('range_km') is not None:
        created_vehicle['range_km'] = int(vehicle_data['range_km'])
    if vehicle_data.get('top_speed_kmh') is not None:
        created_vehicle['top_speed_kmh'] = int(vehicle_data['top_speed_kmh'])
    if vehicle_data.get('helmet_included') is not None:
        created_vehicle['helmet_included'] = bool(vehicle_data['helmet_included'])

    _vehicle_catalog.append(created_vehicle)
    return _serialize_vehicle(created_vehicle)


def update_marketplace_vehicle(vehicle_id: str, updates: dict[str, Any], requester_email: str) -> dict[str, Any]:
    vehicle = _find_vehicle(vehicle_id)
    if not vehicle:
        raise ValueError('Selected vehicle was not found.')

    owner_email = str(vehicle.get('listed_by_email') or '').lower()
    if owner_email != requester_email.lower():
        raise PermissionError('You can only update vehicles from your own listings.')

    if vehicle_id in _all_rented_vehicle_ids():
        raise VehicleInUseError('This vehicle is currently rented and cannot be updated.')

    editable_fields = {
        'vehicle_type',
        'make',
        'model',
        'year',
        'daily_rate',
        'color',
        'transmission',
        'seats',
        'fuel_type',
        'range_km',
        'top_speed_kmh',
        'helmet_included',
    }

    normalized_updates = {
        key: value
        for key, value in updates.items()
        if key in editable_fields and value is not None
    }

    if not normalized_updates:
        raise ValueError('No valid update fields were provided.')

    string_fields = {'vehicle_type', 'make', 'model', 'color', 'transmission', 'fuel_type'}
    numeric_int_fields = {'year', 'seats', 'range_km', 'top_speed_kmh'}
    numeric_float_fields = {'daily_rate'}

    for field, value in normalized_updates.items():
        if field in string_fields:
            cast_value = str(value).strip()
            if field in {'vehicle_type', 'make', 'model'} and not cast_value:
                raise ValueError(f'{field.replace("_", " ").title()} is required.')
            if field == 'vehicle_type':
                cast_value = cast_value.lower()
            normalized_updates[field] = cast_value
        elif field in numeric_int_fields:
            normalized_updates[field] = int(value)
        elif field in numeric_float_fields:
            normalized_updates[field] = round(float(value), 2)
        elif field == 'helmet_included':
            normalized_updates[field] = bool(value)

    updated_vehicle = dict(vehicle)
    updated_vehicle.update(normalized_updates)
    _validate_vehicle_numeric_fields(updated_vehicle)

    vehicle.clear()
    vehicle.update(updated_vehicle)
    return _serialize_vehicle(vehicle)


def get_user_vehicles(user_email: str) -> list[dict[str, Any]]:
    vehicle_ids = _rented_by_user.get(user_email, [])
    vehicles: list[dict[str, Any]] = []

    for vehicle_id in vehicle_ids:
        vehicle = _find_vehicle(vehicle_id)
        if vehicle:
            vehicles.append(_serialize_vehicle(vehicle))

    return vehicles


def get_user_marketplace_listings(user_email: str) -> list[dict[str, Any]]:
    listings = [
        vehicle for vehicle in _vehicle_catalog
        if str(vehicle.get('listed_by_email', '')).lower() == user_email.lower()
    ]
    return [_serialize_vehicle(vehicle) for vehicle in listings]


def rent_vehicle(
    user_email: str,
    user_name: str,
    vehicle_id: str,
    payment_method: str = 'card',
    payment_details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    vehicle = _find_vehicle(vehicle_id)
    if not vehicle:
        raise ValueError('Selected vehicle was not found.')

    if vehicle_id in _all_rented_vehicle_ids():
        raise ValueError('This vehicle is already rented by another user.')

    user_vehicles = _rented_by_user.setdefault(user_email, [])
    if vehicle_id in user_vehicles:
        raise ValueError('This vehicle is already in your rentals.')

    payment_result = _payment_processor.authorize(
        amount=float(vehicle['daily_rate']),
        currency=PAYMENT_CURRENCY,
        payer_email=user_email,
        payment_method=payment_method,
        payment_details=payment_details,
    )
    if payment_result.get('status') != 'authorized':
        raise ValueError(payment_result.get('reason') or 'Payment authorization failed.')

    user_vehicles.append(vehicle_id)
    _vehicle_rentals_by_vehicle_id[vehicle_id] = {
        'vehicle_id': vehicle_id,
        'user_email': user_email,
        'user_name': user_name,
        'status': ACTIVE_VEHICLE_RENTAL_STATE.status,
        'rented_at': time.time(),
        'returned_at': None,
        'vehicle': dict(vehicle),
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
        'rented_vehicle': _serialize_vehicle(vehicle),
        'user_vehicles': get_user_vehicles(user_email),
    }


def return_rented_vehicle(user_email: str, vehicle_id: str) -> dict[str, Any]:
    vehicle = _find_vehicle(vehicle_id)
    if not vehicle:
        raise ValueError('Selected vehicle was not found.')

    user_vehicles = _rented_by_user.get(user_email, [])
    if vehicle_id not in user_vehicles:
        raise ValueError('This vehicle is not in your rentals.')

    user_vehicles.remove(vehicle_id)
    if not user_vehicles:
        _rented_by_user.pop(user_email, None)

    rental_record = _vehicle_rentals_by_vehicle_id.get(vehicle_id)
    if not rental_record:
        raise ValueError('Vehicle rental record was not found.')
    if rental_record['user_email'] != user_email:
        raise ValueError('This vehicle rental belongs to another user.')

    rental_context = VehicleRentalContext(rental_record)
    billing_summary = rental_context.complete()
    returned_vehicle = _serialize_vehicle(vehicle)

    _vehicle_rentals_by_vehicle_id.pop(vehicle_id, None)

    return {
        'returned_vehicle': returned_vehicle,
        'billing': billing_summary,
        'user_vehicles': get_user_vehicles(user_email),
    }
