import { useState } from 'react'

import { buildUberWebLink, fetchNearbyUberBixiStations } from '../models/uberBixiModel'

export function useUberBixiController() {
  const [searchLocation, setSearchLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bixiStations, setBixiStations] = useState([])

  const runSearch = async (lat, lng) => {
    setLoading(true)
    setError(null)

    try {
      const stations = await fetchNearbyUberBixiStations(lat, lng)
      setBixiStations(stations)
    } catch (err) {
      setError(err?.message || 'Search failed')
      setBixiStations([])
    } finally {
      setLoading(false)
    }
  }

  const requestUberFromSearchLocation = () => {
    if (!searchLocation) {
      return
    }

    window.open(buildUberWebLink(searchLocation), '_blank', 'noopener,noreferrer')
  }

  return {
    searchLocation,
    loading,
    error,
    bixiStations,
    setSearchLocation,
    runSearch,
    requestUberFromSearchLocation,
  }
}
