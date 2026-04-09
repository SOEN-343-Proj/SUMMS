import { useState } from 'react'

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
    vehicle.vehicle_source === 'personal'
      ? 'Status: Personal vehicle'
      : vehicle.vehicle_source === 'rented'
        ? 'Status: Active rental'
        : null,
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

function VehicleCard({ vehicle, actionLabel, actionClass, onAction, onEdit, menuActions = [], disabled, loading }) {
  const metadata = buildVehicleMeta(vehicle)
  const showRate = vehicle.vehicle_source !== 'personal'
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const hasMenuActions = menuActions.length > 0

  const handleMenuAction = (callback) => {
    setShowActionsMenu(false)
    if (callback) {
      callback()
    }
  }

  return (
    <div className="vehicle-card">
      <div className="vehicle-card-header">
        <h4>
          {buildVehicleTitle(vehicle)}
        </h4>
        <div className="vehicle-card-header-actions">
          {showRate && <span className="vehicle-rate">{formatCurrency(vehicle.daily_rate)}/day</span>}
          {hasMenuActions && (
            <div className="vehicle-card-menu">
              <button
                className="vehicle-card-menu-toggle"
                type="button"
                aria-label={`Manage ${buildVehicleTitle(vehicle)}`}
                aria-haspopup="menu"
                aria-expanded={showActionsMenu}
                onClick={() => setShowActionsMenu((current) => !current)}
                disabled={disabled || loading}
              >
                ...
              </button>
              {showActionsMenu && (
                <div className="vehicle-card-menu-panel" role="menu">
                  {menuActions.map((action) => (
                    <button
                      key={`${vehicle.id}-${action.label}`}
                      className={`vehicle-card-menu-item ${action.tone || ''}`.trim()}
                      type="button"
                      role="menuitem"
                      onClick={() => handleMenuAction(action.onClick)}
                      disabled={disabled || loading}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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
    vehicleDestination,
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
    editingVehicleSource,
    setPaymentMethod,
    setVehicleTypeFilter,
    setVehicleDestination,
    setShowPaymentModal,
    setSelectedVehicleForPayment,
    setShowEditModal,
    setEditingVehicleId,
    setEditingVehicleSource,
    setEditVehicleForm,
    handleRent,
    handleConfirmRent,
    handleReturn,
    handleVehicleFormChange,
    handleAutofillFromVin,
    handleAddVehicle,
    handleOpenEditModal,
    handleEditFormChange,
    handleRemoveVehicle,
    handleSaveVehicleUpdate,
  } = useVehicleRentalController({ user })

  const selectedVehicleTitle = selectedVehicleForPayment ? buildVehicleTitle(selectedVehicleForPayment) : ''
  const addActionLoading =
    actionLoading === 'add-marketplace' || actionLoading === 'add-my-vehicles'
  const vinActionLoading = actionLoading === 'decode-vin'
  const addSectionTitle = vehicleDestination === 'my_vehicles' ? 'Add Vehicle To My Vehicles' : 'Add Vehicle To Marketplace'
  const addSubmitLabel = vehicleDestination === 'my_vehicles' ? 'Add To My Vehicles' : 'Add To Marketplace'
  const isEditingMarketplaceVehicle = editingVehicleSource === 'marketplace'
  const editActionLoading = actionLoading === `update:${editingVehicleId}`

  return (
    <div className="parking-map-container vehicle-rental-container">
      <div className="parking-map-header vehicle-rental-header">
        <div>
          <h2>Vehicle Management</h2>
          <p>Manage your garage, update marketplace listings, and browse vehicles that are available to rent.</p>
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
                  actionLabel={vehicle.vehicle_source === 'rented' ? 'Return this vehicle' : null}
                  actionClass="return"
                  onAction={vehicle.vehicle_source === 'rented' ? () => handleReturn(vehicle) : null}
                  menuActions={vehicle.vehicle_source === 'personal'
                    ? [
                        {
                          label: 'Edit vehicle',
                          onClick: () => handleOpenEditModal(vehicle),
                        },
                        {
                          label: 'Remove vehicle',
                          tone: 'danger',
                          onClick: () => handleRemoveVehicle(vehicle),
                        },
                      ]
                    : []}
                  disabled={Boolean(actionLoading)}
                  loading={
                    actionLoading === `return:${vehicle.id}`
                    || actionLoading === `remove:${vehicle.id}`
                    || actionLoading === `update:${vehicle.id}`
                  }
                />
              ))}
            </div>
          ) : (
            <p className="vehicle-empty">You have no vehicles in your garage yet.</p>
          )}
        </section>

        <section className="vehicle-section marketplace-add-section">
          <h3>{addSectionTitle}</h3>
          <div className="vehicle-destination-toggle" role="tablist" aria-label="Vehicle add destination">
            <button
              type="button"
              className={`vehicle-destination-btn ${vehicleDestination === 'marketplace' ? 'active' : ''}`}
              onClick={() => setVehicleDestination('marketplace')}
            >
              Marketplace
            </button>
            <button
              type="button"
              className={`vehicle-destination-btn ${vehicleDestination === 'my_vehicles' ? 'active' : ''}`}
              onClick={() => setVehicleDestination('my_vehicles')}
            >
              My Vehicles
            </button>
          </div>
          <p className="vehicle-section-copy">
            {vehicleDestination === 'my_vehicles'
              ? 'Save a vehicle directly to your garage without listing it for rent.'
              : 'Create a vehicle listing that other users can rent from the marketplace.'}
          </p>
          <form className="marketplace-add-form" onSubmit={handleAddVehicle}>
            <div className="vehicle-vin-row">
              <input
                name="vin"
                value={vehicleForm.vin}
                onChange={handleVehicleFormChange}
                placeholder="VIN (17 characters)"
                maxLength="17"
              />
              <button
                className="vehicle-action-btn secondary"
                type="button"
                onClick={handleAutofillFromVin}
                disabled={vinActionLoading || addActionLoading}
              >
                {vinActionLoading ? 'Decoding VIN...' : 'Auto-fill from VIN'}
              </button>
            </div>
            <p className="vehicle-form-hint">
              Optional. Use a 17-character VIN to auto-fill vehicle details from NHTSA.
            </p>
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
              min="1900"
              max="2100"
              value={vehicleForm.year}
              onChange={handleVehicleFormChange}
              required
            />
            {vehicleDestination === 'marketplace' && (
              <input
                name="daily_rate"
                type="number"
                min="1"
                step="0.5"
                value={vehicleForm.daily_rate}
                onChange={handleVehicleFormChange}
                placeholder="Daily rate"
                required
              />
            )}
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
            <button className="vehicle-action-btn rent" type="submit" disabled={addActionLoading}>
              {addActionLoading ? 'Adding...' : addSubmitLabel}
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
            <h3 id="vehicle-edit-modal-title">
              {isEditingMarketplaceVehicle ? 'Update Marketplace Listing' : 'Update Vehicle'}
            </h3>
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
                min="1900"
                max="2100"
                value={editVehicleForm.year}
                onChange={handleEditFormChange}
                required
              />
              {isEditingMarketplaceVehicle && (
                <input
                  name="daily_rate"
                  type="number"
                  min="1"
                  step="0.5"
                  value={editVehicleForm.daily_rate}
                  onChange={handleEditFormChange}
                  required
                />
              )}
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
                    setEditingVehicleSource('marketplace')
                    setEditVehicleForm(null)
                  }}
                  disabled={editActionLoading}
                >
                  Cancel
                </button>
                <button className="vehicle-action-btn edit" type="submit" disabled={editActionLoading}>
                  {editActionLoading ? 'Saving...' : 'Save Updates'}
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
