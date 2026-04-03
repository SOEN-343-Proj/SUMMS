from __future__ import annotations

from src.backend.Sprint1Implementation.payment_system import PaymentProcessor

from tests.test_support import BackendTestCase


class PaymentProcessorTests(BackendTestCase):
    def test_card_authorization_returns_receipt_and_transaction(self) -> None:
        processor = PaymentProcessor()

        result = processor.authorize(
            amount=12.5,
            currency="cad",
            payer_email="rider@cityflow.com",
            payment_method="card",
            payment_details={"card_brand": "Mastercard", "card_last4": "5555"},
        )

        self.assertEqual(result["status"], "authorized")
        self.assertEqual(result["method"], "card")
        self.assertEqual(result["currency"], "CAD")
        self.assertEqual(result["authorized_amount"], 12.5)
        self.assertEqual(result["receipt"]["card_brand"], "Mastercard")
        self.assertEqual(result["receipt"]["card_last4"], "5555")
        self.assertTrue(result["transaction_id"].startswith("CARD-"))

    def test_wallet_authorization_generates_default_wallet_id(self) -> None:
        processor = PaymentProcessor()

        result = processor.authorize(
            amount=8.0,
            currency="CAD",
            payer_email="jane.doe@student.com",
            payment_method="wallet",
        )

        self.assertEqual(result["status"], "authorized")
        self.assertEqual(result["receipt"]["wallet_id"], "WALLET-JANE.DOE")
        self.assertEqual(result["provider"], "WalletService")

    def test_unsupported_payment_method_raises_value_error(self) -> None:
        processor = PaymentProcessor()

        with self.assertRaisesRegex(ValueError, 'Unsupported payment method "cash"'):
            processor.authorize(
                amount=5.0,
                currency="CAD",
                payer_email="rider@cityflow.com",
                payment_method="cash",
            )
