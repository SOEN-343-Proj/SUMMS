from vehicle_rental_state import VehicleRentalState
from vehicle_rental_context import VehicleRentalContext
from vehicle_returned_state import VehicleReturnedRentalState
import time

RETURNED_CAR_RENTAL_STATE = VehicleReturnedRentalState()
PAYMENT_CURRENCY = 'CAD'

class VehicleActiveRentalState(VehicleRentalState):
    status = 'active'

    def complete(self, context: VehicleRentalContext) -> dict[str, Any]:
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