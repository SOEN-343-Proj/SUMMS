import { requestApiJson } from './api'

export function fetchTransitRoutes(origin, destination) {
  return requestApiJson(
    `/transit/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
  )
}
