from bixi_context import BixiRentalContext
from rental_state import RentalState
from active_state import ActiveRentalState
import time

ACTIVE_RENTAL_STATE = ActiveRentalState()

#when status is reserved, user has reserved a bike but has not paid yet. 
class ReservedRentalState(RentalState):
    status = 'reserved'

    def pay(self, context: BixiRentalContext, payment_result: dict[str, Any]) -> None:
        context.record['started_at'] = time.time()
        context.record['authorization_amount'] = payment_result['authorized_amount']
        context.record['payment_status'] = payment_result['status']
        context.record['payment_method'] = payment_result['method']
        context.record['payment_provider'] = payment_result['provider']
        context.record['payment_transaction_id'] = payment_result['transaction_id']
        context.record['payment_receipt'] = payment_result.get('receipt', {})
        context.transition_to(ACTIVE_RENTAL_STATE)

    def is_open(self) -> bool:
        return True

    def pickup_bike_delta(self) -> int:
        return 0
