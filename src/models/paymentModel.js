export const DEFAULT_PAYMENT_METHODS = [
  { id: 'card', name: 'Card', description: 'Sample credit card authorization' },
  { id: 'wallet', name: 'Wallet', description: 'Sample wallet authorization' },
  { id: 'transit_pass', name: 'Transit Pass', description: 'Sample transit pass charge' },
]

export function buildMockPaymentDetails(method, user) {
  switch (method) {
    case 'wallet':
      return {
        wallet_id: `WALLET-${user.email.split('@')[0].toUpperCase()}`,
      }
    case 'transit_pass':
      return {
        pass_id: 'PASS-MTL-001',
        holder_name: user.name,
      }
    case 'card':
    default:
      return {
        card_brand: 'Visa',
        card_last4: '4242',
      }
  }
}

export function buildSamplePaymentInfo(method, user) {
  if (method === 'wallet') {
    return [
      `Wallet ID: WALLET-${user.email.split('@')[0].toUpperCase()}`,
      'Provider: WalletService',
      'Status: Ready to authorize',
    ]
  }

  if (method === 'transit_pass') {
    return [
      'Transit Pass ID: PASS-MTL-001',
      `Holder: ${user.name}`,
      'Network: TransitPassNetwork',
    ]
  }

  return [
    'Card: Visa ending in 4242',
    `Cardholder: ${user.name}`,
    'Provider: CardGateway',
  ]
}
