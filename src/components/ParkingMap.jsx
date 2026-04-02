import { useEffect, useRef } from 'react'
import L from 'leaflet'
import '../styles/ParkingMap.css'
import ParkingSearch from './ParkingSearch'
import LeafletMap from './LeafletMap'
import { useParkingController } from '../controllers/useParkingController'

function ParkingMap({ onClose }) {
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const { searchLocation, parkingSpots, loading, error, setSearchLocation } = useParkingController()

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !searchLocation) return

    map.setView([searchLocation.lat, searchLocation.lng], 15)
  }, [searchLocation])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (!searchLocation) {
      markersRef.current.forEach((layer) => layer.remove())
      markersRef.current = []
      return
    }

    markersRef.current.forEach((layer) => layer.remove())
    markersRef.current = []

    const markerBounds = [[searchLocation.lat, searchLocation.lng]]

    const userMarker = L.marker([searchLocation.lat, searchLocation.lng], {
      icon: L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      }),
    })
      .bindPopup('<strong>Searched Location</strong>')
      .addTo(map)
    markersRef.current.push(userMarker)

    const radiusCircle = L.circle([searchLocation.lat, searchLocation.lng], {
      radius: 1000,
      color: '#3b82f6',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
    }).addTo(map)
    markersRef.current.push(radiusCircle)

    parkingSpots.forEach((spot) => {
      markerBounds.push([spot.lat, spot.lng])

      const marker = L.circleMarker([spot.lat, spot.lng], {
        radius: 10,
        fillColor: '#22c55e',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${spot.name}</strong><br/>
          ${spot.address || 'Address unavailable'}<br/>
          ${spot.distance_km ? `${spot.distance_km} km away` : ''}`
        )
        .addTo(map)

      markersRef.current.push(marker)
    })

    map.fitBounds(markerBounds, { padding: [40, 40], maxZoom: 16 })
  }, [searchLocation, parkingSpots])

  return (
    <div className="parking-map-container">
      {!searchLocation && (
        <ParkingSearch
          onSearch={setSearchLocation}
          onClose={onClose}
        />
      )}

      <div className="parking-map-header">
        <h2>Find Parking Near You</h2>
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
            <h3>Available Parking Spots ({parkingSpots.length})</h3>
            {loading && <p className="spot-info">Searching nearby parking...</p>}
            {error && <p className="no-spots">{error}</p>}
            {parkingSpots.length > 0 ? (
              <div className="spots-scroll">
                {parkingSpots.map((spot) => (
                  <div key={spot.id} className="spot-card available">
                    <div className="spot-header">
                      <h4>{spot.name}</h4>
                      <span className="badge available">
                        {spot.distance_km ? `${spot.distance_km} km` : 'Parking'}
                      </span>
                    </div>
                    <p className="spot-info">{spot.address || 'Address unavailable'}</p>
                  </div>
                ))}
              </div>
            ) : (
              !loading && <p className="no-spots">No parking spots found within 1km</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ParkingMap
