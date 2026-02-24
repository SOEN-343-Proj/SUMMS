import { useState } from 'react'
import '../styles/ParkingSearch.css'

function ParkingSearch({ onSearch, onClose }) {
  const [searchType, setSearchType] = useState(null)
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Geocode address using OpenStreetMap Nominatim API
  const geocodeAddress = async (addressString) => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString + ', Montreal, Quebec')}`
      )
      const data = await response.json()

      if (data.length === 0) {
        setError('Address not found. Please try another search.')
        setLoading(false)
        return
      }

      const { lat, lon } = data[0]
      onSearch({ lat: parseFloat(lat), lng: parseFloat(lon), searchType: 'address' })
    } catch (err) {
      setError('Error searching for address. Please try again.')
      console.error(err)
      setLoading(false)
    }
  }

  // Use geolocation API
  const handleUseCurrentLocation = async () => {
    setLoading(true)
    setError('')

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        onSearch({ lat: latitude, lng: longitude, searchType: 'geolocation' })
        setLoading(false)
      },
      (err) => {
        setError('Unable to access your location. Please enable location services.')
        console.error(err)
        setLoading(false)
      }
    )
  }

  const handleAddressSubmit = (e) => {
    e.preventDefault()
    if (!address.trim()) {
      setError('Please enter an address.')
      return
    }
    geocodeAddress(address)
  }

  if (searchType === null) {
    return (
      <div className="parking-search-overlay">
        <div className="parking-search-modal">
          <div className="search-header">
            <h2>Find Parking</h2>
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="search-options">
            <button
              className="search-option-btn"
              onClick={() => handleUseCurrentLocation()}
              disabled={loading}
            >
              <span className="icon">📍</span>
              <span>Use My Current Location</span>
              {loading && <span className="spinner"></span>}
            </button>

            <div className="divider">OR</div>

            <button
              className="search-option-btn"
              onClick={() => setSearchType('address')}
              disabled={loading}
            >
              <span className="icon">🔍</span>
              <span>Search by Address</span>
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="parking-search-overlay">
      <div className="parking-search-modal">
        <div className="search-header">
          <button className="back-btn" onClick={() => setSearchType(null)}>
            ← Back
          </button>
          <h2>Enter Address</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleAddressSubmit} className="address-form">
          <input
            type="text"
            placeholder="e.g., 1000 Rue Saint-Antoine, Montreal"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={loading || !address.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  )
}

export default ParkingSearch
