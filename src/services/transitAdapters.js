const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const MONTREAL_VIEWBOX = '-73.95,45.39,-73.4,45.72'

class NominatimAddressAdapter {
  async searchAddress(query) {
    const results = await this.#fetchSearchResults(query, 1)
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('Address not found. Try a more specific location.')
    }

    const match = results[0]
    return {
      lat: Number(match.lat),
      lng: Number(match.lon),
      label: match.display_name || query,
    }
  }

  async fetchAddressSuggestions(query) {
    const results = await this.#fetchSearchResults(query, 8)
    return Array.isArray(results) ? results : []
  }

  async reverseLookup(lat, lng) {
    const response = await fetch(
      `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error('Unable to look up this point on the map.')
    }

    const payload = await response.json()
    return payload.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }

  async #fetchSearchResults(query, limit) {
    const response = await fetch(
      `${NOMINATIM_SEARCH_URL}?format=jsonv2&limit=${limit}&q=${encodeURIComponent(query)}&viewbox=${MONTREAL_VIEWBOX}&bounded=0&countrycodes=ca`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    if (!response.ok) {
      const message = limit === 1
        ? 'Unable to find that address right now.'
        : 'Unable to load address suggestions right now.'
      throw new Error(message)
    }

    return response.json()
  }
}

class BackendTransitDirectionsAdapter {
  async fetchRoutes(origin, destination) {
    const response = await fetch(
      `${API_BASE_URL}/transit/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
    )

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null)
      throw new Error(errorPayload?.detail || 'Transit directions could not be loaded.')
    }

    const payload = await response.json()
    return Array.isArray(payload.routes) ? payload.routes : []
  }
}

export const addressLookupAdapter = new NominatimAddressAdapter()
export const transitDirectionsAdapter = new BackendTransitDirectionsAdapter()
