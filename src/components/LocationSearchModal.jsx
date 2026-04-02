import '../styles/ParkingSearch.css'
import { useLocationSearchController } from '../controllers/useLocationSearchController'

function renderSuggestionMain(suggestion) {
  const parts = String(suggestion.display_name || '').split(',')
  return parts.slice(0, 2).join(',').trim() || suggestion.display_name
}

function renderSuggestionSecondary(suggestion) {
  const parts = String(suggestion.display_name || '').split(',')
  return parts.slice(2).join(',').trim()
}

function LocationSearchModal({
  title,
  addressTitle = 'Enter Address',
  submitLabel = 'Search',
  onSearch,
  onClose,
}) {
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
            <h2>{title}</h2>
            <button className="close-btn" type="button" onClick={onClose}>
              X
            </button>
          </div>

          <div className="search-options">
            <button className="search-option-btn" type="button" onClick={handleUseCurrentLocation} disabled={loading}>
              <span>Use My Current Location</span>
              {loading && <span className="spinner"></span>}
            </button>

            <div className="divider">OR</div>

            <button
              className="search-option-btn"
              type="button"
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
          <button className="back-btn" type="button" onClick={() => setSearchType(null)}>
            Back
          </button>
          <h2>{addressTitle}</h2>
          <button className="close-btn" type="button" onClick={onClose}>
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
              onFocus={() => address.trim() && suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              autoFocus
            />

            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.place_id ?? suggestion.display_name}-${index}`}
                    className="suggestion-item"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleSuggestionClick(suggestion)
                    }}
                  >
                    <div className="suggestion-text">
                      <div className="suggestion-main">{renderSuggestionMain(suggestion)}</div>
                      {renderSuggestionSecondary(suggestion) && (
                        <div className="suggestion-secondary">{renderSuggestionSecondary(suggestion)}</div>
                      )}
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
