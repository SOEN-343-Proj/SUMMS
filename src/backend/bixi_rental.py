from __future__ import annotations

import json
import math
import time
from typing import Any
from urllib.request import Request, urlopen
from uuid import uuid4


GBFS_STATION_INFO_URL = 'https://gbfs.velobixi.com/gbfs/2-2/en/station_information.json'
GBFS_STATION_STATUS_URL = 'https://gbfs.velobixi.com/gbfs/2-2/en/station_status.json'
GBFS_CACHE_TTL_SECONDS = 60

PAYMENT_AUTHORIZATION_AMOUNT = 4.25
RENTAL_BASE_FEE = 2.75
RENTAL_PER_MINUTE_RATE = 0.18

_station_cache: dict[str, Any] = {
    'fetched_at': 0.0,
    'stations': [],
}
_bixi_rentals: dict[str, dict[str, Any]] = {}


def _fetch_json(url: str) -> dict[str, Any]:
    request = Request(url, headers={'User-Agent': 'CityFlow SUMMS/1.0'})
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode('utf-8'))


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_km * c


def _format_timestamp(timestamp: float | None) -> str | None:
    if timestamp is None:
        return None
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(timestamp))


def _calculate_duration_minutes(started_at: float | None, returned_at: float | None = None) -> int:
    if started_at is None:
        return 0

    end_time = returned_at if returned_at is not None else time.time()
    return max(1, math.ceil((end_time - started_at) / 60))


def _calculate_final_cost(duration_minutes: int) -> float:
    return round(RENTAL_BASE_FEE + (duration_minutes * RENTAL_PER_MINUTE_RATE), 2)


# Each rental phase owns the transitions and station adjustments that are valid from that phase.
class RentalState:
    status = 'unknown'

    def pay(self, context: BixiRentalContext) -> None:
        raise ValueError('Only reserved rentals can be paid and activated.')

    def return_bike(self, context: BixiRentalContext, return_station: dict[str, Any]) -> None:
        raise ValueError('Only active rentals can be returned.')

    def is_open(self) -> bool:
        return False

    def is_completed(self) -> bool:
        return False

    def pickup_bike_delta(self) -> int:
        return -1

    def pickup_dock_delta(self) -> int:
        return 0

    def return_bike_delta(self) -> int:
        return 0

    def return_dock_delta(self) -> int:
        return 0


class ReservedRentalState(RentalState):
    status = 'reserved'

    def pay(self, context: BixiRentalContext) -> None:
        context.record['started_at'] = time.time()
        context.record['authorization_amount'] = PAYMENT_AUTHORIZATION_AMOUNT
        context.record['payment_status'] = 'authorized'
        context.transition_to(ACTIVE_RENTAL_STATE)

    def is_open(self) -> bool:
        return True


class ActiveRentalState(RentalState):
    status = 'active'

    def return_bike(self, context: BixiRentalContext, return_station: dict[str, Any]) -> None:
        returned_at = time.time()
        started_at = context.record.get('started_at') or context.record['reserved_at']
        duration_minutes = _calculate_duration_minutes(started_at, returned_at)

        context.record['return_station'] = _station_summary(return_station)
        context.record['returned_at'] = returned_at
        context.record['final_cost'] = _calculate_final_cost(duration_minutes)
        context.record['payment_status'] = 'captured'
        context.transition_to(RETURNED_RENTAL_STATE)

    def is_open(self) -> bool:
        return True

    def pickup_dock_delta(self) -> int:
        return 1


class ReturnedRentalState(RentalState):
    status = 'returned'

    def is_completed(self) -> bool:
        return True

    def pickup_dock_delta(self) -> int:
        return 1

    def return_bike_delta(self) -> int:
        return 1

    def return_dock_delta(self) -> int:
        return -1


RESERVED_RENTAL_STATE = ReservedRentalState()
ACTIVE_RENTAL_STATE = ActiveRentalState()
RETURNED_RENTAL_STATE = ReturnedRentalState()

