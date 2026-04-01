import { useEffect, useRef } from 'react'
import L from 'leaflet'
import '../styles/ParkingMap.css'
import UberBixiSearch from './UberBixiSearch'
import LeafletMap from './LeafletMap'
import { useUberBixiController } from '../controllers/useUberBixiController'

function UberBixiMap({ onClose }) {
  const mapInstanceRef = useRef(null)
  const layersRef = useRef([])
  const {
    searchLocation,
    loading,
    error,
    bixiStations,
    setSearchLocation,
    runSearch,
    requestUberFromSearchLocation,
  } = useUberBixiController()

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !searchLocation) return

    map.setView([searchLocation.lat, searchLocation.lng], 15)
    runSearch(searchLocation.lat, searchLocation.lng)
  }, [searchLocation])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (!searchLocation) {
      layersRef.current.forEach((layer) => layer.remove())
      layersRef.current = []
      return
    }

    layersRef.current.forEach((layer) => layer.remove())
    layersRef.current = []

    const bounds = [[searchLocation.lat, searchLocation.lng]]

    const userMarker = L.marker([searchLocation.lat, searchLocation.lng])
      .bindPopup('<strong>Searched Location</strong>')
      .addTo(map)
    layersRef.current.push(userMarker)

    const radiusCircle = L.circle([searchLocation.lat, searchLocation.lng], {
      radius: 1000,
      color: '#3b82f6',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
    }).addTo(map)
    layersRef.current.push(radiusCircle)

    bixiStations.forEach((station) => {
      bounds.push([station.lat, station.lng])

      const marker = L.circleMarker([station.lat, station.lng], {
        radius: 10,
        fillColor: '#2563eb',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${station.name || 'BIXI Station'}</strong><br/>
          Bikes: ${station.bikesAvailable ?? '?'} / Docks: ${station.docksAvailable ?? '?'}<br/>
          ${station.distance_km ? `${station.distance_km} km away` : ''}`
        )
        .addTo(map)

      layersRef.current.push(marker)
    })

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    }
  }, [searchLocation, bixiStations])

  return (
    <div className="parking-map-container">
      {!searchLocation && (
        <UberBixiSearch
          onSearch={setSearchLocation}
          onClose={onClose}
        />
      )}

      <div className="parking-map-header">
        <h2>Find Uber / BIXI Near You</h2>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
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

        {searchLocation && (
          <div className="parking-spots-list">
            <h3>Results</h3>

            {loading && (
              <p className="spot-info">Searching nearby mobility options...</p>
            )}
            {error && <p className="no-spots">{error}</p>}

            {!loading && !error && (
              <>
                <div>
                  <h4 style={{ margin: 0 }}>Uber</h4>

                  <button
                    className="search-option-btn"
                    style={{ marginTop: 8 }}
                    onClick={requestUberFromSearchLocation}
                  >
                    Request Uber from this location
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>
                    BIXI Stations ({bixiStations.length})
                  </h4>
                  {bixiStations.length > 0 ? (
                    <div className="spots-scroll">
                      {bixiStations.map((station) => (
                        <div
                          key={station.id ?? `${station.lat}:${station.lng}`}
                          className="spot-card available"
                        >
                          <div className="spot-header">
                            <h4>{station.name || 'BIXI Station'}</h4>
                            <span className="badge available">
                              {station.distance_km ? `${station.distance_km} km` : 'BIXI'}
                            </span>
                          </div>
                          <p className="spot-info">
                            Bikes: {station.bikesAvailable ?? '?'} | Docks: {station.docksAvailable ?? '?'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-spots">No BIXI stations found nearby</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UberBixiMap
