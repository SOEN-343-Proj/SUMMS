import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import '../styles/BixiRentalFlow.css'
import LeafletMap from './LeafletMap'
import LocationSearchModal from './LocationSearchModal'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

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

function BixiRentalFlow({ user, onClose }) {
  const mapInstanceRef = useRef(null)
  const layersRef = useRef([])

  const [activePage, setActivePage] = useState('rental')
  const [searchLocation, setSearchLocation] = useState(null)
  const [stations, setStations] = useState([])
  const [openRental, setOpenRental] = useState(null)
  const [history, setHistory] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [selectedStationId, setSelectedStationId] = useState('')
  const [loadingState, setLoadingState] = useState(true)
  const [loadingStations, setLoadingStations] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const nearbyAvailableBikes = stations.reduce((sum, station) => sum + station.bikes_available, 0)
  const nearbyAvailableDocks = stations.reduce((sum, station) => sum + station.docks_available, 0)
  const selectedStation = stations.find((station) => station.id === selectedStationId) || null
  const isReserved = openRental?.status === 'reserved'
  const isActive = openRental?.status === 'active'

  const loadStations = async (location) => {
    if (!location) {
      setStations([])
      setSelectedStationId('')
      return
    }

    setLoadingStations(true)
    try {
      const query = new URLSearchParams({
        lat: String(location.lat),
        lng: String(location.lng),
        limit: '12',
        radius: '3',
      })
      const data = await requestJson(`${API_BASE_URL}/bixi/stations/nearby?${query.toString()}`)
      const nextStations = data.stations || []
      setStations(nextStations)
      setSelectedStationId((current) => {
        if (current && nextStations.some((station) => station.id === current)) {
          return current
        }
        return nextStations[0]?.id || ''
      })
    } catch (err) {
      setError(err.message)
      setStations([])
    } finally {
      setLoadingStations(false)
    }
  }

  const loadDashboardData = async () => {
    const query = new URLSearchParams({
      user_email: user.email,
      history_limit: '5',
    })

    const [stateData, analyticsData] = await Promise.all([
      requestJson(`${API_BASE_URL}/bixi/rentals/state?${query.toString()}`),
      requestJson(`${API_BASE_URL}/bixi/analytics/summary`),
    ])

    setOpenRental(stateData.open_rental)
    setHistory(stateData.history || [])
    setAnalytics(analyticsData)

    if (!searchLocation && stateData.open_rental?.pickup_station) {
      setSearchLocation({
        lat: stateData.open_rental.pickup_station.lat,
        lng: stateData.open_rental.pickup_station.lng,
        searchType: 'saved-rental',
      })
    }

    return stateData
  }

  const refreshAfterAction = async () => {
    const stateData = await loadDashboardData()
    const locationToUse =
      searchLocation ||
      (stateData.open_rental?.pickup_station
        ? {
            lat: stateData.open_rental.pickup_station.lat,
            lng: stateData.open_rental.pickup_station.lng,
            searchType: 'saved-rental',
          }
        : null)

    if (locationToUse) {
      await loadStations(locationToUse)
    }
  }

  useEffect(() => {
    let ignore = false

    const initialize = async () => {
      setLoadingState(true)
      setError('')
      try {
        const query = new URLSearchParams({
          user_email: user.email,
          history_limit: '5',
        })

        const [stateData, analyticsData] = await Promise.all([
          requestJson(`${API_BASE_URL}/bixi/rentals/state?${query.toString()}`),
          requestJson(`${API_BASE_URL}/bixi/analytics/summary`),
        ])

        if (ignore) {
          return
        }

        setOpenRental(stateData.open_rental)
        setHistory(stateData.history || [])
        setAnalytics(analyticsData)

        if (stateData.open_rental?.pickup_station) {
          setSearchLocation({
            lat: stateData.open_rental.pickup_station.lat,
            lng: stateData.open_rental.pickup_station.lng,
            searchType: 'saved-rental',
          })
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      } finally {
        if (!ignore) {
          setLoadingState(false)
        }
      }
    }

    initialize()

    return () => {
      ignore = true
    }
  }, [user.email])

  useEffect(() => {
    if (!searchLocation) {
      setStations([])
      setSelectedStationId('')
      return
    }

    let ignore = false

    const fetchStations = async () => {
      try {
        setLoadingStations(true)
        const query = new URLSearchParams({
          lat: String(searchLocation.lat),
          lng: String(searchLocation.lng),
          limit: '12',
          radius: '3',
        })
        const data = await requestJson(`${API_BASE_URL}/bixi/stations/nearby?${query.toString()}`)
        if (ignore) {
          return
        }

        const nextStations = data.stations || []
        setStations(nextStations)
        setSelectedStationId((current) => {
          if (current && nextStations.some((station) => station.id === current)) {
            return current
          }
          return nextStations[0]?.id || ''
        })
      } catch (err) {
        if (!ignore) {
          setError(err.message)
        }
      } finally {
        if (!ignore) {
          setLoadingStations(false)
        }
      }
    }

    fetchStations()

    return () => {
      ignore = true
    }
  }, [searchLocation])

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
      const data = await requestJson(`${API_BASE_URL}/bixi/rentals/reserve`, {
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

      setOpenRental(data.rental)
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
      const data = await requestJson(`${API_BASE_URL}/bixi/rentals/${openRental.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: user.email,
        }),
      })

      setOpenRental(data.rental)
      setNotice('Payment authorized. Your BIXI rental is now active.')
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
    <div className="bixi-rental-container">
      {!searchLocation && (
        <LocationSearchModal
          title="Find BIXI Rental Stations"
          addressTitle="Enter pickup area"
          submitLabel="Search stations"
          onSearch={setSearchLocation}
          onClose={onClose}
        />
      )}

      <div className="bixi-rental-header">
        <div>
          <h2>BIXI Rental Pipeline</h2>
          <p>Search stations, reserve a bike, simulate payment, and return it in one flow.</p>
        </div>

        <div className="bixi-rental-header-actions">
          <button
            className="header-btn"
            type="button"
            onClick={() => {
              setNotice('')
              setError('')
              setSearchLocation(null)
            }}
          >
            Search another area
          </button>
          <button className="header-close-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="bixi-rental-content">
        <div className="bixi-rental-map-wrapper">
          <LeafletMap
            className="bixi-rental-map"
            onMapReady={(map) => {
              mapInstanceRef.current = map
            }}
          />
        </div>

        <aside className="bixi-rental-sidebar">
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
              <section className="summary-grid compact">
                <div className="summary-card">
                  <span>Nearby Bikes</span>
                  <strong>{nearbyAvailableBikes}</strong>
                </div>
                <div className="summary-card">
                  <span>Nearby Docks</span>
                  <strong>{nearbyAvailableDocks}</strong>
                </div>
              </section>

              {openRental ? (
                <section className="rental-card">
                  <div className={`flow-status ${openRental.status}`}>{openRental.status}</div>
                  <h3>Open Rental</h3>
                  <p>
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
                        onClick={handlePay}
                        disabled={actionLoading === 'pay'}
                      >
                        {actionLoading === 'pay'
                          ? 'Authorizing payment...'
                          : `Authorize ${formatCurrency(4.25)} and unlock bike`}
                      </button>
                    </div>
                  )}

                  {isActive && (
                    <div className="flow-actions">
                      <button
                        className="flow-btn secondary"
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
                <section className="empty-state">
                  <h3>No Open Rental</h3>
                  <p>Select a station below to reserve a BIXI bike and start the rental flow.</p>
                </section>
              )}

              {selectedStation && (
                <section className="selection-card">
                  <h3>Selected Station</h3>
                  <h4>{selectedStation.name}</h4>
                  <p>{selectedStation.address || 'Address unavailable'}</p>
                  <div className="station-badges">
                    <span className="station-badge bikes">{selectedStation.bikes_available} bikes</span>
                    <span className="station-badge docks">{selectedStation.docks_available} docks</span>
                    <span className="station-badge distance">{selectedStation.distance_km} km</span>
                  </div>
                </section>
              )}

              <section className="station-list-card">
                <h3>{isActive ? 'Return Stations' : 'Pickup Stations'}</h3>
                <p>
                  {isActive
                    ? 'Choose any nearby station with free docks to complete the ride.'
                    : 'Reserve from a station that still has at least one bike available.'}
                </p>

                {loadingStations ? (
                  <p className="loading-copy">Loading nearby BIXI stations...</p>
                ) : stations.length > 0 ? (
                  <div className="station-list">
                    {stations.map((station) => (
                      <div
                        key={station.id}
                        className={`station-card ${selectedStationId === station.id ? 'selected' : ''}`}
                      >
                        <div className="station-card-header">
                          <h4>{station.name}</h4>
                          <div className="station-badges">
                            <span className="station-badge bikes">{station.bikes_available} bikes</span>
                            <span className="station-badge docks">{station.docks_available} docks</span>
                            <span className="station-badge distance">{station.distance_km} km</span>
                          </div>
                        </div>

                        <p>{station.address || 'Address unavailable'}</p>

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
                  <p>No stations found for the selected area.</p>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="insights-intro-card">
                <h3>Rental Insights</h3>
                <p>Analytics and your recent BIXI ride history are grouped here to keep the main rental page focused on actions.</p>
              </section>

              <section className="summary-grid">
                <div className="summary-card">
                  <span>Total Rentals</span>
                  <strong>{analytics?.total_rentals ?? 0}</strong>
                </div>
                <div className="summary-card">
                  <span>Money Spent</span>
                  <strong>{formatCurrency(analytics?.total_revenue ?? 0)}</strong>
                </div>
                <div className="summary-card">
                  <span>Completed</span>
                  <strong>{analytics?.completed_rentals ?? 0}</strong>
                </div>
                <div className="summary-card">
                  <span>Average Duration</span>
                  <strong>{analytics?.average_duration_minutes ?? 0} min</strong>
                </div>
              </section>

              <section className="history-card">
                <h3>Recent Rental History</h3>
                <p>Last completed BIXI rides for this user.</p>

                {history.length > 0 ? (
                  <div className="history-list">
                    {history.map((rental) => (
                      <div key={rental.id} className="history-item">
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
                  <p>No completed BIXI rentals yet.</p>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

export default BixiRentalFlow
