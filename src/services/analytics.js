const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

/**
 * Fire-and-forget analytics event tracker.
 * Never throws — UI should never be blocked by analytics.
 */
export function trackEvent(event, data = {}) {
  fetch(`${API_BASE_URL}/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, data }),
  }).catch(() => {})
}
