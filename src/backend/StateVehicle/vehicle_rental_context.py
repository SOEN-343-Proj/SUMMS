from vehicle_rental_state import VehicleRentalState
from vehicle_active_state import VehicleActiveRentalState
from vehicle_returned_state import VehicleReturnedRentalState

ACTIVE_CAR_RENTAL_STATE = VehicleActiveRentalState()
RETURNED_CAR_RENTAL_STATE = VehicleReturnedRentalState()

class VehicleRentalContext:
    def __init__(self, record: dict[str, Any]):
        self.record = record
        self.state = _car_rental_state_for_status(str(record['status']))

    def transition_to(self, state: VehicleRentalState) -> None:
        self.state = state
        self.record['status'] = state.status

    def complete(self) -> dict[str, Any]:
        return self.state.complete(self)

def _car_rental_state_for_status(status: str) -> VehicleRentalState:
    state = CAR_RENTAL_STATE_BY_STATUS.get(status)
    if not state:
        raise ValueError(f'Unsupported car rental status: {status}')
    return state

CAR_RENTAL_STATE_BY_STATUS: dict[str, VehicleRentalState] = {
    ACTIVE_CAR_RENTAL_STATE.status: ACTIVE_CAR_RENTAL_STATE,
    RETURNED_CAR_RENTAL_STATE.status: RETURNED_CAR_RENTAL_STATE,
}