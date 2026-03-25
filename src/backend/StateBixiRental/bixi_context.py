from rental_state import RentalState
from active_state import ActiveRentalState
from reserved_state import ReservedRentalState
from returned_state import ReturnedRentalState
import time, math

RESERVED_RENTAL_STATE = ReservedRentalState()
ACTIVE_RENTAL_STATE = ActiveRentalState()
RETURNED_RENTAL_STATE = ReturnedRentalState()

STATE_BY_STATUS: dict[str, RentalState] = {
    RESERVED_RENTAL_STATE.status: RESERVED_RENTAL_STATE,
    ACTIVE_RENTAL_STATE.status: ACTIVE_RENTAL_STATE,
    RETURNED_RENTAL_STATE.status: RETURNED_RENTAL_STATE,
}

# BixiRentalContext manages the state of a single rental and 
# has methods to transition between states, pay for the rental, and return the bike.
class BixiRentalContext:
    def __init__(self, record: dict[str, Any]):
        self.record = record
        self.state = _state_for_status(str(record['status']))

    def transition_to(self, state: RentalState) -> None:
        self.state = state
        self.record['status'] = state.status

    def pay(self, payment_result: dict[str, Any]) -> None:
        self.state.pay(self, payment_result)

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
            'method': rental.get('payment_method'),
            'provider': rental.get('payment_provider'),
            'transaction_id': rental.get('payment_transaction_id'),
            'receipt': rental.get('payment_receipt') or {},
        },
    }

def _calculate_duration_minutes(started_at: float | None, returned_at: float | None = None) -> int:
    if started_at is None:
        return 0

    end_time = returned_at if returned_at is not None else time.time()
    return max(1, math.ceil((end_time - started_at) / 60))

def _format_timestamp(timestamp: float | None) -> str | None:
    if timestamp is None:
        return None
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(timestamp))