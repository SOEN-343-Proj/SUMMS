import { requestApiJson } from './api'

export function fetchNearbyParking({ lat, lng, radius = 1, address }) {
  const query = new URLSearchParams()

  if (address) {
    query.set('address', address)
  } else {
    query.set('lat', String(lat))
    query.set('lng', String(lng))
  }

  query.set('radius', String(radius))

  return requestApiJson(`/parking/nearest?${query.toString()}`)
}