STATE_BY_STATUS: dict[str, RentalState] = {
    RESERVED_RENTAL_STATE.status: RESERVED_RENTAL_STATE,
    ACTIVE_RENTAL_STATE.status: ACTIVE_RENTAL_STATE,
    RETURNED_RENTAL_STATE.status: RETURNED_RENTAL_STATE,
}


class BixiRentalContext:
    def __init__(self, record: dict[str, Any]):
        self.record = record
        self.state = _state_for_status(str(record['status']))

    def transition_to(self, state: RentalState) -> None:
        self.state = state
        self.record['status'] = state.status

    def pay(self) -> None:
        self.state.pay(self)

    def return_bike(self, return_station: dict[str, Any]) -> None:
        self.state.return_bike(self, return_station)

    def is_state(self, state: RentalState) -> bool:
        return self.state is state

    def serialize(self) -> dict[str, Any]:
        return _serialize_rental(self.record)


def _state_for_status(status: str) -> RentalState:
    state = STATE_BY_STATUS.get(status)
    if not state:
        raise ValueError(f'Unsupported BIXI rental status: {status}')
    return state


def _load_station_feed() -> list[dict[str, Any]]:
    cached_age = time.time() - float(_station_cache['fetched_at'])
    if _station_cache['stations'] and cached_age < GBFS_CACHE_TTL_SECONDS:
        return _station_cache['stations']

    info_payload = _fetch_json(GBFS_STATION_INFO_URL)
    status_payload = _fetch_json(GBFS_STATION_STATUS_URL)

    info_stations = info_payload.get('data', {}).get('stations', [])
    status_stations = status_payload.get('data', {}).get('stations', [])
    status_by_id = {str(station['station_id']): station for station in status_stations}

    merged_stations: list[dict[str, Any]] = []
    for station in info_stations:
        station_id = str(station['station_id'])
        status = status_by_id.get(station_id, {})
        merged_stations.append(
            {
                'id': station_id,
                'name': station.get('name', 'BIXI Station'),
                'address': station.get('address'),
                'lat': float(station['lat']),
                'lng': float(station['lon']),
                'capacity': int(station.get('capacity', 0) or 0),
                'is_installed': bool(status.get('is_installed', 1)),
                'is_renting': bool(status.get('is_renting', 1)),
                'is_returning': bool(status.get('is_returning', 1)),
                'bikes_available': int(status.get('num_bikes_available', 0) or 0),
                'docks_available': int(status.get('num_docks_available', 0) or 0),
            }
        )

    _station_cache['fetched_at'] = time.time()
    _station_cache['stations'] = merged_stations
    return merged_stations


def _build_station_deltas() -> tuple[dict[str, int], dict[str, int]]:
    bike_deltas: dict[str, int] = {}
    dock_deltas: dict[str, int] = {}

    for rental in _bixi_rentals.values():
        state = _state_for_status(str(rental['status']))
        pickup_station_id = rental['pickup_station']['id']
        bike_deltas[pickup_station_id] = bike_deltas.get(pickup_station_id, 0) + state.pickup_bike_delta()

        pickup_dock_delta = state.pickup_dock_delta()
        if pickup_dock_delta:
            dock_deltas[pickup_station_id] = dock_deltas.get(pickup_station_id, 0) + pickup_dock_delta

        return_station = rental.get('return_station')
        if not return_station:
            continue

        return_station_id = return_station['id']
        return_bike_delta = state.return_bike_delta()
        return_dock_delta = state.return_dock_delta()

        if return_bike_delta:
            bike_deltas[return_station_id] = bike_deltas.get(return_station_id, 0) + return_bike_delta
        if return_dock_delta:
            dock_deltas[return_station_id] = dock_deltas.get(return_station_id, 0) + return_dock_delta

    return bike_deltas, dock_deltas


