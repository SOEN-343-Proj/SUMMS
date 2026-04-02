import { useEffect, useRef, useState } from 'react'

import {
  fetchLocationSuggestions,
  geocodeLocationAddress,
  getCurrentLocation,
  reverseLookupLocation,
} from '../models/locationModel'
import { fetchTransitRoutes } from '../models/transitModel'
import { trackAnalyticsEvent } from '../models/analyticsModel'

const DEFAULT_CENTER = [45.5017, -73.5673]

export function useTransitController({ mapInstanceRef }) {
  const originDebounceRef = useRef(null)
  const destinationDebounceRef = useRef(null)

  const [originText, setOriginText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const [originPoint, setOriginPoint] = useState(null)
  const [destinationPoint, setDestinationPoint] = useState(null)
  const [searching, setSearching] = useState(false)
  const [plannerError, setPlannerError] = useState('')
  const [routeOptions, setRouteOptions] = useState([])
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
  const [detailsRouteIndex, setDetailsRouteIndex] = useState(null)
  const [originSuggestions, setOriginSuggestions] = useState([])
  const [destinationSuggestions, setDestinationSuggestions] = useState([])
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false)
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false)
  const [loadingOriginSuggestions, setLoadingOriginSuggestions] = useState(false)
  const [loadingDestinationSuggestions, setLoadingDestinationSuggestions] = useState(false)

  useEffect(() => {
    if (!originText.trim()) {
      setOriginSuggestions([])
      setShowOriginSuggestions(false)
      setLoadingOriginSuggestions(false)
      return undefined
    }

    if (originDebounceRef.current) {
      clearTimeout(originDebounceRef.current)
    }

    originDebounceRef.current = setTimeout(async () => {
      try {
        setLoadingOriginSuggestions(true)
        const matches = await fetchLocationSuggestions(originText.trim(), { limit: 8, bounded: 0 })
        setOriginSuggestions(matches)
        setShowOriginSuggestions(matches.length > 0)
      } catch {
        setOriginSuggestions([])
        setShowOriginSuggestions(false)
      } finally {
        setLoadingOriginSuggestions(false)
      }
    }, 180)

    return () => {
      if (originDebounceRef.current) {
        clearTimeout(originDebounceRef.current)
      }
    }
  }, [originText])

  useEffect(() => {
    if (!destinationText.trim()) {
      setDestinationSuggestions([])
      setShowDestinationSuggestions(false)
      setLoadingDestinationSuggestions(false)
      return undefined
    }

    if (destinationDebounceRef.current) {
      clearTimeout(destinationDebounceRef.current)
    }

    destinationDebounceRef.current = setTimeout(async () => {
      try {
        setLoadingDestinationSuggestions(true)
        const matches = await fetchLocationSuggestions(destinationText.trim(), { limit: 8, bounded: 0 })
        setDestinationSuggestions(matches)
        setShowDestinationSuggestions(matches.length > 0)
      } catch {
        setDestinationSuggestions([])
        setShowDestinationSuggestions(false)
      } finally {
        setLoadingDestinationSuggestions(false)
      }
    }, 180)

    return () => {
      if (destinationDebounceRef.current) {
        clearTimeout(destinationDebounceRef.current)
      }
    }
  }, [destinationText])

  useEffect(() => () => {
    if (originDebounceRef.current) {
      clearTimeout(originDebounceRef.current)
    }

    if (destinationDebounceRef.current) {
      clearTimeout(destinationDebounceRef.current)
    }
  }, [])

  const handleSuggestionSelect = (field, suggestion) => {
    const nextPoint = {
      lat: Number(suggestion.lat),
      lng: Number(suggestion.lon),
    }
    const nextLabel = suggestion.display_name || ''

    if (field === 'origin') {
      setOriginPoint(nextPoint)
      setOriginText(nextLabel)
      setOriginSuggestions([])
      setShowOriginSuggestions(false)
      setLoadingOriginSuggestions(false)
    } else {
      setDestinationPoint(nextPoint)
      setDestinationText(nextLabel)
      setDestinationSuggestions([])
      setShowDestinationSuggestions(false)
      setLoadingDestinationSuggestions(false)
    }

    setPlannerError('')
    mapInstanceRef.current?.setView([nextPoint.lat, nextPoint.lng], 14)
  }

  const renderSuggestionMain = (suggestion) => {
    const parts = String(suggestion.display_name || '').split(',')
    const primary = parts.slice(0, 2).join(',').trim()
    return primary || suggestion.display_name
  }

  const renderSuggestionSecondary = (suggestion) => {
    const parts = String(suggestion.display_name || '').split(',')
    return parts.slice(2).join(',').trim()
  }

  const resetPlanner = () => {
    setOriginText('')
    setDestinationText('')
    setOriginPoint(null)
    setDestinationPoint(null)
    setSearching(false)
    setPlannerError('')
    setRouteOptions([])
    setSelectedRouteIndex(0)
    setDetailsRouteIndex(null)
    setOriginSuggestions([])
    setDestinationSuggestions([])
    setShowOriginSuggestions(false)
    setShowDestinationSuggestions(false)
    mapInstanceRef.current?.setView(DEFAULT_CENTER, 11)
  }

  const handleUseCurrentLocation = async () => {
    try {
      setPlannerError('')
      const nextPoint = await getCurrentLocation()
      setOriginPoint(nextPoint)
      setOriginSuggestions([])
      setShowOriginSuggestions(false)
      setOriginText('Loading current location...')
      mapInstanceRef.current?.setView([nextPoint.lat, nextPoint.lng], 15)

      try {
        setOriginText(await reverseLookupLocation(nextPoint.lat, nextPoint.lng))
      } catch {
        setOriginText('Current location')
      }
    } catch (error) {
      setPlannerError(error.message)
    }
  }

  const handleRecenterToLocation = () => {
    setPlannerError('')
    mapInstanceRef.current?.setView(DEFAULT_CENTER, 11)
  }

  const handlePlanTrip = async () => {
    let resolvedOriginPoint = originPoint
    let resolvedDestinationPoint = destinationPoint
    let resolvedOriginLabel = originText.trim()
    let resolvedDestinationLabel = destinationText.trim()

    if ((!resolvedOriginPoint && !resolvedOriginLabel) || (!resolvedDestinationPoint && !resolvedDestinationLabel)) {
      setPlannerError('Choose both a starting point and a destination.')
      return
    }

    setSearching(true)
    setPlannerError('')

    try {
      if (!resolvedOriginPoint && resolvedOriginLabel) {
        const match = await geocodeLocationAddress(resolvedOriginLabel)
        resolvedOriginPoint = { lat: match.lat, lng: match.lng }
        resolvedOriginLabel = match.label
        setOriginPoint(resolvedOriginPoint)
        setOriginText(match.label)
        setOriginSuggestions([])
        setShowOriginSuggestions(false)
      }

      if (!resolvedDestinationPoint && resolvedDestinationLabel) {
        const match = await geocodeLocationAddress(resolvedDestinationLabel)
        resolvedDestinationPoint = { lat: match.lat, lng: match.lng }
        resolvedDestinationLabel = match.label
        setDestinationPoint(resolvedDestinationPoint)
        setDestinationText(match.label)
        setDestinationSuggestions([])
        setShowDestinationSuggestions(false)
      }

      const origin = resolvedOriginPoint
        ? `${resolvedOriginPoint.lat},${resolvedOriginPoint.lng}`
        : resolvedOriginLabel
      const destination = resolvedDestinationPoint
        ? `${resolvedDestinationPoint.lat},${resolvedDestinationPoint.lng}`
        : resolvedDestinationLabel

      const data = await fetchTransitRoutes(origin, destination)
      const routes = Array.isArray(data.routes) ? data.routes : []

      if (!routes.length) {
        throw new Error('No transit route was found for that trip. Try another origin or destination.')
      }

      setRouteOptions(routes)
      setSelectedRouteIndex(0)
      setDetailsRouteIndex(0)
      trackAnalyticsEvent('transit_route_searched', {
        origin: resolvedOriginLabel,
        destination: resolvedDestinationLabel,
        route_count: routes.length,
      })

      const firstRoute = routes[0]
      if (firstRoute.startLocation) {
        setOriginPoint({
          lat: firstRoute.startLocation.lat,
          lng: firstRoute.startLocation.lng,
        })
      }
      if (firstRoute.startAddress) {
        setOriginText(firstRoute.startAddress)
        setOriginSuggestions([])
        setShowOriginSuggestions(false)
      }
      if (firstRoute.endLocation) {
        setDestinationPoint({
          lat: firstRoute.endLocation.lat,
          lng: firstRoute.endLocation.lng,
        })
      }
      if (firstRoute.endAddress) {
        setDestinationText(firstRoute.endAddress)
        setDestinationSuggestions([])
        setShowDestinationSuggestions(false)
      }
    } catch (error) {
      setRouteOptions([])
      setPlannerError(error.message)
    } finally {
      setSearching(false)
    }
  }

  return {
    originText,
    destinationText,
    originPoint,
    destinationPoint,
    searching,
    plannerError,
    routeOptions,
    selectedRouteIndex,
    detailsRouteIndex,
    originSuggestions,
    destinationSuggestions,
    showOriginSuggestions,
    showDestinationSuggestions,
    loadingOriginSuggestions,
    loadingDestinationSuggestions,
    setOriginText,
    setDestinationText,
    setSelectedRouteIndex,
    setDetailsRouteIndex,
    setShowOriginSuggestions,
    setShowDestinationSuggestions,
    handleSuggestionSelect,
    renderSuggestionMain,
    renderSuggestionSecondary,
    resetPlanner,
    handleUseCurrentLocation,
    handleRecenterToLocation,
    handlePlanTrip,
  }
}
