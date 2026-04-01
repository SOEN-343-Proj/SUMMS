const BIXI_INFO_URL = 'https://gbfs.velobixi.com/gbfs/2-2/en/station_information.json'
const BIXI_STATUS_URL = 'https://gbfs.velobixi.com/gbfs/2-2/en/station_status.json'

function toRadians(deg) {
  return (deg * Math.PI) / 180
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

export function buildUberWebLink(searchLocation) {
  const params = new URLSearchParams()
  params.set('action', 'setPickup')

  if (searchLocation) {
    params.set('pickup[latitude]', searchLocation.lat)
    params.set('pickup[longitude]', searchLocation.lng)
  }

  return `https://m.uber.com/ul/?${params.toString()}`
}

export async function fetchNearbyUberBixiStations(lat, lng, limit = 25) {
  const [infoRes, statusRes] = await Promise.all([
    fetch(BIXI_INFO_URL),
    fetch(BIXI_STATUS_URL),
  ])

  if (!infoRes.ok) throw new Error('BIXI station_information fetch failed')
  if (!statusRes.ok) throw new Error('BIXI station_status fetch failed')

  const infoJson = await infoRes.json()
  const statusJson = await statusRes.json()
  const infoList = infoJson?.data?.stations || []
  const statusList = statusJson?.data?.stations || []
  const statusById = new Map(statusList.map((station) => [String(station.station_id), station]))

  const merged = infoList.map((station) => {
    const id = String(station.station_id)
    const liveStatus = statusById.get(id)
    const stationLat = Number(station.lat)
    const stationLng = Number(station.lon)
    const distance = haversineKm(lat, lng, stationLat, stationLng)

    return {
      id,
      name: station.name,
      lat: stationLat,
      lng: stationLng,
      address: station.address,
      capacity: station.capacity,
      isInstalled: liveStatus?.is_installed,
      isRenting: liveStatus?.is_renting,
      isReturning: liveStatus?.is_returning,
      bikesAvailable: liveStatus?.num_bikes_available,
      docksAvailable: liveStatus?.num_docks_available,
      distance_km: Number(distance.toFixed(2)),
    }
  })

  merged.sort((first, second) => first.distance_km - second.distance_km)
  return merged.slice(0, limit)
}