def _apply_station_overlay(station: dict[str, Any]) -> dict[str, Any]:
    bike_deltas, dock_deltas = _build_station_deltas()
    station_copy = dict(station)
    station_id = station_copy['id']

    station_copy['bikes_available'] = max(
        0,
        station_copy['bikes_available'] + bike_deltas.get(station_id, 0),
    )
    station_copy['docks_available'] = max(
        0,
        station_copy['docks_available'] + dock_deltas.get(station_id, 0),
    )
    return station_copy


def _station_summary(station: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': station['id'],
        'name': station['name'],
        'address': station.get('address'),
        'lat': station['lat'],
        'lng': station['lng'],
        'capacity': station['capacity'],
        'bikes_available': station['bikes_available'],
        'docks_available': station['docks_available'],
        'is_renting': station['is_renting'],
        'is_returning': station['is_returning'],
        'is_installed': station['is_installed'],
    }


def _serialize_rental(rental: dict[str, Any]) -> dict[str, Any]:
    started_at = rental.get('started_at')
    returned_at = rental.get('returned_at')
    duration_minutes = _calculate_duration_minutes(started_at, returned_at)

    return {
        'id': rental['id'],
        'status': rental['status'],
        'user_email': rental['user_email'],
        'user_name': rental['user_name'],
        'pickup_station': rental['pickup_station'],
        'return_station': rental.get('return_station'),
        'reserved_at': _format_timestamp(rental['reserved_at']),
        'started_at': _format_timestamp(started_at),
        'returned_at': _format_timestamp(returned_at),
        'duration_minutes': duration_minutes,
        'payment': {
            'authorization_amount': rental.get('authorization_amount'),
            'final_cost': rental.get('final_cost'),
            'status': rental.get('payment_status', 'pending'),
        },
    }


def _get_station_by_id(station_id: str) -> dict[str, Any] | None:
    for station in _load_station_feed():
        if station['id'] == station_id:
            return _apply_station_overlay(station)
    return None


def _get_open_rental_for_user(user_email: str) -> dict[str, Any] | None:
    open_rentals: list[dict[str, Any]] = []
    for rental in _bixi_rentals.values():
        if rental['user_email'] != user_email:
            continue
        if _state_for_status(str(rental['status'])).is_open():
            open_rentals.append(rental)

    if not open_rentals:
        return None
    return max(open_rentals, key=lambda rental: rental['reserved_at'])


def _get_rental_context(rental_id: str, user_email: str) -> BixiRentalContext:
    rental = _bixi_rentals.get(rental_id)
    if not rental:
        raise ValueError('BIXI rental was not found.')
    if rental['user_email'] != user_email:
        raise ValueError('This rental belongs to another user.')

    return BixiRentalContext(rental)


def get_nearby_bixi_stations(
    lat: float,
    lng: float,
    limit: int = 12,
    radius_km: float = 3,
) -> list[dict[str, Any]]:
    stations_with_distance: list[dict[str, Any]] = []

    for station in _load_station_feed():
        station_with_overlay = _apply_station_overlay(station)
        if not station_with_overlay['is_installed']:
            continue

        distance_km = _haversine_km(lat, lng, station_with_overlay['lat'], station_with_overlay['lng'])
        station_with_overlay['distance_km'] = round(distance_km, 2)
        station_with_overlay['can_rent'] = (
            station_with_overlay['is_renting'] and station_with_overlay['bikes_available'] > 0
        )
        station_with_overlay['can_return'] = (
            station_with_overlay['is_returning'] and station_with_overlay['docks_available'] > 0
        )
        stations_with_distance.append(station_with_overlay)

    stations_with_distance.sort(key=lambda station: station['distance_km'])

    if radius_km > 0:
        filtered = [station for station in stations_with_distance if station['distance_km'] <= radius_km]
        if filtered:
            stations_with_distance = filtered

    return stations_with_distance[: max(1, limit)]


