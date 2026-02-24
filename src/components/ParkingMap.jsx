import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../styles/ParkingMap.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Mock parking data for Montreal/Laval area
const MOCK_PARKING_SPOTS = [
  { id: 1, lat: 45.5017, lng: -73.5673, name: 'Downtown Montreal Garage', available: 12, total: 50 },
  { id: 2, lat: 45.4973, lng: -73.5724, name: 'Old Port Parking', available: 3, total: 30 },
  { id: 3, lat: 45.5089, lng: -73.5628, name: 'McGill Lot', available: 25, total: 100 },
  { id: 4, lat: 45.5210, lng: -73.5834, name: 'Outremont Parking', available: 18, total: 40 },
  { id: 5, lat: 45.6055, lng: -73.5465, name: 'Laval Downtown', available: 8, total: 35 },
  { id: 6, lat: 45.4210, lng: -73.4724, name: 'South Shore Lot', available: 35, total: 80 },
]

function ParkingMap({ searchLocation, onClose, searchType }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [parkingSpots, setParkingSpots] = useState([])
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

  // Filter parking spots within 5km of search location
  const getNearbyParkingSpots = (lat, lng) => {
    return MOCK_PARKING_SPOTS.filter((spot) => {
      const distance = calculateDistance(lat, lng, spot.lat, spot.lng)
      return distance <= 5
    }).sort((a, b) => {
      const distA = calculateDistance(lat, lng, a.lat, a.lng)
      const distB = calculateDistance(lat, lng, b.lat, b.lng)
      return distA - distB
    })
  }

  useEffect(() => {
    if (!mapRef.current || !searchLocation) return

    // Initialize map
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([searchLocation.lat, searchLocation.lng], 14)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current)
    } else {
      mapInstanceRef.current.setView([searchLocation.lat, searchLocation.lng], 14)
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Get nearby parking spots
    const nearbySpots = getNearbyParkingSpots(searchLocation.lat, searchLocation.lng)
    setParkingSpots(nearbySpots)

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
    nearbySpots.forEach((spot) => {
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
  }, [searchLocation])

  return (
    <div className="parking-map-container">
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
      </div>
    </div>
  )
}

export default ParkingMap
