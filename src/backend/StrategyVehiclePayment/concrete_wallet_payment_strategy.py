from vehicle_payment_strategy import VehiclePaymentStrategy
import time
from uuid import uuid4

class ConcreteWalletPaymentStrategy(VehiclePaymentStrategy):
    method = 'wallet'
    display_name = 'Wallet'
    description = 'Simulates an app wallet authorization with fixture wallet IDs.'

    def authorize(
        self,
        amount: float,
        currency: str,
        payer_email: str,
        payment_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        details = payment_details or {}
        wallet_id = str(details.get('wallet_id') or f'WALLET-{payer_email.split("@")[0].upper()}')

        return {
            'status': 'authorized',
            'method': self.method,
            'provider': 'WalletService',
            'transaction_id': _new_transaction_id('WALLET'),
            'authorized_amount': round(amount, 2),
            'currency': currency,
            'receipt': {
                'payer_email': payer_email,
                'wallet_id': wallet_id,
            },
        }
    
def _new_transaction_id(prefix: str) -> str:
    timestamp = int(time.time())
    return f'{prefix}-{timestamp}-{uuid4().hex[:8].upper()}'