from abc import ABC, abstractmethod

class VehiclePaymentStrategy(ABC):
    method = 'unknown'
    display_name = 'Unknown'
    description = 'Generic payment strategy.'

    @abstractmethod
    def authorize(
        self,
        amount: float,
        currency: str,
        payer_email: str,
        payment_details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError