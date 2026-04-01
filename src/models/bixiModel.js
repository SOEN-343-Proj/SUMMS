import { requestApiJson } from './api'

export const BIXI_HISTORY_LIMIT = '5'
export const BIXI_STATION_SEARCH_LIMIT = '12'
export const BIXI_STATION_SEARCH_RADIUS = '3'
export const PAYMENT_AUTHORIZATION_AMOUNT = 4.25

export function fetchNearbyBixiStations(location) {
  const query = new URLSearchParams({
    lat: String(location.lat),
    lng: String(location.lng),
    limit: BIXI_STATION_SEARCH_LIMIT,
    radius: BIXI_STATION_SEARCH_RADIUS,
  })

  return requestApiJson(`/bixi/stations/nearby?${query.toString()}`)
}

export function fetchBixiRentalState(userEmail) {
  const query = new URLSearchParams({
    user_email: userEmail,
    history_limit: BIXI_HISTORY_LIMIT,
  })

  return requestApiJson(`/bixi/rentals/state?${query.toString()}`)
}

export function fetchBixiAnalyticsSummary() {
  return requestApiJson('/bixi/analytics/summary')
}

export function fetchBixiPaymentMethods() {
  return requestApiJson('/bixi/payments/methods')
}

export function reserveBixiBike({ userEmail, userName, stationId }) {
  return requestApiJson('/bixi/rentals/reserve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
      user_name: userName,
      station_id: stationId,
    }),
  })
}

export function payForBixiRental({ rentalId, userEmail, paymentMethod, paymentDetails }) {
  return requestApiJson(`/bixi/rentals/${rentalId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
      payment_method: paymentMethod,
      payment_details: paymentDetails,
    }),
  })
}

export function returnBixiRental({ rentalId, userEmail, returnStationId }) {
  return requestApiJson(`/bixi/rentals/${rentalId}/return`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
      return_station_id: returnStationId,
    }),
  })
}
