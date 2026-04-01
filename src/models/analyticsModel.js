import { apiUrl, requestApiJson } from './api'

export function fetchAdminAnalytics() {
  return requestApiJson('/admin/analytics')
}

export function trackAnalyticsEvent(event, data = {}) {
  fetch(apiUrl('/analytics/event'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, data }),
  }).catch(() => {})
}
