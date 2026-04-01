export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

export async function requestJson(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.detail || 'Request failed')
  }

  return data
}

export function requestApiJson(path, options) {
  return requestJson(apiUrl(path), options)
}
