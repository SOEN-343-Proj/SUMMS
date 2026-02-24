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
  const searchCacheRef = useRef(new Map())

  // Fetch nearby parking spots from backend
  const getNearbyParkingSpots = async (lat, lng) => {
    const roundedLat = Number(lat).toFixed(3)
    const roundedLng = Number(lng).toFixed(3)
    const cacheKey = `${roundedLat}:${roundedLng}:1`
    const cachedSpots = searchCacheRef.current.get(cacheKey)

    if (cachedSpots) {
      setError(null)
      setParkingSpots(cachedSpots)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:8000/parking/nearest?lat=${lat}&lng=${lng}&radius=1`)
      if (!response.ok) throw new Error('Failed to fetch parking spots')
      const data = await response.json()
      const spots = data.spots || []
      setParkingSpots(spots)

      if (searchCacheRef.current.size >= 50) {
        const oldestKey = searchCacheRef.current.keys().next().value
        if (oldestKey) {
          searchCacheRef.current.delete(oldestKey)
        }
      }
      searchCacheRef.current.set(cacheKey, spots)
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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '© OpenStreetMap contributors © CARTO',
      }).addTo(mapInstanceRef.current)
    }
  }, [])

  useEffect(() => {
    if (!searchLocation || !mapInstanceRef.current) return

    mapInstanceRef.current.setView([searchLocation.lat, searchLocation.lng], 15)
    getNearbyParkingSpots(searchLocation.lat, searchLocation.lng)
  }, [searchLocation])

  useEffect(() => {
    if (!mapInstanceRef.current) return

    // If no search location, clear markers and return
    if (!searchLocation) {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      return
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    const markerBounds = [[searchLocation.lat, searchLocation.lng]]

    // Add searched location marker
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
      .addTo(mapInstanceRef.current)
    markersRef.current.push(userMarker)

    // Show 1km search radius
    const radiusCircle = L.circle([searchLocation.lat, searchLocation.lng], {
      radius: 1000,
      color: '#3b82f6',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
    }).addTo(mapInstanceRef.current)
    markersRef.current.push(radiusCircle)

    // Add parking spot pings
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
        .addTo(mapInstanceRef.current)

      markersRef.current.push(marker)
    })

    mapInstanceRef.current.fitBounds(markerBounds, {
      padding: [40, 40],
      maxZoom: 16,
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
