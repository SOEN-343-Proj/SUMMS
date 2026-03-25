from vehicle_payment_strategy import VehiclePaymentStrategy
import time
from uuid import uuid4

class ConcreteCardPaymentStrategy(VehiclePaymentStrategy):
    method = 'card'
    display_name = 'Card'
    description = 'Simulates a card authorization with fixture card data.'

    def authorize(
        self,
        amount: float,
        currency: str,
        payer_email: str,
        payment_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        details = payment_details or {}
        if details.get('force_decline'):
            return {
                'status': 'declined',
                'method': self.method,
                'provider': 'CardGateway',
                'authorized_amount': 0.0,
                'currency': currency,
                'reason': 'Card was declined.',
            }

        card_last4 = str(details.get('card_last4') or '4242')
        card_brand = str(details.get('card_brand') or 'Visa')

        return {
            'status': 'authorized',
            'method': self.method,
            'provider': 'CardGateway',
            'transaction_id': _new_transaction_id('CARD'),
            'authorized_amount': round(amount, 2),
            'currency': currency,
            'receipt': {
                'payer_email': payer_email,
                'card_brand': card_brand,
                'card_last4': card_last4,
            },
        }
    
def _new_transaction_id(prefix: str) -> str:
    timestamp = int(time.time())
    return f'{prefix}-{timestamp}-{uuid4().hex[:8].upper()}'