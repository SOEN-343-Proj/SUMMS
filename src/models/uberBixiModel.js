export function buildUberWebLink(searchLocation) {
  const params = new URLSearchParams()
  params.set('action', 'setPickup')

  if (searchLocation) {
    params.set('pickup[latitude]', searchLocation.lat)
    params.set('pickup[longitude]', searchLocation.lng)
  }

  return `https://m.uber.com/ul/?${params.toString()}`
}
