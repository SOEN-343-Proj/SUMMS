import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import '../styles/ParkingMap.css'
import '../styles/BixiRentalFlow.css'
import LeafletMap from './LeafletMap'
import LocationSearchModal from './LocationSearchModal'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const HISTORY_LIMIT = '5'
const STATION_SEARCH_LIMIT = '12'
const STATION_SEARCH_RADIUS = '3'
const PAYMENT_AUTHORIZATION_AMOUNT = 4.25
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
  if (amount === null || amount === undefined) {
    return 'Pending'
  }

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

function formatTimestamp(value) {
  if (!value) {
    return 'Not available'
  }

  return new Date(value).toLocaleString()
}

function getSavedLocation(rental) {
  if (!rental?.pickup_station) {
    return null
  }

  return {
    lat: rental.pickup_station.lat,
    lng: rental.pickup_station.lng,
    searchType: 'saved-rental',
  }
}

function buildStationSearchQuery(location) {
  return new URLSearchParams({
    lat: String(location.lat),
    lng: String(location.lng),
    limit: STATION_SEARCH_LIMIT,
    radius: STATION_SEARCH_RADIUS,
  })
}

function buildMockPaymentDetails(method, user) {
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

function SummaryGrid({ cards, compact = false }) {
  return (
    <section className={`summary-grid ${compact ? 'compact' : ''}`}>
      {cards.map((card) => (
        <div key={card.label} className="summary-card">
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </div>
      ))}
    </section>
  )
}

function StationBadges({ station }) {
  return (
    <div className="station-badges">
      <span className="badge bikes">{station.bikes_available} bikes</span>
      <span className="badge docks">{station.docks_available} docks</span>
      <span className="badge distance">{station.distance_km} km</span>
    </div>
  )
}

function BixiRentalFlow({ user, onClose }) {
  const mapInstanceRef = useRef(null)
  const layersRef = useRef([])

  const [activePage, setActivePage] = useState('rental')
  const [searchLocation, setSearchLocation] = useState(null)
  const [stations, setStations] = useState([])
  const [openRental, setOpenRental] = useState(null)
  const [history, setHistory] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS)
  const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHODS[0].id)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedStationId, setSelectedStationId] = useState('')
  const [loadingState, setLoadingState] = useState(true)
  const [loadingStations, setLoadingStations] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedStation = stations.find((station) => station.id === selectedStationId) || null
  const nearbyAvailableBikes = stations.reduce((sum, station) => sum + station.bikes_available, 0)
  const nearbyAvailableDocks = stations.reduce((sum, station) => sum + station.docks_available, 0)
  const isReserved = openRental?.status === 'reserved'
  const isActive = openRental?.status === 'active'

  const rentalCards = [
    { label: 'Nearby Bikes', value: nearbyAvailableBikes },
    { label: 'Nearby Docks', value: nearbyAvailableDocks },
  ]

  const insightCards = [
    { label: 'Total Rentals', value: analytics?.total_rentals ?? 0 },
    { label: 'Money Spent', value: formatCurrency(analytics?.total_revenue ?? 0) },
    { label: 'Completed', value: analytics?.completed_rentals ?? 0 },
    { label: 'Average Duration', value: `${analytics?.average_duration_minutes ?? 0} min` },
  ]

  const selectedPaymentOption =
    paymentMethods.find((method) => method.id === paymentMethod) || DEFAULT_PAYMENT_METHODS[0]
  const mockPaymentDetails = buildMockPaymentDetails(paymentMethod, user)
  const samplePaymentInfo = buildSamplePaymentInfo(paymentMethod, user)

  const applyStations = (nextStations) => {
    setStations(nextStations)
    setSelectedStationId((current) => {
      if (current && nextStations.some((station) => station.id === current)) {
        return current
      }

      return nextStations[0]?.id || ''
    })
  }

  const loadStations = async (location) => {
    if (!location) {
      applyStations([])
      return
    }

    setLoadingStations(true)
    setError('')

    try {
      const query = buildStationSearchQuery(location)
      const data = await requestJson(`${API_BASE_URL}/bixi/stations/nearby?${query.toString()}`)
      applyStations(data.stations || [])
    } catch (err) {
      setError(err.message)
      applyStations([])
    } finally {
      setLoadingStations(false)
    }
  }

  const loadDashboardData = async () => {
    const query = new URLSearchParams({
      user_email: user.email,
      history_limit: HISTORY_LIMIT,
    })

    const [stateData, analyticsData] = await Promise.all([
      requestJson(`${API_BASE_URL}/bixi/rentals/state?${query.toString()}`),
      requestJson(`${API_BASE_URL}/bixi/analytics/summary`),
    ])

    setOpenRental(stateData.open_rental)
    setHistory(stateData.history || [])
    setAnalytics(analyticsData)

    const savedLocation = getSavedLocation(stateData.open_rental)
    if (!searchLocation && savedLocation) {
      setSearchLocation(savedLocation)
    }

    return savedLocation
  }

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

  const refreshAfterAction = async () => {
    const savedLocation = await loadDashboardData()
    const locationToUse = searchLocation || savedLocation

    if (locationToUse) {
      await loadStations(locationToUse)
    }
  }

  useEffect(() => {
    const initialize = async () => {
      setLoadingState(true)
      setError('')

      try {
        await Promise.all([loadDashboardData(), loadPaymentMethods()])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoadingState(false)
      }
    }

    initialize()
  }, [user.email])

  useEffect(() => {
    loadStations(searchLocation)
  }, [searchLocation])

  useEffect(() => {
    if (!isReserved) {
      setShowPaymentModal(false)
    }
  }, [isReserved])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) {
      return
    }

    layersRef.current.forEach((layer) => layer.remove())
    layersRef.current = []

    if (!searchLocation) {
      return
    }

    const bounds = [[searchLocation.lat, searchLocation.lng]]

    const searchMarker = L.marker([searchLocation.lat, searchLocation.lng])
      .bindPopup('<strong>Search area</strong>')
      .addTo(map)
    layersRef.current.push(searchMarker)

    const searchRadius = L.circle([searchLocation.lat, searchLocation.lng], {
      radius: 3000,
      color: '#3b82f6',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.06,
    }).addTo(map)
    layersRef.current.push(searchRadius)

    stations.forEach((station) => {
      bounds.push([station.lat, station.lng])

      let fillColor = '#64748b'
      if (openRental?.pickup_station?.id === station.id) {
        fillColor = '#f59e0b'
      } else if (selectedStationId === station.id) {
        fillColor = '#a3e635'
      } else if (isActive && station.can_return) {
        fillColor = '#22c55e'
      } else if (!openRental && station.can_rent) {
        fillColor = '#2563eb'
      }

      const marker = L.circleMarker([station.lat, station.lng], {
        radius: 10,
        fillColor,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${station.name}</strong><br/>Bikes: ${station.bikes_available}<br/>Docks: ${station.docks_available}<br/>${station.distance_km} km away`
        )
        .addTo(map)

      marker.on('click', () => {
        setSelectedStationId(station.id)
      })

      layersRef.current.push(marker)
    })

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [searchLocation, stations, selectedStationId, openRental, isActive])

  const handleReserve = async (station) => {
    setActionLoading(`reserve:${station.id}`)
    setError('')
    setNotice('')

    try {
      await requestJson(`${API_BASE_URL}/bixi/rentals/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          user_name: user.name,
          station_id: station.id,
        }),
      })

      setNotice(`Bike reserved at ${station.name}. Complete payment to unlock it.`)
      await refreshAfterAction()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handlePay = async () => {
    if (!openRental) {
      return
    }

    setActionLoading('pay')
    setError('')
    setNotice('')

    try {
      await requestJson(`${API_BASE_URL}/bixi/rentals/${openRental.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          payment_method: paymentMethod,
          payment_details: mockPaymentDetails,
        }),
      })

      setNotice(`Payment authorized with ${selectedPaymentOption.name}. Your BIXI rental is now active.`)
      setShowPaymentModal(false)
      await refreshAfterAction()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleReturn = async (station) => {
    if (!openRental) {
      return
    }

    setActionLoading(`return:${station.id}`)
    setError('')
    setNotice('')

    try {
      const data = await requestJson(`${API_BASE_URL}/bixi/rentals/${openRental.id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
          return_station_id: station.id,
        }),
      })

      setOpenRental(null)
      setNotice(
        `Ride returned at ${station.name}. Final charge: ${formatCurrency(data.rental?.payment?.final_cost)}.`
      )
      await refreshAfterAction()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const focusStation = (station) => {
    setSelectedStationId(station.id)
    const map = mapInstanceRef.current
    if (map) {
      map.setView([station.lat, station.lng], 15)
    }
  }

  return (
    <div className="parking-map-container bixi-rental-container">
      {!searchLocation && (
        <LocationSearchModal
          title="Find BIXI Rental Stations"
          addressTitle="Enter pickup area"
          submitLabel="Search stations"
          onSearch={setSearchLocation}
          onClose={onClose}
        />
      )}

      <div className="parking-map-header bixi-rental-header">
        <div>
          <h2>BIXI Rental Pipeline</h2>
          <p>Search stations, reserve a bike, simulate payment, and return it in one flow.</p>
        </div>

        <div className="bixi-rental-header-actions">
          <button
            className="station-action-btn secondary header-btn"
            type="button"
            onClick={() => {
              setNotice('')
              setError('')
              setSearchLocation(null)
            }}
          >
            Search another area
          </button>
          <button className="close-btn" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="parking-map-content">
        <div className="map-wrapper">
          <LeafletMap
            className="parking-map"
            onMapReady={(map) => {
              mapInstanceRef.current = map
            }}
          />
        </div>

        <aside className="parking-spots-list bixi-rental-sidebar">
          {loadingState && <p className="loading-copy">Loading BIXI rental data...</p>}
          {notice && <div className="notice-banner">{notice}</div>}
          {error && <div className="error-banner">{error}</div>}

          <div className="sidebar-page-switcher" role="tablist" aria-label="BIXI rental pages">
            <button
              className={`sidebar-page-btn ${activePage === 'rental' ? 'active' : ''}`}
              type="button"
              onClick={() => setActivePage('rental')}
            >
              Rental
            </button>
            <button
              className={`sidebar-page-btn ${activePage === 'insights' ? 'active' : ''}`}
              type="button"
              onClick={() => setActivePage('insights')}
            >
              Insights
            </button>
          </div>

          {activePage === 'rental' ? (
            <>
              <SummaryGrid cards={rentalCards} compact />

              {openRental ? (
                <section className="summary-card rental-card">
                  <div className={`flow-status ${openRental.status}`}>{openRental.status}</div>
                  <h3>Open Rental</h3>
                  <p className="spot-info">
                    Pickup station: <strong>{openRental.pickup_station.name}</strong>
                  </p>

                  <div className="flow-meta">
                    <div>
                      Reserved at <strong>{formatTimestamp(openRental.reserved_at)}</strong>
                    </div>
                    <div>
                      Payment status <strong>{openRental.payment.status}</strong>
                    </div>
                    {openRental.started_at && (
                      <div>
                        Ride started <strong>{formatTimestamp(openRental.started_at)}</strong>
                      </div>
                    )}
                    {openRental.started_at && (
                      <div>
                        Current duration <strong>{openRental.duration_minutes} minute(s)</strong>
                      </div>
                    )}
                  </div>

                  {isReserved && (
                    <div className="flow-actions">
                      <button
                        className="flow-btn primary"
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        disabled={actionLoading === 'pay'}
                      >
                        {`Pay ${formatCurrency(PAYMENT_AUTHORIZATION_AMOUNT)} and unlock bike`}
                      </button>
                    </div>
                  )}

                  {isActive && (
                    <div className="flow-actions">
                      <button
                        className="station-action-btn secondary"
                        type="button"
                        onClick={() =>
                          focusStation({
                            ...openRental.pickup_station,
                            distance_km: 0,
                          })
                        }
                      >
                        Focus pickup station
                      </button>
                    </div>
                  )}
                </section>
              ) : (
                <section className="summary-card empty-state">
                  <h3>No Open Rental</h3>
                  <p className="spot-info">
                    Select a station below to reserve a BIXI bike and start the rental flow.
                  </p>
                </section>
              )}

              {selectedStation && (
                <section className="summary-card selection-card">
                  <h3>Selected Station</h3>
                  <h4>{selectedStation.name}</h4>
                  <p className="spot-info">{selectedStation.address || 'Address unavailable'}</p>
                  <StationBadges station={selectedStation} />
                </section>
              )}

              <section className="summary-card station-list-card">
                <h3>{isActive ? 'Return Stations' : 'Pickup Stations'}</h3>
                <p className="spot-info">
                  {isActive
                    ? 'Choose any nearby station with free docks to complete the ride.'
                    : 'Reserve from a station that still has at least one bike available.'}
                </p>

                {loadingStations ? (
                  <p className="loading-copy">Loading nearby BIXI stations...</p>
                ) : stations.length > 0 ? (
                  <div className="spots-scroll station-list">
                    {stations.map((station) => (
                      <div
                        key={station.id}
                        className={`spot-card station-card ${selectedStationId === station.id ? 'selected' : ''}`}
                      >
                        <div className="spot-header station-card-header">
                          <h4>{station.name}</h4>
                          <StationBadges station={station} />
                        </div>

                        <p className="spot-info">{station.address || 'Address unavailable'}</p>

                        <div className="station-actions">
                          <button
                            className="station-action-btn secondary"
                            type="button"
                            onClick={() => focusStation(station)}
                          >
                            Show on map
                          </button>

                          {!openRental && (
                            <button
                              className="station-action-btn reserve"
                              type="button"
                              onClick={() => handleReserve(station)}
                              disabled={!station.can_rent || Boolean(actionLoading)}
                            >
                              {actionLoading === `reserve:${station.id}` ? 'Reserving...' : 'Reserve bike'}
                            </button>
                          )}

                          {isActive && (
                            <button
                              className="station-action-btn return"
                              type="button"
                              onClick={() => handleReturn(station)}
                              disabled={!station.can_return || Boolean(actionLoading)}
                            >
                              {actionLoading === `return:${station.id}` ? 'Returning...' : 'Return bike here'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-spots">No stations found for the selected area.</p>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="summary-card insights-intro-card">
                <h3>Rental Insights</h3>
                <p className="spot-info">
                  Analytics and your recent BIXI ride history are grouped here to keep the main rental page focused on actions.
                </p>
              </section>

              <SummaryGrid cards={insightCards} />

              <section className="summary-card history-card">
                <h3>Recent Rental History</h3>
                <p className="spot-info">Last completed BIXI rides for this user.</p>

                {history.length > 0 ? (
                  <div className="spots-scroll history-list">
                    {history.map((rental) => (
                      <div key={rental.id} className="spot-card history-item">
                        <strong>
                          {rental.pickup_station.name} to {rental.return_station?.name || 'Unknown station'}
                        </strong>
                        <span>Returned: {formatTimestamp(rental.returned_at)}</span>
                        <span>Duration: {rental.duration_minutes} minute(s)</span>
                        <span>Final cost: {formatCurrency(rental.payment.final_cost)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-spots">No completed BIXI rentals yet.</p>
                )}
              </section>
            </>
          )}
        </aside>
      </div>

      {showPaymentModal && isReserved && (
        <div className="payment-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
          <div className="payment-modal">
            <h3 id="payment-modal-title">Authorize Payment</h3>
            <p>
              Choose a payment strategy and authorize {formatCurrency(PAYMENT_AUTHORIZATION_AMOUNT)} to start this BIXI ride.
            </p>

            <div className="payment-method-panel">
              <label htmlFor="payment-method-select">Payment Method</label>
              <select
                id="payment-method-select"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                disabled={actionLoading === 'pay'}
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
                className="station-action-btn secondary"
                type="button"
                onClick={() => setShowPaymentModal(false)}
                disabled={actionLoading === 'pay'}
              >
                Cancel
              </button>
              <button className="flow-btn primary" type="button" onClick={handlePay} disabled={actionLoading === 'pay'}>
                {actionLoading === 'pay' ? 'Authorizing payment...' : 'Authorize and Start Ride'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BixiRentalFlow