def reserve_bixi_bike(user_email: str, user_name: str, station_id: str) -> dict[str, Any]:
    if _get_open_rental_for_user(user_email):
        raise ValueError('This user already has an open BIXI reservation or rental.')

    station = _get_station_by_id(station_id)
    if not station:
        raise ValueError('Selected BIXI station was not found.')
    if not station['is_renting'] or station['bikes_available'] <= 0:
        raise ValueError('No bikes are available at the selected station.')

    rental_id = f'BIXI-{uuid4().hex[:8].upper()}'
    rental_record = {
        'id': rental_id,
        'status': RESERVED_RENTAL_STATE.status,
        'user_email': user_email,
        'user_name': user_name,
        'pickup_station': _station_summary(station),
        'return_station': None,
        'reserved_at': time.time(),
        'started_at': None,
        'returned_at': None,
        'authorization_amount': None,
        'final_cost': None,
        'payment_status': 'pending',
    }
    _bixi_rentals[rental_id] = rental_record
    return BixiRentalContext(rental_record).serialize()


def pay_for_bixi_rental(rental_id: str, user_email: str) -> dict[str, Any]:
    rental_context = _get_rental_context(rental_id, user_email)
    rental_context.pay()
    return rental_context.serialize()


def return_bixi_rental(rental_id: str, user_email: str, return_station_id: str) -> dict[str, Any]:
    rental_context = _get_rental_context(rental_id, user_email)

    return_station = _get_station_by_id(return_station_id)
    if not return_station:
        raise ValueError('Return station was not found.')
    if not return_station['is_returning'] or return_station['docks_available'] <= 0:
        raise ValueError('No docks are available at the selected return station.')

    rental_context.return_bike(return_station)
    return rental_context.serialize()


def get_user_bixi_rental_state(user_email: str, history_limit: int = 5) -> dict[str, Any]:
    open_rental = _get_open_rental_for_user(user_email)
    rental_history: list[dict[str, Any]] = []

    for rental in _bixi_rentals.values():
        if rental['user_email'] != user_email:
            continue
        if _state_for_status(str(rental['status'])).is_completed():
            rental_history.append(rental)

    rental_history.sort(key=lambda rental: rental.get('returned_at') or rental['reserved_at'], reverse=True)

    return {
        'open_rental': _serialize_rental(open_rental) if open_rental else None,
        'history': [_serialize_rental(rental) for rental in rental_history[: max(1, history_limit)]],
    }


def get_bixi_analytics_summary() -> dict[str, Any]:
    rental_contexts = [BixiRentalContext(rental) for rental in _bixi_rentals.values()]
    total_rentals = len(rental_contexts)
    active_rentals = sum(1 for rental_context in rental_contexts if rental_context.is_state(ACTIVE_RENTAL_STATE))
    reserved_rentals = sum(1 for rental_context in rental_contexts if rental_context.is_state(RESERVED_RENTAL_STATE))
    completed_rentals = sum(
        1 for rental_context in rental_contexts if rental_context.is_state(RETURNED_RENTAL_STATE)
    )
    total_revenue = round(
        sum(float(rental_context.record.get('final_cost') or 0) for rental_context in rental_contexts),
        2,
    )

    average_duration_minutes = 0
    completed_durations = [
        _calculate_duration_minutes(
            rental_context.record.get('started_at'),
            rental_context.record.get('returned_at'),
        )
        for rental_context in rental_contexts
        if rental_context.is_state(RETURNED_RENTAL_STATE)
        and rental_context.record.get('started_at')
        and rental_context.record.get('returned_at')
    ]
    if completed_durations:
        average_duration_minutes = round(sum(completed_durations) / len(completed_durations), 1)

    pickups_by_station: dict[str, int] = {}
    for rental_context in rental_contexts:
        station_name = rental_context.record['pickup_station']['name']
        pickups_by_station[station_name] = pickups_by_station.get(station_name, 0) + 1

    popular_station = None
    if pickups_by_station:
        popular_station = max(pickups_by_station, key=pickups_by_station.get)

    return {
        'total_rentals': total_rentals,
        'active_rentals': active_rentals,
        'reserved_rentals': reserved_rentals,
        'completed_rentals': completed_rentals,
        'total_revenue': total_revenue,
        'average_duration_minutes': average_duration_minutes,
        'popular_pickup_station': popular_station,
    }
