import { useState } from 'react'

export function useUserDashboardController() {
  const [showParkingMap, setShowParkingMap] = useState(false)
  const [showUberBixiMap, setShowUberBixiMap] = useState(false)
  const [showPublicTransitHub, setShowPublicTransitHub] = useState(false)
  const [showBixiRental, setShowBixiRental] = useState(false)
  const [showVehicleRental, setShowVehicleRental] = useState(false)

  return {
    showParkingMap,
    showUberBixiMap,
    showPublicTransitHub,
    showBixiRental,
    showVehicleRental,
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
