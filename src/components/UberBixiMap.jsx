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
    setSearchLocation,
    requestUberFromSearchLocation,
  } = useUberBixiController()

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !searchLocation) return

    map.setView([searchLocation.lat, searchLocation.lng], 15)
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
  }, [searchLocation])

  return (
    <div className="parking-map-container">
      {!searchLocation && (
        <UberBixiSearch
          onSearch={setSearchLocation}
          onClose={onClose}
        />
      )}

      <div className="parking-map-header">
        <h2>Find Uber Near You</h2>
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
            <h3>Uber</h3>
            <div className="spot-card available">
              <div className="spot-header">
                <h4>Pickup Location</h4>
                <span className="badge available">Map Ready</span>
              </div>
              <p className="spot-info">
                {searchLocation.label || `${searchLocation.lat.toFixed(5)}, ${searchLocation.lng.toFixed(5)}`}
              </p>
              <p className="spot-info">Your selected pickup area is centered on the map.</p>
            </div>

            <button
              className="search-option-btn"
              style={{ marginTop: 8 }}
              onClick={requestUberFromSearchLocation}
            >
              Request Uber from this location
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default UberBixiMap
