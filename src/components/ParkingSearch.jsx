import { useState, useEffect, useRef } from 'react'
import '../styles/ParkingSearch.css'

function ParkingSearch({ onSearch, onClose }) {
  const [searchType, setSearchType] = useState(null)
  const [address, setAddress] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceTimerRef = useRef(null)

  // Fetch suggestions from Nominatim API using bounding box for Montreal/Laval area
  useEffect(() => {
    if (!address.trim() || searchType !== 'address') {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer for debouncing (150ms for snappier response)
    debounceTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true)
        // Bounding box for Montreal/Laval area
        // Format: minlon,minlat,maxlon,maxlat
        const viewbox = '-73.9,45.4,-73.4,45.7'
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&viewbox=${viewbox}&bounded=1&limit=12&countrycodes=ca`
        )
        const data = await response.json()
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
        setLoading(false)
      } catch (err) {
        console.error(err)
        setSuggestions([])
        setLoading(false)
      }
    }, 150) // Wait 150ms after user stops typing

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [address, searchType])

  // Geocode address using OpenStreetMap Nominatim API
  const geocodeAddress = async (addressString) => {
    try {
      setLoading(true)
      setError('')
      setSuggestions([])
      setShowSuggestions(false)

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}`
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

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    const { lat, lon, display_name } = suggestion
    setAddress(display_name)
    setSuggestions([])
    setShowSuggestions(false)
    onSearch({ lat: parseFloat(lat), lng: parseFloat(lon), searchType: 'address' })
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
          <div className="address-input-wrapper">
            <input
              type="text"
              placeholder="e.g., 1000 Rue Saint-Antoine, Montreal"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onFocus={() => address.trim() && suggestions.length > 0 && setShowSuggestions(true)}
              autoFocus
            />
            
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.flatMap((suggestion, index) => {
                  // Parse the display name for better formatting
                  const parts = suggestion.display_name.split(',')
                  let addressPart = parts[0].trim()
                  const city = parts[1]?.trim()
                  
                  // Check if address has a range (e.g., "9132;9134;9136;9138")
                  let addresses = []
                  if (addressPart.includes(';')) {
                    addresses = addressPart.split(';').map(num => num.trim())
                  } else {
                    addresses = [addressPart]
                  }
                  
                  // Create a suggestion for each address in the range
                  return addresses.map((addr, addrIndex) => (
                    <div
                      key={`${index}-${addrIndex}`}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick({
                        ...suggestion,
                        display_name: city ? `${addr}, ${city}${suggestion.display_name.includes(',') ? suggestion.display_name.substring(suggestion.display_name.indexOf(',') + city.length + 1) : ''}` : addr
                      })}
                    >
                      <span className="suggestion-icon">📍</span>
                      <div className="suggestion-text">
                        <div className="suggestion-main">{city ? `${addr}, ${city}` : addr}</div>
                      </div>
                    </div>
                  ))
                })}
              </div>
            )}

            {loading && (
              <div className="suggestions-dropdown">
                <div className="suggestion-loading">
                  <span className="spinner-small"></span> Searching...
                </div>
              </div>
            )}
          </div>
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
