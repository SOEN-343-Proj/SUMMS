import '../styles/ParkingSearch.css'
import { useLocationSearchController } from '../controllers/useLocationSearchController'

function UberBixiSearch({ onSearch, onClose }) {
  const {
    searchType,
    address,
    suggestions,
    loading,
    error,
    showSuggestions,
    setAddress,
    setShowSuggestions,
    setSearchType,
    handleSuggestionClick,
    handleUseCurrentLocation,
    handleAddressSubmit,
  } = useLocationSearchController({ onSearch })

  if (searchType === null) {
    return (
      <div className="parking-search-overlay">
        <div className="parking-search-modal">
          <div className="search-header">
            <h2>Find Uber</h2>
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

export default UberBixiSearch
