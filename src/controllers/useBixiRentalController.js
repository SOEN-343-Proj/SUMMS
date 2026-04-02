import { useEffect, useState } from 'react'

import {
  fetchBixiAnalyticsSummary,
  fetchBixiPaymentMethods,
  fetchBixiRentalState,
  fetchNearbyBixiStations,
  PAYMENT_AUTHORIZATION_AMOUNT,
  payForBixiRental,
  reserveBixiBike,
  returnBixiRental,
} from '../models/bixiModel'
import {
  buildMockPaymentDetails,
  buildSamplePaymentInfo,
  DEFAULT_PAYMENT_METHODS,
} from '../models/paymentModel'
import { trackAnalyticsEvent } from '../models/analyticsModel'

function formatCurrency(amount) {
  if (amount === null || amount === undefined) {
    return 'Pending'
  }

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

function getSavedLocation(rental) {
  if (!rental?.pickup_station) {
    return null
  }

  return {
    lat: rental.pickup_station.lat,
    lng: rental.pickup_station.lng,
    searchType: 'saved-rental',
  }
}

export function useBixiRentalController({ user }) {
  const [activePage, setActivePage] = useState('rental')
  const [searchLocation, setSearchLocation] = useState(null)
  const [stations, setStations] = useState([])
  const [openRental, setOpenRental] = useState(null)
  const [history, setHistory] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS)
  const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHODS[0].id)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedStationId, setSelectedStationId] = useState('')
  const [loadingState, setLoadingState] = useState(true)
  const [loadingStations, setLoadingStations] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedStation = stations.find((station) => station.id === selectedStationId) || null
  const nearbyAvailableBikes = stations.reduce((sum, station) => sum + station.bikes_available, 0)
  const nearbyAvailableDocks = stations.reduce((sum, station) => sum + station.docks_available, 0)
  const isReserved = openRental?.status === 'reserved'
  const isActive = openRental?.status === 'active'
  const selectedPaymentOption =
    paymentMethods.find((method) => method.id === paymentMethod) || DEFAULT_PAYMENT_METHODS[0]
  const mockPaymentDetails = buildMockPaymentDetails(paymentMethod, user)
  const samplePaymentInfo = buildSamplePaymentInfo(paymentMethod, user)

  const applyStations = (nextStations) => {
    setStations(nextStations)
    setSelectedStationId((current) => {
      if (current && nextStations.some((station) => station.id === current)) {
        return current
      }

      return nextStations[0]?.id || ''
    })
  }

  const loadStations = async (location) => {
    if (!location) {
      applyStations([])
      return
    }

    setLoadingStations(true)
    setError('')

    try {
      const data = await fetchNearbyBixiStations(location)
      applyStations(data.stations || [])
    } catch (err) {
      setError(err.message)
      applyStations([])
    } finally {
      setLoadingStations(false)
    }
  }

  const loadDashboardData = async () => {
    const [stateData, analyticsData] = await Promise.all([
      fetchBixiRentalState(user.email),
      fetchBixiAnalyticsSummary(),
    ])

    setOpenRental(stateData.open_rental)
    setHistory(stateData.history || [])
    setAnalytics(analyticsData)

    const savedLocation = getSavedLocation(stateData.open_rental)
    if (!searchLocation && savedLocation) {
      setSearchLocation(savedLocation)
    }

    return savedLocation
  }

  const loadPaymentMethods = async () => {
    try {
      const data = await fetchBixiPaymentMethods()
      const methods = Array.isArray(data.methods) && data.methods.length > 0 ? data.methods : DEFAULT_PAYMENT_METHODS
      setPaymentMethods(methods)
      setPaymentMethod((current) => {
        if (methods.some((method) => method.id === current)) {
          return current
        }

        return methods[0]?.id || DEFAULT_PAYMENT_METHODS[0].id
      })
    } catch {
      setPaymentMethods(DEFAULT_PAYMENT_METHODS)
    }
  }

  const refreshAfterAction = async () => {
    const savedLocation = await loadDashboardData()
    const locationToUse = searchLocation || savedLocation

    if (locationToUse) {
      await loadStations(locationToUse)
    }
  }

  useEffect(() => {
    const initialize = async () => {
      setLoadingState(true)
      setError('')

      try {
        await Promise.all([loadDashboardData(), loadPaymentMethods()])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoadingState(false)
      }
    }

    initialize()
  }, [user.email])

  useEffect(() => {
    loadStations(searchLocation)
  }, [searchLocation])

  useEffect(() => {
    if (!isReserved) {
      setShowPaymentModal(false)
    }
  }, [isReserved])

  const handleReserve = async (station) => {
    setActionLoading(`reserve:${station.id}`)
    setError('')
    setNotice('')

    try {
      await reserveBixiBike({
        userEmail: user.email,
        userName: user.name,
        stationId: station.id,
      })

      setNotice(`Bike reserved at ${station.name}. Complete payment to unlock it.`)
      trackAnalyticsEvent('bixi_reserved', { station_name: station.name, email: user.email })
      await refreshAfterAction()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handlePay = async () => {
    if (!openRental) {
      return
    }

    setActionLoading('pay')
    setError('')
    setNotice('')

    try {
      await payForBixiRental({
        rentalId: openRental.id,
        userEmail: user.email,
        paymentMethod,
        paymentDetails: mockPaymentDetails,
      })

      setNotice(`Payment authorized with ${selectedPaymentOption.name}. Your BIXI rental is now active.`)
      trackAnalyticsEvent('bixi_payment', { payment_method: paymentMethod, email: user.email })
      setShowPaymentModal(false)
      await refreshAfterAction()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleReturn = async (station) => {
    if (!openRental) {
      return
    }

    setActionLoading(`return:${station.id}`)
    setError('')
    setNotice('')

    try {
      const data = await returnBixiRental({
        rentalId: openRental.id,
        userEmail: user.email,
        returnStationId: station.id,
      })

      setOpenRental(null)
      trackAnalyticsEvent('bixi_returned', { station_name: station.name, email: user.email })
      setNotice(
        `Ride returned at ${station.name}. Final charge: ${formatCurrency(data.rental?.payment?.final_cost)}.`
      )
      await refreshAfterAction()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  return {
    activePage,
    searchLocation,
    stations,
    openRental,
    history,
    analytics,
    paymentMethods,
    paymentMethod,
    showPaymentModal,
    selectedStationId,
    loadingState,
    loadingStations,
    actionLoading,
    error,
    notice,
    selectedStation,
    nearbyAvailableBikes,
    nearbyAvailableDocks,
    isReserved,
    isActive,
    selectedPaymentOption,
    samplePaymentInfo,
    mockPaymentDetails,
    PAYMENT_AUTHORIZATION_AMOUNT,
    setActivePage,
    setSearchLocation,
    setPaymentMethod,
    setShowPaymentModal,
    setSelectedStationId,
    setError,
    setNotice,
    handleReserve,
    handlePay,
    handleReturn,
  }
}
