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

  useEffect(() => {
    if (!address.trim() || searchType !== 'address') {
      setSuggestions([])
      setShowSuggestions(false)
      return undefined
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true)
        const results = await fetchLocationSuggestions(address)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoading(false)
      }
    }, 150)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [address, searchType])

  const handleSuggestionClick = (suggestion) => {
    setAddress(suggestion.display_name)
    setSuggestions([])
    setShowSuggestions(false)
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
    setAddress,
    setShowSuggestions,
    setSearchType,
    handleSuggestionClick,
    handleUseCurrentLocation,
    handleAddressSubmit,
  }
}
