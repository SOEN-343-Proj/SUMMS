from vehicle_payment_strategy import VehiclePaymentStrategy
import time
from uuid import uuid4

class ConcreteTransitPassPaymentStrategy(VehiclePaymentStrategy):
    method = 'transit_pass'
    display_name = 'Transit Pass'
    description = 'Simulates charging a pre-registered transit or campus pass.'

    def authorize(
        self,
        amount: float,
        currency: str,
        payer_email: str,
        payment_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        details = payment_details or {}
        pass_id = str(details.get('pass_id') or 'PASS-MTL-001')

        return {
            'status': 'authorized',
            'method': self.method,
            'provider': 'TransitPassNetwork',
            'transaction_id': _new_transaction_id('PASS'),
            'authorized_amount': round(amount, 2),
            'currency': currency,
            'receipt': {
                'payer_email': payer_email,
                'pass_id': pass_id,
            },
        }

def _new_transaction_id(prefix: str) -> str:
    timestamp = int(time.time())
    return f'{prefix}-{timestamp}-{uuid4().hex[:8].upper()}'