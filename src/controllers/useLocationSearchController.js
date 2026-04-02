import { useEffect, useRef, useState } from 'react'

import {
  fetchLocationSuggestions,
  geocodeLocationAddress,
  getCurrentLocation,
  toSearchLocation,
} from '../models/locationModel'

export function useLocationSearchController({ onSearch }) {
  const [searchType, setSearchType] = useState(null)
  const [address, setAddress] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceTimerRef = useRef(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const trimmedAddress = address.trim()
    requestIdRef.current += 1
    const currentRequestId = requestIdRef.current

    if (trimmedAddress.length < 3 || searchType !== 'address') {
      setSuggestions([])
      setShowSuggestions(false)
      setLoading(false)
      return undefined
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true)
        const results = await fetchLocationSuggestions(trimmedAddress)

        if (requestIdRef.current !== currentRequestId) {
          return
        }

        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch {
        if (requestIdRef.current === currentRequestId) {
          setSuggestions([])
          setShowSuggestions(false)
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setLoading(false)
        }
      }
    }, 320)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [address, searchType])

  const handleAddressChange = (value) => {
    setAddress(value)
    setError('')
  }

  const handleSuggestionClick = (suggestion) => {
    setAddress(suggestion.display_name)
    setSuggestions([])
    setShowSuggestions(false)
    setError('')
    onSearch(toSearchLocation(suggestion))
  }

  const handleUseCurrentLocation = async () => {
    setLoading(true)
    setError('')

    try {
      onSearch(await getCurrentLocation())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddressSubmit = async (event) => {
    event.preventDefault()

    if (!address.trim()) {
      setError('Please enter an address.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuggestions([])
      setShowSuggestions(false)
      onSearch(await geocodeLocationAddress(address))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return {
    searchType,
    address,
    suggestions,
    loading,
    error,
    showSuggestions,
    setAddress: handleAddressChange,
    setShowSuggestions,
    setSearchType,
    handleSuggestionClick,
    handleUseCurrentLocation,
    handleAddressSubmit,
  }
}
