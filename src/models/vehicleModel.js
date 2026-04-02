import { requestApiJson } from './api'

export async function fetchVehicleDashboard({ userEmail, vehicleTypeFilter }) {
  const userQuery = new URLSearchParams({ user_email: userEmail })
  const availableQuery = new URLSearchParams()

  if (vehicleTypeFilter && vehicleTypeFilter !== 'all') {
    availableQuery.set('vehicle_type', vehicleTypeFilter)
  }

  const [availableData, userData, listingsData] = await Promise.all([
    requestApiJson(`/vehicles/available?${availableQuery.toString()}`),
    requestApiJson(`/vehicles/user?${userQuery.toString()}`),
    requestApiJson(`/vehicles/listings/user?${userQuery.toString()}`),
  ])

  return {
    availableVehicles: availableData.vehicles || [],
    userVehicles: userData.vehicles || [],
    myListings: listingsData.vehicles || [],
  }
}

export function rentVehicle({ userEmail, userName, vehicleId, paymentMethod, paymentDetails }) {
  return requestApiJson('/vehicles/rent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
      user_name: userName,
      vehicle_id: vehicleId,
      payment_method: paymentMethod,
      payment_details: paymentDetails,
    }),
  })
}

export function returnVehicle({ userEmail, vehicleId }) {
  return requestApiJson('/vehicles/return', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
      vehicle_id: vehicleId,
    }),
  })
}

export function addVehicle(payload) {
  return requestApiJson('/vehicles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function updateMarketplaceVehicle(vehicleId, payload) {
  return requestApiJson(`/vehicles/${vehicleId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function removeVehicle({ userEmail, vehicleId }) {
  const query = new URLSearchParams({ user_email: userEmail })
  return requestApiJson(`/vehicles/${vehicleId}?${query.toString()}`, {
    method: 'DELETE',
  })
}
