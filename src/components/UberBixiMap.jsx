import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import '../styles/ParkingMap.css'
import UberBixiSearch from './UberBixiSearch'
import LeafletMap from './LeafletMap'

function toRadians (deg) {
  return (deg * Math.PI) / 180
}

function haversineKm (lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

async function fetchBixiStationsMerged(lat, lng) {
  const infoUrl = 'https://gbfs.velobixi.com/gbfs/2-2/en/station_information.json'
  const statusUrl = 'https://gbfs.velobixi.com/gbfs/2-2/en/station_status.json'

  const [infoRes, statusRes] = await Promise.all([fetch(infoUrl), fetch(statusUrl)])

  if (!infoRes.ok) throw new Error('BIXI station_information fetch failed')
  if (!statusRes.ok) throw new Error('BIXI station_status fetch failed')

  const infoJson = await infoRes.json()
  const statusJson = await statusRes.json()

  const infoList = infoJson?.data?.stations || []
  const statusList = statusJson?.data?.stations || []

  const statusById = new Map(statusList.map((s) => [String(s.station_id), s]))

  const merged = infoList.map((i) => {
    const id = String(i.station_id)
    const s = statusById.get(id)

    const stationLat = Number(i.lat)
    const stationLng = Number(i.lon)
    const dist = haversineKm(lat, lng, stationLat, stationLng)

    return {
      id,
      name: i.name,
      lat: stationLat,
      lng: stationLng,
      address: i.address,
      capacity: i.capacity,

      isInstalled: s?.is_installed,
      isRenting: s?.is_renting,
      isReturning: s?.is_returning,

      bikesAvailable: s?.num_bikes_available,
      docksAvailable: s?.num_docks_available,

      distance_km: Number(dist.toFixed(2)),
    }
  })

  merged.sort((a, b) => a.distance_km - b.distance_km)

  return merged
}

function UberBixiMap({ onClose }) {
  const mapInstanceRef = useRef(null)
  const layersRef = useRef([])

  const [searchLocation, setSearchLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [bixiStations, setBixiStations] = useState([])
  const [uberOptions, setUberOptions] = useState([])

async function fetchBixiStations(lat, lng)
{
  const stations = await fetchBixiStationsMerged(lat, lng);
  return stations.slice(0, 25);
}

async function runSearch(lat, lng){
  setLoading(true);
  setError(null);

  try {
    const stations = await fetchBixiStations(lat, lng);
    setBixiStations(stations);
    // keep Uber for later
    setUberOptions([]);
  }
  catch (e)
  {
    setError(e && e.message ? e.message : 'Search failed');
    setBixiStations([]);
    setUberOptions([]);
  }
  finally
  {
    setLoading(false);
  }
}

  async function fetchUberOptions(lat, lng) {


    // const url = buildUberDeepLink(searchLocation, searchLocation)
    // window.open(url, '_blank', 'noopener,noreferrer')

    return []
  }

  function buildUberDeepLink(pickup, dropoff) {
  const base = 'https://m.uber.com/ul/'
  const params = new URLSearchParams()
  params.set('action', 'setPickup')
  params.set('pickup[latitude]', String(pickup.lat))
  params.set('pickup[longitude]', String(pickup.lng))

  if (dropoff) {
    params.set('dropoff[latitude]', String(dropoff.lat))
    params.set('dropoff[longitude]', String(dropoff.lng))
  }

  return `${base}?${params.toString()}`
}

  async function runSearch(lat, lng) {
    setLoading(true)
    setError(null)

    try {
      const [stations, options] = await Promise.all([
        fetchBixiStations(lat, lng),
        // fetchUberOptions(lat, lng),
      ])

      setBixiStations(stations || [])
      setUberOptions(options || [])
    } catch (e) {
      setError(e && e.message ? e.message : 'Search failed')
      setBixiStations([])
      setUberOptions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (!searchLocation) return

    map.setView([searchLocation.lat, searchLocation.lng], 15)
    runSearch(searchLocation.lat, searchLocation.lng)
  }, [searchLocation])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear if no location
    if (!searchLocation) {
      layersRef.current.forEach((layer) => layer.remove())
      layersRef.current = []
      return
    }

    // Clear existing layers
    layersRef.current.forEach((layer) => layer.remove())
    layersRef.current = []

    const bounds = [[searchLocation.lat, searchLocation.lng]]

    // User/search marker
    const userMarker = L.marker([searchLocation.lat, searchLocation.lng])
      .bindPopup('<strong>Searched Location</strong>')
      .addTo(map)
    layersRef.current.push(userMarker)

    // Optional search radius (1km)
    const radiusCircle = L.circle([searchLocation.lat, searchLocation.lng], {
      radius: 1000,
      color: '#3b82f6',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
    }).addTo(map)
    layersRef.current.push(radiusCircle)

    // BIXI station markers (blue)
    bixiStations.forEach((s) => {
      bounds.push([s.lat, s.lng])

      const marker = L.circleMarker([s.lat, s.lng], {
        radius: 10,
        fillColor: '#2563eb',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<strong>${s.name || 'BIXI Station'}</strong><br/>
          Bikes: ${s.bikesAvailable ?? '?'} / Docks: ${s.docksAvailable ?? '?'}<br/>
          ${s.distance_km ? `${s.distance_km} km away` : ''}`
        )
        .addTo(map)

      layersRef.current.push(marker)
    })

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    }
  }, [searchLocation, bixiStations])

  return (
    <div className="parking-map-container">
      {!searchLocation && (
        <UberBixiSearch
          onSearch={(location) => setSearchLocation(location)}
          onClose={onClose}
        />
      )}

      <div className="parking-map-header">
        <h2>Find Uber / BIXI Near You</h2>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="parking-map-content">
        <div className="map-wrapper">
          <LeafletMap
            className="parking-map"
            onMapReady={(map) => {
              mapInstanceRef.current = map
            }}
          />
        </div>

        {searchLocation && (
          <div className="parking-spots-list">
            <h3>Results</h3>

            {loading && <p className="spot-info">Searching nearby mobility options...</p>}
            {error && <p className="no-spots">{error}</p>}

            {!loading && !error && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>BIXI Stations ({bixiStations.length})</h4>
                  {bixiStations.length > 0 ? (
                    <div className="spots-scroll">
                      {bixiStations.map((s) => (
                        <div key={s.id ?? `${s.lat}:${s.lng}`} className="spot-card available">
                          <div className="spot-header">
                            <h4>{s.name || 'BIXI Station'}</h4>
                            <span className="badge available">
                              {s.distance_km ? `${s.distance_km} km` : 'BIXI'}
                            </span>
                          </div>
                          <p className="spot-info">
                            Bikes: {s.bikesAvailable ?? '?'} | Docks: {s.docksAvailable ?? '?'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-spots">No BIXI stations found nearby</p>
                  )}
                </div>

                <div>
                  <h4 style={{ margin: 0 }}>Uber Estimates ({uberOptions.length})</h4>
                  {uberOptions.length > 0 ? (
                    <div className="spots-scroll">
                      {uberOptions.map((u) => (
                        <div key={u.id ?? u.productName} className="spot-card available">
                          <div className="spot-header">
                            <h4>{u.productName || 'Uber'}</h4>
                            <span className="badge available">
                              {u.etaMinutes != null ? `${u.etaMinutes} min` : 'ETA'}
                            </span>
                          </div>
                          <p className="spot-info">
                            {u.priceText ?? 'Price: ?'} {u.estimateText ? `| ${u.estimateText}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-spots">No Uber estimates yet (hook up API)</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UberBixiMap