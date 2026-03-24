import { useEffect, useState } from 'react'
import '../styles/ParkingMap.css'
import '../styles/CarRentalFlow.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const DEFAULT_PAYMENT_METHODS = [
  { id: 'card', name: 'Card', description: 'Sample credit card authorization' },
  { id: 'wallet', name: 'Wallet', description: 'Sample wallet authorization' },
  { id: 'transit_pass', name: 'Transit Pass', description: 'Sample transit pass charge' },
]

async function requestJson(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.detail || 'Request failed')
  }

  return data
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

function buildPaymentDetails(method, user) {
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

function buildSamplePaymentInfo(method, user) {
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

function CarCard({ car, actionLabel, actionClass, onAction, disabled, loading }) {
  return (
    <div className="car-card">
      <div className="car-card-header">
        <h4>
          {car.year} {car.make} {car.model}
        </h4>
        <span className="car-rate">{formatCurrency(car.daily_rate)}/day</span>
      </div>

      <div className="car-meta-grid">
        <span>Color: {car.color}</span>
        <span>Seats: {car.seats}</span>
        <span>Fuel: {car.fuel_type}</span>
        <span>Transmission: {car.transmission}</span>
      </div>

      <button className={`car-action-btn ${actionClass}`} type="button" onClick={onAction} disabled={disabled}>
        {loading ? 'Processing...' : actionLabel}
      </button>
    </div>
  )
}

function CarRentalFlow({ user, onClose }) {
  const [availableCars, setAvailableCars] = useState([])
  const [userCars, setUserCars] = useState([])
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS)
  const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHODS[0].id)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedCarForPayment, setSelectedCarForPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedPaymentOption =
    paymentMethods.find((method) => method.id === paymentMethod) || DEFAULT_PAYMENT_METHODS[0]
  const paymentDetails = buildPaymentDetails(paymentMethod, user)
  const samplePaymentInfo = buildSamplePaymentInfo(paymentMethod, user)

  const loadPaymentMethods = async () => {
    try {
      const data = await requestJson(`${API_BASE_URL}/bixi/payments/methods`)
      const methods = Array.isArray(data.methods) && data.methods.length > 0 ? data.methods : DEFAULT_PAYMENT_METHODS
      setPaymentMethods(methods)
      setPaymentMethod((current) => {
        if (methods.some((method) => method.id === current)) {
          return current
        }
        return methods[0]?.id || DEFAULT_PAYMENT_METHODS[0].id
      })
    } catch {
      setPaymentMethods(DEFAULT_PAYMENT_METHODS)
    }
  }

  const loadCars = async () => {
    setLoading(true)
    setError('')

    try {
      const userQuery = new URLSearchParams({ user_email: user.email })
      const [availableData, userData] = await Promise.all([
        requestJson(`${API_BASE_URL}/cars/available`),
        requestJson(`${API_BASE_URL}/cars/user?${userQuery.toString()}`),
      ])

      setAvailableCars(availableData.cars || [])
      setUserCars(userData.cars || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCars()
    loadPaymentMethods()
  }, [user.email])

  const handleRent = (car) => {
    setSelectedCarForPayment(car)
    setShowPaymentModal(true)
  }

  const handleConfirmRent = async () => {
    if (!selectedCarForPayment) {
      return
    }

    const car = selectedCarForPayment
    setActionLoading(`rent:${car.id}`)
    setError('')
    setNotice('')

    try {
      await requestJson(`${API_BASE_URL}/cars/rent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          user_name: user.name,
          car_id: car.id,
          payment_method: paymentMethod,
          payment_details: paymentDetails,
        }),
      })

      setNotice(`${car.make} ${car.model} is now in your cars. Payment authorized with ${selectedPaymentOption.name}.`)
      setShowPaymentModal(false)
      setSelectedCarForPayment(null)
      await loadCars()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleReturn = async (car) => {
    setActionLoading(`return:${car.id}`)
    setError('')
    setNotice('')

    try {
      const data = await requestJson(`${API_BASE_URL}/cars/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          car_id: car.id,
        }),
      })

      const amountBilled = data?.rental?.billing?.amount_billed
      const billedCurrency = data?.rental?.billing?.currency || 'CAD'
      const billedText =
        amountBilled !== undefined && amountBilled !== null
          ? new Intl.NumberFormat('en-CA', {
              style: 'currency',
              currency: billedCurrency,
            }).format(amountBilled)
          : formatCurrency(car.daily_rate)

      setNotice(`${car.make} ${car.model} was returned. Amount billed: ${billedText}.`)
      await loadCars()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  return (
    <div className="parking-map-container car-rental-container">
      <div className="parking-map-header car-rental-header">
        <div>
          <h2>Car Rental</h2>
          <p>Browse available cars and add rentals to your cars list.</p>
        </div>
        <button className="close-btn" type="button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="car-rental-content">
        {notice && <div className="notice-banner">{notice}</div>}
        {error && <div className="error-banner">{error}</div>}

        <section className="car-section">
          <h3>Available Cars</h3>
          {loading ? (
            <p className="car-empty">Loading available cars...</p>
          ) : availableCars.length > 0 ? (
            <div className="car-list-grid">
              {availableCars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  actionLabel="Rent this car"
                  actionClass="rent"
                  onAction={() => handleRent(car)}
                  disabled={Boolean(actionLoading)}
                  loading={actionLoading === `rent:${car.id}`}
                />
              ))}
            </div>
          ) : (
            <p className="car-empty">No cars are available right now.</p>
          )}
        </section>

        <section className="car-section">
          <h3>My Cars</h3>
          {loading ? (
            <p className="car-empty">Loading your cars...</p>
          ) : userCars.length > 0 ? (
            <div className="car-list-grid">
              {userCars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  actionLabel="Return this car"
                  actionClass="return"
                  onAction={() => handleReturn(car)}
                  disabled={Boolean(actionLoading)}
                  loading={actionLoading === `return:${car.id}`}
                />
              ))}
            </div>
          ) : (
            <p className="car-empty">You have no rented cars yet.</p>
          )}
        </section>
      </div>

      {showPaymentModal && selectedCarForPayment && (
        <div className="payment-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="car-payment-modal-title">
          <div className="payment-modal">
            <h3 id="car-payment-modal-title">Authorize Payment</h3>
            <p>
              Confirm payment for {selectedCarForPayment.year} {selectedCarForPayment.make} {selectedCarForPayment.model}. We
              will authorize {formatCurrency(selectedCarForPayment.daily_rate)} for the first day.
            </p>

            <div className="payment-method-panel">
              <label htmlFor="car-payment-method-select">Payment Method</label>
              <select
                id="car-payment-method-select"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                disabled={actionLoading === `rent:${selectedCarForPayment.id}`}
              >
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
              <small>{selectedPaymentOption.description}</small>
            </div>

            <div className="payment-mock-details">
              <h4>Sample Payment Information</h4>
              <ul>
                {samplePaymentInfo.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="payment-modal-actions">
              <button
                className="car-action-btn cancel"
                type="button"
                onClick={() => {
                  setShowPaymentModal(false)
                  setSelectedCarForPayment(null)
                }}
                disabled={actionLoading === `rent:${selectedCarForPayment.id}`}
              >
                Cancel
              </button>
              <button
                className="car-action-btn rent"
                type="button"
                onClick={handleConfirmRent}
                disabled={actionLoading === `rent:${selectedCarForPayment.id}`}
              >
                {actionLoading === `rent:${selectedCarForPayment.id}` ? 'Authorizing payment...' : 'Authorize and Rent Car'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CarRentalFlow