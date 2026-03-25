import { useEffect, useState } from 'react'
import '../styles/ParkingMap.css'
import '../styles/VehicleRentalFlow.css'

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

function toTitleCase(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function buildVehicleTitle(vehicle) {
  const year = vehicle?.year ? `${vehicle.year} ` : ''
  const make = vehicle?.make || ''
  const model = vehicle?.model || ''
  const label = `${year}${make} ${model}`.trim()
  if (label) {
    return label
  }
  return `${toTitleCase(vehicle?.vehicle_type || 'Vehicle')} ${vehicle?.id || ''}`.trim()
}

function buildVehicleMeta(vehicle) {
  const details = [
    `Type: ${toTitleCase(vehicle.vehicle_type || 'vehicle')}`,
    vehicle.color ? `Color: ${vehicle.color}` : null,
    vehicle.seats ? `Seats: ${vehicle.seats}` : null,
    vehicle.fuel_type ? `Fuel: ${vehicle.fuel_type}` : null,
    vehicle.transmission ? `Transmission: ${vehicle.transmission}` : null,
    vehicle.range_km ? `Range: ${vehicle.range_km} km` : null,
    vehicle.top_speed_kmh ? `Top speed: ${vehicle.top_speed_kmh} km/h` : null,
    vehicle.helmet_included !== undefined
      ? `Helmet: ${vehicle.helmet_included ? 'Included' : 'Not included'}`
      : null,
  ]

  return details.filter(Boolean)
}

function buildEditFormFromVehicle(vehicle) {
  return {
    vehicle_type: vehicle.vehicle_type || 'car',
    make: vehicle.make || '',
    model: vehicle.model || '',
    year: vehicle.year || new Date().getFullYear(),
    daily_rate: vehicle.daily_rate || 1,
    color: vehicle.color || '',
    transmission: vehicle.transmission || '',
    seats: vehicle.seats || 1,
    fuel_type: vehicle.fuel_type || '',
  }
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

function VehicleCard({ vehicle, actionLabel, actionClass, onAction, onEdit, disabled, loading }) {
  const metadata = buildVehicleMeta(vehicle)

  return (
    <div className="vehicle-card">
      <div className="vehicle-card-header">
        <h4>
          {buildVehicleTitle(vehicle)}
        </h4>
        <span className="vehicle-rate">{formatCurrency(vehicle.daily_rate)}/day</span>
      </div>

      <div className="vehicle-meta-grid">
        {metadata.map((line) => (
          <span key={`${vehicle.id}-${line}`}>{line}</span>
        ))}
      </div>

      {actionLabel && onAction && (
        <button className={`vehicle-action-btn ${actionClass}`} type="button" onClick={onAction} disabled={disabled}>
          {loading ? 'Processing...' : actionLabel}
        </button>
      )}
      {onEdit && (
        <button className="vehicle-action-btn edit" type="button" onClick={onEdit} disabled={disabled || loading}>
          Edit Listing
        </button>
      )}
    </div>
  )
}

function VehicleRentalFlow({ user, onClose }) {
  const initialVehicleForm = {
    vehicle_type: 'car',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    daily_rate: 45,
    color: '',
    transmission: 'Automatic',
    seats: 4,
    fuel_type: 'Gasoline',
  }

  const [availableVehicles, setAvailableVehicles] = useState([])
  const [myListings, setMyListings] = useState([])
  const [userVehicles, setUserVehicles] = useState([])
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS)
  const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHODS[0].id)
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedVehicleForPayment, setSelectedVehicleForPayment] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState('')
  const [editVehicleForm, setEditVehicleForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm)

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

  const loadVehicles = async () => {
    setLoading(true)
    setError('')

    try {
      const userQuery = new URLSearchParams({ user_email: user.email })
      const availableQuery = new URLSearchParams()
      if (vehicleTypeFilter !== 'all') {
        availableQuery.set('vehicle_type', vehicleTypeFilter)
      }

      const [availableData, userData, listingsData] = await Promise.all([
        requestJson(`${API_BASE_URL}/vehicles/available?${availableQuery.toString()}`),
        requestJson(`${API_BASE_URL}/vehicles/user?${userQuery.toString()}`),
        requestJson(`${API_BASE_URL}/vehicles/listings/user?${userQuery.toString()}`),
      ])

      setAvailableVehicles(availableData.vehicles || [])
      setUserVehicles(userData.vehicles || [])
      setMyListings(listingsData.vehicles || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehicles()
    loadPaymentMethods()
  }, [user.email, vehicleTypeFilter])

  const availableVehicleTypes = Array.from(
    new Set(availableVehicles.map((vehicle) => String(vehicle.vehicle_type || '').toLowerCase()).filter(Boolean))
  ).sort()

  const selectedVehicleTitle = selectedVehicleForPayment ? buildVehicleTitle(selectedVehicleForPayment) : ''

  const handleRent = (vehicle) => {
    setSelectedVehicleForPayment(vehicle)
    setShowPaymentModal(true)
  }

  const handleConfirmRent = async () => {
    if (!selectedVehicleForPayment) {
      return
    }

    const vehicle = selectedVehicleForPayment
    setActionLoading(`rent:${vehicle.id}`)
    setError('')
    setNotice('')

    try {
      await requestJson(`${API_BASE_URL}/vehicles/rent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          user_name: user.name,
          vehicle_id: vehicle.id,
          payment_method: paymentMethod,
          payment_details: paymentDetails,
        }),
      })

      setNotice(`${vehicle.make} ${vehicle.model} is now in your vehicles. Payment authorized with ${selectedPaymentOption.name}.`)
      setShowPaymentModal(false)
      setSelectedVehicleForPayment(null)
      await loadVehicles()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleReturn = async (vehicle) => {
    setActionLoading(`return:${vehicle.id}`)
    setError('')
    setNotice('')

    try {
      const data = await requestJson(`${API_BASE_URL}/vehicles/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          vehicle_id: vehicle.id,
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
          : formatCurrency(vehicle.daily_rate)

      setNotice(`${vehicle.make} ${vehicle.model} was returned. Amount billed: ${billedText}.`)
      await loadVehicles()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleVehicleFormChange = (event) => {
    const { name, value } = event.target
    setVehicleForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleAddVehicle = async (event) => {
    event.preventDefault()
    setActionLoading('add-marketplace')
    setError('')
    setNotice('')

    try {
      const payload = {
        listed_by_email: user.email,
        vehicle_type: vehicleForm.vehicle_type.trim().toLowerCase(),
        make: vehicleForm.make.trim(),
        model: vehicleForm.model.trim(),
        year: Number(vehicleForm.year),
        daily_rate: Number(vehicleForm.daily_rate),
        color: vehicleForm.color.trim() || undefined,
        transmission: vehicleForm.transmission.trim() || undefined,
        seats: Number(vehicleForm.seats),
        fuel_type: vehicleForm.fuel_type.trim() || undefined,
      }

      const data = await requestJson(`${API_BASE_URL}/vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const addedVehicle = data?.vehicle
      setNotice(`Added ${buildVehicleTitle(addedVehicle || payload)} to the marketplace.`)
      setVehicleForm(initialVehicleForm)
      await loadVehicles()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleOpenEditModal = (vehicle) => {
    setEditingVehicleId(vehicle.id)
    setEditVehicleForm(buildEditFormFromVehicle(vehicle))
    setShowEditModal(true)
  }

  const handleEditFormChange = (event) => {
    const { name, value } = event.target
    setEditVehicleForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSaveVehicleUpdate = async (event) => {
    event.preventDefault()
    if (!editingVehicleId || !editVehicleForm) {
      return
    }

    setActionLoading('update-marketplace')
    setError('')
    setNotice('')

    try {
      const payload = {
        user_email: user.email,
        vehicle_type: editVehicleForm.vehicle_type.trim().toLowerCase(),
        make: editVehicleForm.make.trim(),
        model: editVehicleForm.model.trim(),
        year: Number(editVehicleForm.year),
        daily_rate: Number(editVehicleForm.daily_rate),
        color: editVehicleForm.color.trim() || undefined,
        transmission: editVehicleForm.transmission.trim() || undefined,
        seats: Number(editVehicleForm.seats),
        fuel_type: editVehicleForm.fuel_type.trim() || undefined,
      }

      const data = await requestJson(`${API_BASE_URL}/vehicles/${editingVehicleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      setNotice(`Updated ${buildVehicleTitle(data?.vehicle || payload)} successfully.`)
      setShowEditModal(false)
      setEditingVehicleId('')
      setEditVehicleForm(null)
      await loadVehicles()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  return (
    <div className="parking-map-container vehicle-rental-container">
      <div className="parking-map-header vehicle-rental-header">
        <div>
          <h2>Vehicle Rental</h2>
          <p>Browse available vehicles and add rentals to your vehicles list.</p>
        </div>
        <button className="close-btn" type="button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="vehicle-rental-content">
        {notice && <div className="notice-banner">{notice}</div>}
        {error && <div className="error-banner">{error}</div>}

        <section className="vehicle-section">
          <h3>My Vehicles</h3>
          {loading ? (
            <p className="vehicle-empty">Loading your vehicles...</p>
          ) : userVehicles.length > 0 ? (
            <div className="vehicle-list-grid">
              {userVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  actionLabel="Return this vehicle"
                  actionClass="return"
                  onAction={() => handleReturn(vehicle)}
                  disabled={Boolean(actionLoading)}
                  loading={actionLoading === `return:${vehicle.id}`}
                />
              ))}
            </div>
          ) : (
            <p className="vehicle-empty">You have no rented vehicles yet.</p>
          )}
        </section>

        <section className="vehicle-section marketplace-add-section">
          <h3>Add Vehicle To Marketplace</h3>
          <form className="marketplace-add-form" onSubmit={handleAddVehicle}>
            <input
              name="vehicle_type"
              value={vehicleForm.vehicle_type}
              onChange={handleVehicleFormChange}
              placeholder="Type (car, moped, scooter)"
              required
            />
            <input name="make" value={vehicleForm.make} onChange={handleVehicleFormChange} placeholder="Make" required />
            <input name="model" value={vehicleForm.model} onChange={handleVehicleFormChange} placeholder="Model" required />
            <input
              name="year"
              type="number"
              min="2000"
              max="2100"
              value={vehicleForm.year}
              onChange={handleVehicleFormChange}
              required
            />
            <input
              name="daily_rate"
              type="number"
              min="1"
              step="0.5"
              value={vehicleForm.daily_rate}
              onChange={handleVehicleFormChange}
              required
            />
            <input name="color" value={vehicleForm.color} onChange={handleVehicleFormChange} placeholder="Color" />
            <input
              name="transmission"
              value={vehicleForm.transmission}
              onChange={handleVehicleFormChange}
              placeholder="Transmission"
            />
            <input
              name="seats"
              type="number"
              min="1"
              value={vehicleForm.seats}
              onChange={handleVehicleFormChange}
              required
            />
            <input name="fuel_type" value={vehicleForm.fuel_type} onChange={handleVehicleFormChange} placeholder="Fuel type" />
            <button className="vehicle-action-btn rent" type="submit" disabled={actionLoading === 'add-marketplace'}>
              {actionLoading === 'add-marketplace' ? 'Adding...' : 'Add To Marketplace'}
            </button>
          </form>
        </section>

        <div className="vehicle-filter-row">
          <label htmlFor="vehicle-type-filter">Vehicle type</label>
          <select
            id="vehicle-type-filter"
            value={vehicleTypeFilter}
            onChange={(event) => setVehicleTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            {availableVehicleTypes.map((type) => (
              <option key={type} value={type}>
                {toTitleCase(type)}
              </option>
            ))}
          </select>
        </div>

        <section className="vehicle-section">
          <h3>My Listings</h3>
          {myListings.length > 0 ? (
            <div className="vehicle-list-grid">
              {myListings.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  actionLabel={null}
                  actionClass="rent"
                  onAction={null}
                  onEdit={() => handleOpenEditModal(vehicle)}
                  disabled={Boolean(actionLoading)}
                  loading={false}
                />
              ))}
            </div>
          ) : (
            <p className="vehicle-empty">You have no marketplace listings yet.</p>
          )}
        </section>

        <section className="vehicle-section">
          <h3>Available Vehicles</h3>
          {loading ? (
            <p className="vehicle-empty">Loading available vehicles...</p>
          ) : availableVehicles.length > 0 ? (
            <div className="vehicle-list-grid">
              {availableVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  actionLabel="Rent this vehicle"
                  actionClass="rent"
                  onAction={() => handleRent(vehicle)}
                  disabled={Boolean(actionLoading)}
                  loading={actionLoading === `rent:${vehicle.id}`}
                />
              ))}
            </div>
          ) : (
            <p className="vehicle-empty">No vehicles are available right now.</p>
          )}
        </section>
      </div>

      {showPaymentModal && selectedVehicleForPayment && (
        <div className="payment-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vehicle-payment-modal-title">
          <div className="payment-modal">
            <h3 id="vehicle-payment-modal-title">Authorize Payment</h3>
            <p>
              Confirm payment for {selectedVehicleTitle}. We will authorize{' '}
              {formatCurrency(selectedVehicleForPayment.daily_rate)} for the first day.
            </p>

            <div className="payment-method-panel">
              <label htmlFor="vehicle-payment-method-select">Payment Method</label>
              <select
                id="vehicle-payment-method-select"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                disabled={actionLoading === `rent:${selectedVehicleForPayment.id}`}
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
                className="vehicle-action-btn cancel"
                type="button"
                onClick={() => {
                  setShowPaymentModal(false)
                  setSelectedVehicleForPayment(null)
                }}
                disabled={actionLoading === `rent:${selectedVehicleForPayment.id}`}
              >
                Cancel
              </button>
              <button
                className="vehicle-action-btn rent"
                type="button"
                onClick={handleConfirmRent}
                disabled={actionLoading === `rent:${selectedVehicleForPayment.id}`}
              >
                {actionLoading === `rent:${selectedVehicleForPayment.id}` ? 'Authorizing payment...' : 'Authorize and Rent Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editVehicleForm && (
        <div className="payment-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vehicle-edit-modal-title">
          <div className="payment-modal vehicle-edit-modal">
            <h3 id="vehicle-edit-modal-title">Update Marketplace Listing</h3>
            <form className="marketplace-edit-form" onSubmit={handleSaveVehicleUpdate}>
              <input
                name="vehicle_type"
                value={editVehicleForm.vehicle_type}
                onChange={handleEditFormChange}
                placeholder="Vehicle type"
                required
              />
              <input name="make" value={editVehicleForm.make} onChange={handleEditFormChange} placeholder="Make" required />
              <input name="model" value={editVehicleForm.model} onChange={handleEditFormChange} placeholder="Model" required />
              <input
                name="year"
                type="number"
                min="2000"
                max="2100"
                value={editVehicleForm.year}
                onChange={handleEditFormChange}
                required
              />
              <input
                name="daily_rate"
                type="number"
                min="1"
                step="0.5"
                value={editVehicleForm.daily_rate}
                onChange={handleEditFormChange}
                required
              />
              <input name="color" value={editVehicleForm.color} onChange={handleEditFormChange} placeholder="Color" />
              <input
                name="transmission"
                value={editVehicleForm.transmission}
                onChange={handleEditFormChange}
                placeholder="Transmission"
              />
              <input
                name="seats"
                type="number"
                min="1"
                value={editVehicleForm.seats}
                onChange={handleEditFormChange}
                required
              />
              <input
                name="fuel_type"
                value={editVehicleForm.fuel_type}
                onChange={handleEditFormChange}
                placeholder="Fuel type"
              />

              <div className="payment-modal-actions">
                <button
                  className="vehicle-action-btn cancel"
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingVehicleId('')
                    setEditVehicleForm(null)
                  }}
                  disabled={actionLoading === 'update-marketplace'}
                >
                  Cancel
                </button>
                <button className="vehicle-action-btn edit" type="submit" disabled={actionLoading === 'update-marketplace'}>
                  {actionLoading === 'update-marketplace' ? 'Saving...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default VehicleRentalFlow