import { useEffect, useRef, useState } from 'react'
import '../styles/ParkingSearch.css'

const MONTREAL_VIEWBOX = '-73.9,45.4,-73.4,45.7'

async function fetchJson(url) {
  const response = await fetch(url)
  return response.json()
}

async function fetchSuggestions(query) {
  const baseUrl =
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`

  const boundedResults = await fetchJson(
    `${baseUrl}&viewbox=${MONTREAL_VIEWBOX}&bounded=1&limit=12&countrycodes=ca`
  )

  if (boundedResults.length > 0 || !/^\d+/.test(query.trim())) {
    return boundedResults
  }

  return fetchJson(`${baseUrl}%20Montreal%20Laval&limit=12&countrycodes=ca`)
}

async function geocodeAddress(address) {
  const results = await fetchJson(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
  )

  if (results.length === 0) {
    throw new Error('Address not found. Please try another search.')
  }

  const { lat, lon } = results[0]
  return {
    lat: parseFloat(lat),
    lng: parseFloat(lon),
    searchType: 'address',
  }
}

function LocationSearchModal({
  title,
  addressTitle = 'Enter Address',
  submitLabel = 'Search',
  onSearch,
  onClose,
}) {
  const [searchType, setSearchType] = useState(null)
  const [address, setAddress] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const debounceTimerRef = useRef(null)

  useEffect(() => {
    if (searchType !== 'address' || !address.trim()) {
      return undefined
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true)
        const results = await fetchSuggestions(address)
        setSuggestions(results)
      } catch (err) {
        console.error(err)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 150)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [address, searchType])

  const visibleSuggestions = searchType === 'address' && isInputFocused && suggestions.length > 0

  const handleSuggestionClick = (suggestion) => {
    setAddress(suggestion.display_name)
    setSuggestions([])
    setIsInputFocused(false)
    onSearch({
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      searchType: 'address',
    })
  }

  const handleUseCurrentLocation = () => {
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
        console.error(err)
        setError('Unable to access your location. Please enable location services.')
        setLoading(false)
      }
    )
  }

  const handleAddressSubmit = async (e) => {
    e.preventDefault()

    if (!address.trim()) {
      setError('Please enter an address.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuggestions([])
      setIsInputFocused(false)
      onSearch(await geocodeAddress(address))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (searchType === null) {
    return (
      <div className="parking-search-overlay">
        <div className="parking-search-modal">
          <div className="search-header">
            <h2>{title}</h2>
            <button className="close-btn" onClick={onClose}>
              X
            </button>
          </div>

          <div className="search-options">
            <button className="search-option-btn" onClick={handleUseCurrentLocation} disabled={loading}>
              <span>Use My Current Location</span>
              {loading && <span className="spinner"></span>}
            </button>

            <div className="divider">OR</div>

            <button
              className="search-option-btn"
              onClick={() => setSearchType('address')}
              disabled={loading}
            >
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
            Back
          </button>
          <h2>{addressTitle}</h2>
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>

        <form onSubmit={handleAddressSubmit} className="address-form">
          <div className="address-input-wrapper">
            <input
              type="text"
              placeholder="e.g., 1000 Rue Saint-Antoine, Montreal"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setTimeout(() => setIsInputFocused(false), 100)}
              autoFocus
            />

            {visibleSuggestions && (
              <div className="suggestions-dropdown">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.place_id ?? suggestion.display_name}-${index}`}
                    className="suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="suggestion-text">
                      <div className="suggestion-main">{suggestion.display_name}</div>
                    </div>
                  </div>
                ))}
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
            {loading ? 'Searching...' : submitLabel}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  )
}

export default LocationSearchModal
