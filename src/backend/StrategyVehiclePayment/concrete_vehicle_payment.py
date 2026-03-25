from vehicle_payment_strategy import VehiclePaymentStrategy
from concrete_card_payment_strategy import ConcreteCardPaymentStrategy
from concrete_transit_payment_strategy import ConcreteTransitPassPaymentStrategy
from concrete_wallet_payment_strategy import ConcreteWalletPaymentStrategy

SUPPORTED_CURRENCY = 'CAD'

class ConcreteVehiclePayment:
    def __init__(self) -> None:
        self._strategies: dict[str, VehiclePaymentStrategy] = {
            'card': ConcreteCardPaymentStrategy(),
            'wallet': ConcreteWalletPaymentStrategy(),
            'transit_pass': ConcreteTransitPassPaymentStrategy(),
        }

    def get(self, method: str) -> VehiclePaymentStrategy:
        strategy = self._strategies.get(method)
        if not strategy:
            supported = ', '.join(sorted(self._strategies.keys()))
            raise ValueError(f'Unsupported payment method "{method}". Supported: {supported}.')
        return strategy

    def list_methods(self) -> list[dict[str, str]]:
        return [
            {
                'id': strategy.method,
                'name': strategy.display_name,
                'description': strategy.description,
            }
            for strategy in self._strategies.values()
        ]
    def authorize(
        self,
        *,
        amount: float,
        currency: str,
        payer_email: str,
        payment_method: str,
        payment_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if amount <= 0:
            raise ValueError('Authorization amount must be greater than zero.')

        normalized_currency = currency.upper()
        if normalized_currency != SUPPORTED_CURRENCY:
            raise ValueError(f'Unsupported currency "{currency}".')

        strategy = self.get(payment_method)
        return strategy.authorize(
            amount=amount,
            currency=normalized_currency,
            payer_email=payer_email,
            payment_details=payment_details,
        )

    def list_supported_methods(self) -> list[dict[str, str]]:
        return self.list_methods()