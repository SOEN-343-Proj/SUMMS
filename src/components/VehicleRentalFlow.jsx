import '../styles/ParkingMap.css'
import '../styles/VehicleRentalFlow.css'
import { useVehicleRentalController } from '../controllers/useVehicleRentalController'

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
  const {
    availableVehicles,
    myListings,
    userVehicles,
    paymentMethods,
    paymentMethod,
    vehicleTypeFilter,
    showPaymentModal,
    selectedVehicleForPayment,
    showEditModal,
    editingVehicleId,
    editVehicleForm,
    loading,
    actionLoading,
    error,
    notice,
    vehicleForm,
    selectedPaymentOption,
    samplePaymentInfo,
    availableVehicleTypes,
    setPaymentMethod,
    setVehicleTypeFilter,
    setShowPaymentModal,
    setSelectedVehicleForPayment,
    setShowEditModal,
    setEditingVehicleId,
    setEditVehicleForm,
    handleRent,
    handleConfirmRent,
    handleReturn,
    handleVehicleFormChange,
    handleAddVehicle,
    handleOpenEditModal,
    handleEditFormChange,
    handleSaveVehicleUpdate,
  } = useVehicleRentalController({ user })

  const selectedVehicleTitle = selectedVehicleForPayment ? buildVehicleTitle(selectedVehicleForPayment) : ''

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
