import { requestApiJson } from './api'

export function toSearchLocation(result) {
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    searchType: 'address',
    label: result.display_name || '',
  }
}

export async function fetchLocationSuggestions(query, { limit = 12, bounded = 1 } = {}) {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 3) {
    return []
  }

  const params = new URLSearchParams({
    query: normalizedQuery,
    limit: String(limit),
    bounded: bounded ? 'true' : 'false',
  })
  const payload = await requestApiJson(`/maps/address-suggestions?${params.toString()}`)
  return Array.isArray(payload.suggestions) ? payload.suggestions : []
}

export async function geocodeLocationAddress(address) {
  const payload = await requestApiJson(`/maps/geocode?address=${encodeURIComponent(address)}`)
  if (!payload?.location) {
    throw new Error('Address not found. Please try another search.')
  }

  return toSearchLocation(payload.location)
}

export async function reverseLookupLocation(lat, lng) {
  const payload = await requestApiJson(`/maps/reverse-geocode?lat=${lat}&lng=${lng}`)

  return payload.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
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
