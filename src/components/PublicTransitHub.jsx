import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import '../styles/PublicTransitHub.css'
import LeafletMap from './LeafletMap'
import { addressLookupAdapter, transitDirectionsAdapter } from '../services/transitAdapters'
import { trackEvent } from '../services/analytics'

const DEFAULT_CENTER = [45.5017, -73.5673]

function PublicTransitHub({ onClose }) {
  const mapInstanceRef = useRef(null)
  const routeLayersRef = useRef([])
  const originMarkerRef = useRef(null)
  const destinationMarkerRef = useRef(null)
  const originDebounceRef = useRef(null)
  const destinationDebounceRef = useRef(null)

  const [originText, setOriginText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const [originPoint, setOriginPoint] = useState(null)
  const [destinationPoint, setDestinationPoint] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [searching, setSearching] = useState(false)
  const [plannerError, setPlannerError] = useState('')
  const [routeOptions, setRouteOptions] = useState([])
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
  const [detailsRouteIndex, setDetailsRouteIndex] = useState(null)
  const [originSuggestions, setOriginSuggestions] = useState([])
  const [destinationSuggestions, setDestinationSuggestions] = useState([])
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false)
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false)
  const [loadingOriginSuggestions, setLoadingOriginSuggestions] = useState(false)
  const [loadingDestinationSuggestions, setLoadingDestinationSuggestions] = useState(false)

  const selectedRoute = routeOptions[selectedRouteIndex] ?? null

  const normalizeTransitText = (value) => String(value || '')
    .replace(/\bSubway\b/gi, 'Metro')
    .replace(/\bsubway\b/gi, 'metro')
    .replace(/\bMetro Line Line\b/gi, 'Metro Line')

  const clearOriginSuggestions = () => {
    setOriginSuggestions([])
    setShowOriginSuggestions(false)
    setLoadingOriginSuggestions(false)
  }

  const clearDestinationSuggestions = () => {
    setDestinationSuggestions([])
    setShowDestinationSuggestions(false)
    setLoadingDestinationSuggestions(false)
  }
  useEffect(() => {
    if (!originText.trim()) {
      clearOriginSuggestions()
      return undefined
    }

    if (originDebounceRef.current) {
        clearTimeout(originDebounceRef.current)
    }

    originDebounceRef.current = setTimeout(async () => {
      try {
        setLoadingOriginSuggestions(true)
        const matches = await addressLookupAdapter.fetchAddressSuggestions(originText.trim())
        setOriginSuggestions(matches)
        setShowOriginSuggestions(matches.length > 0)
      } catch {
        setOriginSuggestions([])
        setShowOriginSuggestions(false)
      } finally {
        setLoadingOriginSuggestions(false)
      }
    }, 180)

    return () => {
      if (originDebounceRef.current) {
        clearTimeout(originDebounceRef.current)
      }
    }
  }, [originText])

  useEffect(() => {
    if (!destinationText.trim()) {
      clearDestinationSuggestions()
      return undefined
    }

    if (destinationDebounceRef.current) {
      clearTimeout(destinationDebounceRef.current)
    }

    destinationDebounceRef.current = setTimeout(async () => {
      try {
        setLoadingDestinationSuggestions(true)
        const matches = await addressLookupAdapter.fetchAddressSuggestions(destinationText.trim())
        setDestinationSuggestions(matches)
        setShowDestinationSuggestions(matches.length > 0)
      } catch {
        setDestinationSuggestions([])
        setShowDestinationSuggestions(false)
      } finally {
        setLoadingDestinationSuggestions(false)
      }
    }, 180)

    return () => {
      if (destinationDebounceRef.current) {
        clearTimeout(destinationDebounceRef.current)
      }
    }
  }, [destinationText])

  useEffect(() => () => {
    if (originDebounceRef.current) {
      clearTimeout(originDebounceRef.current)
    }

    if (destinationDebounceRef.current) {
      clearTimeout(destinationDebounceRef.current)
    }
  }, [])

  const handleSuggestionSelect = (field, suggestion) => {
    const nextPoint = {
      lat: Number(suggestion.lat),
      lng: Number(suggestion.lon),
    }
    const nextLabel = suggestion.display_name || ''

    if (field === 'origin') {
      setOriginPoint(nextPoint)
      setOriginText(nextLabel)
      clearOriginSuggestions()
    } else {
      setDestinationPoint(nextPoint)
      setDestinationText(nextLabel)
      clearDestinationSuggestions()
    }

    setPlannerError('')
    setShowOriginSuggestions(false)
    setShowDestinationSuggestions(false)
    mapInstanceRef.current?.setView([nextPoint.lat, nextPoint.lng], 14)
  }

  const renderSuggestionMain = (suggestion) => {
    const parts = String(suggestion.display_name || '').split(',')
    const primary = parts.slice(0, 2).join(',').trim()
    return primary || suggestion.display_name
  }

  const renderSuggestionSecondary = (suggestion) => {
    const parts = String(suggestion.display_name || '').split(',')
    return parts.slice(2).join(',').trim()
  }

  const syncMarker = (markerRef, point, label) => {
    const map = mapInstanceRef.current
    if (!map) return

    if (!point) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    if (!markerRef.current) {
      markerRef.current = L.marker([point.lat, point.lng]).addTo(map).bindPopup(label)
      return
    }

    markerRef.current.setLatLng([point.lat, point.lng]).bindPopup(label)
  }

  const fitToRoute = (path) => {
    const map = mapInstanceRef.current
    if (!map || path.length === 0) return

    const bounds = L.latLngBounds(path.map(([lat, lng]) => [lat, lng]))
    map.fitBounds(bounds, { padding: [32, 32] })
  }

  useEffect(() => {
    syncMarker(originMarkerRef, originPoint, originText.trim() || 'Origin')
    syncMarker(destinationMarkerRef, destinationPoint, destinationText.trim() || 'Destination')
  }, [originPoint, destinationPoint, originText, destinationText])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    routeLayersRef.current.forEach((layer) => layer.remove())
    routeLayersRef.current = []

    if (!selectedRoute?.path?.length) {
      if (originPoint && destinationPoint) {
        map.fitBounds(L.latLngBounds([
          [originPoint.lat, originPoint.lng],
          [destinationPoint.lat, destinationPoint.lng],
        ]), { padding: [32, 32] })
      } else if (originPoint || destinationPoint) {
        const point = originPoint || destinationPoint
        map.setView([point.lat, point.lng], 14)
      }
      return
    }

    const outlineLayer = L.polyline(selectedRoute.path, {
      color: '#ffffff',
      weight: 10,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)

    const lineLayer = L.polyline(selectedRoute.path, {
      color: '#2d7ff9',
      weight: 6,
      opacity: 0.96,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)

    routeLayersRef.current.push(outlineLayer, lineLayer)

    fitToRoute(selectedRoute.path)
  }, [selectedRoute, originPoint, destinationPoint])

  const resetPlanner = () => {
    setOriginText('')
    setDestinationText('')
    setOriginPoint(null)
    setDestinationPoint(null)
    setSearching(false)
    setPlannerError('')
    setRouteOptions([])
    setSelectedRouteIndex(0)
    setDetailsRouteIndex(null)
    clearOriginSuggestions()
    clearDestinationSuggestions()
    mapInstanceRef.current?.setView(DEFAULT_CENTER, 11)
  }

  const getCurrentLocationPoint = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Current location is not available in this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        reject(new Error('Unable to access your current location. Please enable location access in your browser.'))
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    )
  })

  const centerMapOnPoint = (point, zoom = 15) => {
    mapInstanceRef.current?.setView([point.lat, point.lng], zoom)
  }

  const applyCurrentLocationToOrigin = async (point) => {
    setOriginPoint(point)
    clearOriginSuggestions()
    setShowOriginSuggestions(false)
    setPlannerError('')
    setOriginText('Loading current location...')
    centerMapOnPoint(point)

    try {
      const label = await addressLookupAdapter.reverseLookup(point.lat, point.lng)
      setOriginText(label)
    } catch {
      setOriginText('Current location')
    }
  }

  const handleUseCurrentLocation = async () => {
    try {
      setPlannerError('')
      const nextPoint = await getCurrentLocationPoint()
      setUserLocation(nextPoint)
      await applyCurrentLocationToOrigin(nextPoint)
    } catch (error) {
      setPlannerError(error.message)
    }
  }

  const handleRecenterToLocation = async () => {
    setPlannerError('')
    mapInstanceRef.current?.setView(DEFAULT_CENTER, 11)
  }

  const handlePlanTrip = async () => {
    let resolvedOriginPoint = originPoint
    let resolvedDestinationPoint = destinationPoint
    let resolvedOriginLabel = originText.trim()
    let resolvedDestinationLabel = destinationText.trim()

    if ((!resolvedOriginPoint && !resolvedOriginLabel) || (!resolvedDestinationPoint && !resolvedDestinationLabel)) {
      setPlannerError('Choose both a starting point and a destination.')
      return
    }

    setSearching(true)
    setPlannerError('')

    try {
      if (!resolvedOriginPoint && resolvedOriginLabel) {
        const match = await addressLookupAdapter.searchAddress(resolvedOriginLabel)
        resolvedOriginPoint = { lat: match.lat, lng: match.lng }
        resolvedOriginLabel = match.label
        setOriginPoint(resolvedOriginPoint)
        setOriginText(match.label)
        clearOriginSuggestions()
      }

      if (!resolvedDestinationPoint && resolvedDestinationLabel) {
        const match = await addressLookupAdapter.searchAddress(resolvedDestinationLabel)
        resolvedDestinationPoint = { lat: match.lat, lng: match.lng }
        resolvedDestinationLabel = match.label
        setDestinationPoint(resolvedDestinationPoint)
        setDestinationText(match.label)
        clearDestinationSuggestions()
      }

      const origin = resolvedOriginPoint
        ? `${resolvedOriginPoint.lat},${resolvedOriginPoint.lng}`
        : resolvedOriginLabel
      const destination = resolvedDestinationPoint
        ? `${resolvedDestinationPoint.lat},${resolvedDestinationPoint.lng}`
        : resolvedDestinationLabel

      const routes = await transitDirectionsAdapter.fetchRoutes(origin, destination)

      if (!routes.length) {
        throw new Error('No transit route was found for that trip. Try another origin or destination.')
      }

      setRouteOptions(routes)
      setSelectedRouteIndex(0)
      setDetailsRouteIndex(0)
      trackEvent('transit_route_searched', { origin: resolvedOriginLabel, destination: resolvedDestinationLabel, route_count: routes.length })

      const firstRoute = routes[0]
      if (firstRoute.startLocation) {
        setOriginPoint({
          lat: firstRoute.startLocation.lat,
          lng: firstRoute.startLocation.lng,
        })
      }
      if (firstRoute.startAddress) {
        setOriginText(firstRoute.startAddress)
        clearOriginSuggestions()
      }
      if (firstRoute.endLocation) {
        setDestinationPoint({
          lat: firstRoute.endLocation.lat,
          lng: firstRoute.endLocation.lng,
        })
      }
      if (firstRoute.endAddress) {
        setDestinationText(firstRoute.endAddress)
        clearDestinationSuggestions()
      }
    } catch (error) {
      setRouteOptions([])
      setPlannerError(error.message)
    } finally {
      setSearching(false)
    }
  }

  const detailsRoute = routeOptions[detailsRouteIndex ?? selectedRouteIndex] ?? null
  const detailSteps = detailsRoute?.steps ?? []

  const renderStepIcon = (step) => {
    if (step.kind === 'transit') {
      if (step.mode === 'Metro') return 'M'
      if (step.mode === 'Bus') return 'B'
      if (step.mode === 'Train') return 'T'
    }

    if (step.kind === 'walk') return 'W'
    return step.mode?.charAt(0)?.toUpperCase() || '•'
  }

  return (
    <div className="transit-planner-overlay">
      <div className="transit-planner-shell">
        <div className="transit-planner-header">
          <div>
            <p className="transit-planner-kicker">Public Transit</p>
            <h2>Plan a route with public transit directions</h2>
            <p className="transit-planner-subtitle">
              Use your current location or type addresses to plan a route with bus, metro, and walking directions.
            </p>
          </div>
          <button className="transit-planner-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="transit-planner-layout">
          <aside className="transit-planner-sidebar">
            <div className="transit-form-card">
              <div className="transit-form-intro">
                <h3>Plan your trip</h3>
                <p>Search addresses or use your current location to set your trip.</p>
              </div>

              <div className="transit-field-group">
                <div className="transit-field-head">
                  <label htmlFor="transit-origin">Starting point</label>
                  {originPoint && <span className="transit-field-badge">Pinned on map</span>}
                </div>

                <div className="transit-input-wrapper">
                  <input
                    id="transit-origin"
                    type="text"
                    value={originText}
                    onChange={(event) => {
                      setOriginText(event.target.value)
                      setPlannerError('')
                    }}
                    onFocus={() => {
                      if (originSuggestions.length > 0) {
                        setShowOriginSuggestions(true)
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setShowOriginSuggestions(false), 140)
                    }}
                    placeholder="Use your current location or type an address"
                    autoComplete="off"
                  />

                  {loadingOriginSuggestions && (
                    <div className="transit-suggestions-dropdown">
                      <div className="transit-suggestion-loading">Searching addresses...</div>
                    </div>
                  )}

                  {!loadingOriginSuggestions && showOriginSuggestions && originSuggestions.length > 0 && (
                    <div className="transit-suggestions-dropdown">
                      {originSuggestions.map((suggestion, index) => (
                        <button
                          key={`${suggestion.place_id ?? suggestion.display_name}-${index}`}
                          type="button"
                          className="transit-suggestion-item"
                          onMouseDown={() => handleSuggestionSelect('origin', suggestion)}
                        >
                          <span className="transit-suggestion-icon">📍</span>
                          <span className="transit-suggestion-text">
                            <span className="transit-suggestion-main">{renderSuggestionMain(suggestion)}</span>
                            {renderSuggestionSecondary(suggestion) && (
                              <span className="transit-suggestion-secondary">
                                {renderSuggestionSecondary(suggestion)}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="transit-action-row">
                  <button type="button" onClick={handleUseCurrentLocation}>
                    Use Current Location
                  </button>
                  <button type="button" onClick={resetPlanner}>
                    Reset Search
                  </button>
                </div>
              </div>

              <div className="transit-field-group">
                <div className="transit-field-head">
                  <label htmlFor="transit-destination">Destination</label>
                  {destinationPoint && <span className="transit-field-badge">Pinned on map</span>}
                </div>

                <div className="transit-input-wrapper">
                  <input
                    id="transit-destination"
                    type="text"
                    value={destinationText}
                    onChange={(event) => {
                      setDestinationText(event.target.value)
                      setPlannerError('')
                    }}
                    onFocus={() => {
                      if (destinationSuggestions.length > 0) {
                        setShowDestinationSuggestions(true)
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setShowDestinationSuggestions(false), 140)
                    }}
                    placeholder="Type the address you want to reach"
                    autoComplete="off"
                  />

                  {loadingDestinationSuggestions && (
                    <div className="transit-suggestions-dropdown">
                      <div className="transit-suggestion-loading">Searching addresses...</div>
                    </div>
                  )}

                  {!loadingDestinationSuggestions && showDestinationSuggestions && destinationSuggestions.length > 0 && (
                    <div className="transit-suggestions-dropdown">
                      {destinationSuggestions.map((suggestion, index) => (
                        <button
                          key={`${suggestion.place_id ?? suggestion.display_name}-${index}`}
                          type="button"
                          className="transit-suggestion-item"
                          onMouseDown={() => handleSuggestionSelect('destination', suggestion)}
                        >
                          <span className="transit-suggestion-icon">📍</span>
                          <span className="transit-suggestion-text">
                            <span className="transit-suggestion-main">{renderSuggestionMain(suggestion)}</span>
                            {renderSuggestionSecondary(suggestion) && (
                              <span className="transit-suggestion-secondary">
                                {renderSuggestionSecondary(suggestion)}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="transit-plan-actions">
                <div className="transit-plan-hint">
                  {originPoint || destinationPoint ? 'Your selected points are pinned on the map.' : 'Ready when you are.'}
                </div>
                <button type="button" className="primary transit-plan-submit" onClick={handlePlanTrip} disabled={searching}>
                  {searching ? 'Finding Transit Routes...' : 'Get Transit Directions'}
                </button>
              </div>

              {plannerError && <p className="transit-message transit-error">{plannerError}</p>}
            </div>
          </aside>

          <div className="transit-content-column">
            <div className="transit-map-panel">
              <div className="transit-map-topbar">
                <span>Transit map</span>
                <small>Use the map to explore your route and nearby area</small>
              </div>

              <div className="transit-map-frame">
                <LeafletMap
                  className="transit-google-map"
                  initialCenter={DEFAULT_CENTER}
                  initialZoom={11}
                  onMapReady={(map) => {
                    mapInstanceRef.current = map
                  }}
                />

                <button type="button" className="transit-recenter-btn" onClick={handleRecenterToLocation}>
                  Recenter
                </button>
              </div>
            </div>

            <div className="transit-results-card transit-results-panel">
              <div className="transit-results-head">
                <h3>Transit Options</h3>
                <span>{routeOptions.length ? `${routeOptions.length} routes found` : 'Waiting for a search'}</span>
              </div>

              <div className="transit-route-list">
                {routeOptions.length === 0 && (
                  <p className="transit-empty-state">
                    Search for a trip to view transit routes with walking, bus, and metro segments.
                  </p>
                )}

                {routeOptions.map((route, index) => (
                  <button
                    key={`${route.summary}-${route.departureTime}-${index}`}
                    type="button"
                    className={`transit-route-card ${selectedRouteIndex === index ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedRouteIndex(index)
                      setDetailsRouteIndex(index)
                    }}
                  >
                    <strong>{route.durationText}</strong>
                    <span>{normalizeTransitText(route.summary)}</span>
                    <small>
                      {route.departureTime}
                      {route.arrivalTime ? ` → ${route.arrivalTime}` : ''}
                    </small>
                    {route.distanceText && <small>{route.distanceText}</small>}
                  </button>
                ))}
              </div>

              {detailSteps.length > 0 && (
                <div className="transit-step-list">
                  <div className="transit-step-list-head">
                    <h4>Route Details</h4>
                    {detailsRoute && (
                      <small>
                        {detailsRoute.durationText}
                        {detailsRoute.departureTime ? ` • ${detailsRoute.departureTime}` : ''}
                        {detailsRoute.arrivalTime ? ` → ${detailsRoute.arrivalTime}` : ''}
                      </small>
                    )}
                  </div>

                  <div className="transit-route-overview">
                    <div className="transit-overview-time">
                      <strong>
                        {detailsRoute?.departureTime}
                        {detailsRoute?.arrivalTime ? ` → ${detailsRoute.arrivalTime}` : ''}
                      </strong>
                      <span>{detailsRoute?.durationText}</span>
                    </div>
                    <div className="transit-overview-chips">
                      <span className="transit-overview-chip">{normalizeTransitText(detailsRoute?.summary)}</span>
                      {detailsRoute?.distanceText && <span className="transit-overview-chip muted">{detailsRoute.distanceText}</span>}
                    </div>
                  </div>

                  <div className="transit-timeline-card">
                    <div className="transit-timeline-row">
                      <div className="transit-timeline-time">{detailsRoute?.departureTime || ''}</div>
                      <div className="transit-timeline-rail">
                        <span className="transit-timeline-node origin"></span>
                      </div>
                      <div className="transit-timeline-content">
                        <strong>{originText}</strong>
                        <small>Starting point</small>
                      </div>
                    </div>

                    {detailSteps.map((step, index) => (
                      <div key={`${step.title}-${index}`} className="transit-timeline-row segment">
                        <div className="transit-timeline-time">
                          {step.departureTime || step.arrivalTime || ''}
                        </div>
                        <div className="transit-timeline-rail">
                          <span className={`transit-timeline-node ${step.kind}`}>{renderStepIcon(step)}</span>
                          <span className={`transit-timeline-line ${step.kind}`}></span>
                        </div>
                        <div className="transit-timeline-content">
                          <div className="transit-segment-head">
                            <span className="transit-step-mode-chip">{normalizeTransitText(step.mode)}</span>
                          </div>
                          <strong>{step.kind === 'transit' ? normalizeTransitText(step.lineLabel || step.title) : normalizeTransitText(step.mode)}</strong>
                          {step.kind === 'transit' ? (
                            <>
                              {step.departureStop && <small>Board at {step.departureStop}</small>}
                              {step.arrivalStop && <small>Exit at {step.arrivalStop}</small>}
                              {step.detail && <small>{step.detail}</small>}
                            </>
                          ) : (
                            <>
                              <small>{step.title}</small>
                              {step.detail && <small>{step.detail}</small>}
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="transit-timeline-row">
                      <div className="transit-timeline-time">{detailsRoute?.arrivalTime || ''}</div>
                      <div className="transit-timeline-rail">
                        <span className="transit-timeline-node destination"></span>
                      </div>
                      <div className="transit-timeline-content">
                        <strong>{destinationText}</strong>
                        <small>Destination</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PublicTransitHub
