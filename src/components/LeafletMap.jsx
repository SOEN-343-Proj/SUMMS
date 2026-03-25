import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const DEFAULT_TILE_OPTIONS = {
  subdomains: 'abcd',
  maxZoom: 20,
  attribution: '© OpenStreetMap contributors © CARTO',
}

// Fix default marker icons (global once)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function LeafletMap({
  className,
  initialCenter = [45.55, -73.6],
  initialZoom = 12,
  tileUrl = DEFAULT_TILE_URL,
  tileOptions = DEFAULT_TILE_OPTIONS,
  onMapReady,
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const onMapReadyRef = useRef(onMapReady)

  useEffect(() => {
    onMapReadyRef.current = onMapReady
  }, [onMapReady])

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstanceRef.current) return

    const map = L.map(mapRef.current).setView(initialCenter, initialZoom)

    L.tileLayer(tileUrl, tileOptions).addTo(map)

    mapInstanceRef.current = map

    if (onMapReadyRef.current) {
      onMapReadyRef.current(map)
    }

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [initialCenter, initialZoom, tileUrl, tileOptions])

  return <div ref={mapRef} className={className}></div>
}

export default LeafletMap
