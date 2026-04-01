import { useCallback, useEffect, useState } from 'react'

import { fetchAdminAnalytics } from '../models/analyticsModel'

export function useAdminDashboardController() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await fetchAdminAnalytics()
      setStats(data)
      setLastUpdated(new Date())
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to connect to backend')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
    const interval = setInterval(fetchAnalytics, 30000)
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  return {
    stats,
    loading,
    error,
    lastUpdated,
    fetchAnalytics,
  }
}
