const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const MONTREAL_VIEWBOX = '-73.9,45.4,-73.4,45.7'

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Location lookup failed.')
  }

  return response.json()
}

export function toSearchLocation(result) {
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    searchType: 'address',
    label: result.display_name || '',
  }
}

export async function fetchLocationSuggestions(query, { limit = 12, bounded = 1 } = {}) {
  const baseUrl =
    `${NOMINATIM_SEARCH_URL}?format=jsonv2&q=${encodeURIComponent(query)}&viewbox=${MONTREAL_VIEWBOX}&bounded=${bounded}&limit=${limit}&countrycodes=ca`

  const boundedResults = await fetchJson(baseUrl)
  if (boundedResults.length > 0 || !/^\d+/.test(query.trim())) {
    return boundedResults
  }

  return fetchJson(
    `${NOMINATIM_SEARCH_URL}?format=jsonv2&q=${encodeURIComponent(`${query} Montreal Laval`)}&limit=${limit}&countrycodes=ca`
  )
}

export async function geocodeLocationAddress(address) {
  const results = await fetchJson(
    `${NOMINATIM_SEARCH_URL}?format=jsonv2&q=${encodeURIComponent(address)}`
  )

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Address not found. Please try another search.')
  }

  return toSearchLocation(results[0])
}

export async function reverseLookupLocation(lat, lng) {
  const payload = await fetchJson(
    `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${lat}&lon=${lng}`
  )

  return payload.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          searchType: 'geolocation',
          label: 'Current location',
        })
      },
      () => {
        reject(new Error('Unable to access your location. Please enable location services.'))
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    )
  })
}
