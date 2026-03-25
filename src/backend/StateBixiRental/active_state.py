from bixi_context import BixiRentalContext
from rental_state import RentalState
from returned_state import ReturnedRentalState
import time
import math

RETURNED_RENTAL_STATE = ReturnedRentalState()
RENTAL_BASE_FEE = 2.75
RENTAL_PER_MINUTE_RATE = 0.18

# when staus is active, user has paid and can return the bike to a station.
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

def _calculate_duration_minutes(started_at: float | None, returned_at: float | None = None) -> int:
    if started_at is None:
        return 0

    end_time = returned_at if returned_at is not None else time.time()
    return max(1, math.ceil((end_time - started_at) / 60))

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

def _calculate_final_cost(duration_minutes: int) -> float:
    return round(RENTAL_BASE_FEE + (duration_minutes * RENTAL_PER_MINUTE_RATE), 2)