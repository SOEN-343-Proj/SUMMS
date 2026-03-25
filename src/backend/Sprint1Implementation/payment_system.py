from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any
from uuid import uuid4


SUPPORTED_CURRENCY = 'CAD'


def _new_transaction_id(prefix: str) -> str:
    timestamp = int(time.time())
    return f'{prefix}-{timestamp}-{uuid4().hex[:8].upper()}'


class PaymentStrategy(ABC):
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


class MockCardPaymentStrategy(PaymentStrategy):
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


class MockWalletPaymentStrategy(PaymentStrategy):
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


class MockTransitPassPaymentStrategy(PaymentStrategy):
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


class PaymentStrategyFactory:
    def __init__(self) -> None:
        self._strategies: dict[str, PaymentStrategy] = {
            'card': MockCardPaymentStrategy(),
            'wallet': MockWalletPaymentStrategy(),
            'transit_pass': MockTransitPassPaymentStrategy(),
        }

    def get(self, method: str) -> PaymentStrategy:
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


class PaymentProcessor:
    def __init__(self, factory: PaymentStrategyFactory | None = None) -> None:
        self.factory = factory or PaymentStrategyFactory()

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

        strategy = self.factory.get(payment_method)
        return strategy.authorize(
            amount=amount,
            currency=normalized_currency,
            payer_email=payer_email,
            payment_details=payment_details,
        )

    def list_supported_methods(self) -> list[dict[str, str]]:
        return self.factory.list_methods()
