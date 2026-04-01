import { useEffect, useRef, useState } from 'react'

import { fetchNearbyParking } from '../models/parkingModel'

export function useParkingController() {
  const searchCacheRef = useRef(new Map())

  const [searchLocation, setSearchLocation] = useState(null)
  const [parkingSpots, setParkingSpots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!searchLocation) {
      setParkingSpots([])
      setError(null)
      return
    }

    const loadParkingSpots = async () => {
      const roundedLat = Number(searchLocation.lat).toFixed(3)
      const roundedLng = Number(searchLocation.lng).toFixed(3)
      const cacheKey = `${roundedLat}:${roundedLng}:1`
      const cachedSpots = searchCacheRef.current.get(cacheKey)

      if (cachedSpots) {
        setError(null)
        setParkingSpots(cachedSpots)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const data = await fetchNearbyParking({
          lat: searchLocation.lat,
          lng: searchLocation.lng,
          radius: 1,
        })
        const spots = data.spots || []
        setParkingSpots(spots)

        if (searchCacheRef.current.size >= 50) {
          const oldestKey = searchCacheRef.current.keys().next().value
          if (oldestKey) {
            searchCacheRef.current.delete(oldestKey)
          }
        }

        searchCacheRef.current.set(cacheKey, spots)
      } catch (err) {
        setError(err.message)
        setParkingSpots([])
      } finally {
        setLoading(false)
      }
    }

    loadParkingSpots()
  }, [searchLocation])

  return {
    searchLocation,
    parkingSpots,
    loading,
    error,
    setSearchLocation,
  }
}
