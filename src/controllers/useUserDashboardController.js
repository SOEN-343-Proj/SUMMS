import { useEffect, useState } from 'react'

import { fetchMontrealWeather } from '../models/weatherModel'

export function useUserDashboardController() {
  const [showParkingMap, setShowParkingMap] = useState(false)
  const [showUberBixiMap, setShowUberBixiMap] = useState(false)
  const [showPublicTransitHub, setShowPublicTransitHub] = useState(false)
  const [showBixiRental, setShowBixiRental] = useState(false)
  const [showVehicleRental, setShowVehicleRental] = useState(false)
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const [weatherError, setWeatherError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadWeather = async () => {
      try {
        setWeatherLoading(true)
        setWeatherError('')
        const weatherData = await fetchMontrealWeather()
        if (isMounted) {
          setWeather(weatherData)
        }
      } catch {
        if (isMounted) {
          setWeatherError('Montreal weather unavailable')
        }
      } finally {
        if (isMounted) {
          setWeatherLoading(false)
        }
      }
    }

    loadWeather()

    return () => {
      isMounted = false
    }
  }, [])

  return {
    showParkingMap,
    showUberBixiMap,
    showPublicTransitHub,
    showBixiRental,
    showVehicleRental,
    weather,
    weatherLoading,
    weatherError,
    openParkingMap: () => setShowParkingMap(true),
    closeParkingMap: () => setShowParkingMap(false),
    openUberBixiMap: () => setShowUberBixiMap(true),
    closeUberBixiMap: () => setShowUberBixiMap(false),
    openPublicTransitHub: () => setShowPublicTransitHub(true),
    closePublicTransitHub: () => setShowPublicTransitHub(false),
    openBixiRental: () => setShowBixiRental(true),
    closeBixiRental: () => setShowBixiRental(false),
    openVehicleRental: () => setShowVehicleRental(true),
    closeVehicleRental: () => setShowVehicleRental(false),
  }
}
