import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../styles/ParkingMap.css'
import ParkingSearch from './ParkingSearch'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function ParkingMap({ onClose }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [searchLocation, setSearchLocation] = useState(null)
  const [parkingSpots, setParkingSpots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const markersRef = useRef([])

  // Calculate distance between two points (in km)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Fetch nearby parking spots from backend
  const getNearbyParkingSpots = async (lat, lng) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:8000/parking/nearest?lat=${lat}&lng=${lng}&radius=5`)
      if (!response.ok) throw new Error('Failed to fetch parking spots')
      const data = await response.json()
      setParkingSpots(data.spots || [])
    } catch (err) {
      setError(err.message)
      setParkingSpots([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mapRef.current) return

    // Initialize map centered on Montreal/Laval
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([45.55, -73.6], 12)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current)
    }

    // If no search location, clear markers and return
    if (!searchLocation) {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      return
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Update map view to search location
    mapInstanceRef.current.setView([searchLocation.lat, searchLocation.lng], 14)

    // Fetch nearby parking spots
    getNearbyParkingSpots(searchLocation.lat, searchLocation.lng)

    // Add user location marker
    const userMarker = L.marker([searchLocation.lat, searchLocation.lng], {
      icon: L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      }),
    })
      .bindPopup('<strong>Your Location</strong>')
      .addTo(mapInstanceRef.current)
    markersRef.current.push(userMarker)

    // Add parking spot markers
    parkingSpots.forEach((spot) => {
      const isAvailable = spot.available > 0
      const markerColor = isAvailable ? 'green' : 'red'

      const marker = L.circleMarker([spot.lat, spot.lng], {
        radius: 12,
        fillColor: markerColor,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup(
          `<strong>${spot.name}</strong><br/>
          Available: ${spot.available}/${spot.total}<br/>
          ${isAvailable ? '✓ Spots Available' : '✗ Full'}`
        )
        .addTo(mapInstanceRef.current)

      markersRef.current.push(marker)
    })
  }, [searchLocation, parkingSpots])

  return (
    <div className="parking-map-container">
      {!searchLocation && (
        <ParkingSearch
          onSearch={(location) => setSearchLocation(location)}
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
          <div ref={mapRef} className="parking-map"></div>
        </div>

        {searchLocation && (
          <div className="parking-spots-list">
            <h3>Available Parking Spots ({parkingSpots.length})</h3>
            {parkingSpots.length > 0 ? (
              <div className="spots-scroll">
                {parkingSpots.map((spot) => (
                  <div key={spot.id} className={`spot-card ${spot.available > 0 ? 'available' : 'full'}`}>
                    <div className="spot-header">
                      <h4>{spot.name}</h4>
                      <span className={`badge ${spot.available > 0 ? 'available' : 'full'}`}>
                        {spot.available > 0 ? `${spot.available} Available` : 'Full'}
                      </span>
                    </div>
                    <p className="spot-info">{spot.available} of {spot.total} spaces available</p>
                    <div className="spot-bar">
                      <div className="spot-used" style={{ width: `${((spot.total - spot.available) / spot.total) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-spots">No parking spots found nearby</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ParkingMap
