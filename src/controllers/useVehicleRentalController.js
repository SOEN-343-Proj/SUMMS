import { useEffect, useState } from 'react'

import {
  buildMockPaymentDetails,
  buildSamplePaymentInfo,
  DEFAULT_PAYMENT_METHODS,
} from '../models/paymentModel'
import { fetchBixiPaymentMethods } from '../models/bixiModel'
import {
  addVehicle,
  decodeVehicleVin,
  fetchVehicleDashboard,
  removeVehicle,
  rentVehicle,
  returnVehicle,
  updateMarketplaceVehicle,
} from '../models/vehicleModel'
import { trackAnalyticsEvent } from '../models/analyticsModel'

function normalizeVinInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 17)
}

function buildEditFormFromVehicle(vehicle) {
  return {
    vehicle_type: vehicle.vehicle_type || 'car',
    make: vehicle.make || '',
    model: vehicle.model || '',
    year: vehicle.year || new Date().getFullYear(),
    daily_rate: vehicle.daily_rate || 1,
    color: vehicle.color || '',
    transmission: vehicle.transmission || '',
    seats: vehicle.seats || 1,
    fuel_type: vehicle.fuel_type || '',
  }
}

export function useVehicleRentalController({ user }) {
  const initialVehicleForm = {
    vin: '',
    vehicle_type: 'car',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    daily_rate: 45,
    color: '',
    transmission: 'Automatic',
    seats: 4,
    fuel_type: 'Gasoline',
  }

  const [availableVehicles, setAvailableVehicles] = useState([])
  const [myListings, setMyListings] = useState([])
  const [userVehicles, setUserVehicles] = useState([])
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS)
  const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHODS[0].id)
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [vehicleDestination, setVehicleDestination] = useState('my_vehicles')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedVehicleForPayment, setSelectedVehicleForPayment] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState('')
  const [editingVehicleSource, setEditingVehicleSource] = useState('marketplace')
  const [editVehicleForm, setEditVehicleForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm)

  const selectedPaymentOption =
    paymentMethods.find((method) => method.id === paymentMethod) || DEFAULT_PAYMENT_METHODS[0]
  const paymentDetails = buildMockPaymentDetails(paymentMethod, user)
  const samplePaymentInfo = buildSamplePaymentInfo(paymentMethod, user)

  const loadPaymentMethods = async () => {
    try {
      const data = await fetchBixiPaymentMethods()
      const methods = Array.isArray(data.methods) && data.methods.length > 0 ? data.methods : DEFAULT_PAYMENT_METHODS
      setPaymentMethods(methods)
      setPaymentMethod((current) => {
        if (methods.some((method) => method.id === current)) {
          return current
        }
        return methods[0]?.id || DEFAULT_PAYMENT_METHODS[0].id
      })
    } catch {
      setPaymentMethods(DEFAULT_PAYMENT_METHODS)
    }
  }

  const loadVehicles = async () => {
    setLoading(true)
    setError('')

    try {
      const data = await fetchVehicleDashboard({
        userEmail: user.email,
        vehicleTypeFilter,
      })
      setAvailableVehicles(data.availableVehicles)
      setUserVehicles(data.userVehicles)
      setMyListings(data.myListings)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehicles()
    loadPaymentMethods()
  }, [user.email, vehicleTypeFilter])

  const availableVehicleTypes = Array.from(
    new Set(availableVehicles.map((vehicle) => String(vehicle.vehicle_type || '').toLowerCase()).filter(Boolean))
  ).sort()

  const handleRent = (vehicle) => {
    setSelectedVehicleForPayment(vehicle)
    setShowPaymentModal(true)
  }

  const handleConfirmRent = async () => {
    if (!selectedVehicleForPayment) {
      return
    }

    const vehicle = selectedVehicleForPayment
    setActionLoading(`rent:${vehicle.id}`)
    setError('')
    setNotice('')

    try {
      await rentVehicle({
        userEmail: user.email,
        userName: user.name,
        vehicleId: vehicle.id,
        paymentMethod,
        paymentDetails,
      })

      setNotice(`${vehicle.make} ${vehicle.model} is now in your vehicles. Payment authorized with ${selectedPaymentOption.name}.`)
      trackAnalyticsEvent('vehicle_rented', {
        vehicle_type: vehicle.vehicle_type,
        make: vehicle.make,
        model: vehicle.model,
        daily_rate: vehicle.daily_rate,
        payment_method: paymentMethod,
        email: user.email,
      })
      setShowPaymentModal(false)
      setSelectedVehicleForPayment(null)
      await loadVehicles()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleReturn = async (vehicle) => {
    setActionLoading(`return:${vehicle.id}`)
    setError('')
    setNotice('')

    try {
      const data = await returnVehicle({
        userEmail: user.email,
        vehicleId: vehicle.id,
      })

      const amountBilled = data?.rental?.billing?.amount_billed
      const billedCurrency = data?.rental?.billing?.currency || 'CAD'
      const billedText =
        amountBilled !== undefined && amountBilled !== null
          ? new Intl.NumberFormat('en-CA', {
              style: 'currency',
              currency: billedCurrency,
            }).format(amountBilled)
          : new Intl.NumberFormat('en-CA', {
              style: 'currency',
              currency: billedCurrency,
            }).format(vehicle.daily_rate)

      setNotice(`${vehicle.make} ${vehicle.model} was returned. Amount billed: ${billedText}.`)
      trackAnalyticsEvent('vehicle_returned', {
        vehicle_type: vehicle.vehicle_type,
        make: vehicle.make,
        model: vehicle.model,
        email: user.email,
      })
      await loadVehicles()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleVehicleFormChange = (event) => {
    const { name, value } = event.target
    setVehicleForm((current) => ({
      ...current,
      [name]: name === 'vin' ? normalizeVinInput(value) : value,
    }))
  }

  const handleAutofillFromVin = async () => {
    const normalizedVin = normalizeVinInput(vehicleForm.vin)
    if (!normalizedVin) {
      setError('Enter a VIN to auto-fill vehicle details.')
      setNotice('')
      return
    }

    setActionLoading('decode-vin')
    setError('')
    setNotice('')

    try {
      const data = await decodeVehicleVin(normalizedVin)
      const decodedVehicle = data?.vehicle || {}

      setVehicleForm((current) => ({
        ...current,
        vin: data?.vin || normalizedVin,
        vehicle_type: decodedVehicle.vehicle_type || current.vehicle_type,
        make: decodedVehicle.make || current.make,
        model: decodedVehicle.model || current.model,
        year: decodedVehicle.year || current.year,
        transmission: decodedVehicle.transmission || current.transmission,
        seats: decodedVehicle.seats || current.seats,
        fuel_type: decodedVehicle.fuel_type || current.fuel_type,
      }))

      const decodedTitle = [decodedVehicle.year, decodedVehicle.make, decodedVehicle.model]
        .filter(Boolean)
        .join(' ')

      setNotice(`VIN decoded${decodedTitle ? ` for ${decodedTitle}` : ''}. Review the details before saving.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleAddVehicle = async (event) => {
    event.preventDefault()
    const addAction = vehicleDestination === 'my_vehicles' ? 'add-my-vehicles' : 'add-marketplace'
    setActionLoading(addAction)
    setError('')
    setNotice('')

    try {
      const payload = {
        target: vehicleDestination,
        listed_by_email: user.email,
        vehicle_type: vehicleForm.vehicle_type.trim().toLowerCase(),
        make: vehicleForm.make.trim(),
        model: vehicleForm.model.trim(),
        year: Number(vehicleForm.year),
        color: vehicleForm.color.trim() || undefined,
        transmission: vehicleForm.transmission.trim() || undefined,
        seats: Number(vehicleForm.seats),
        fuel_type: vehicleForm.fuel_type.trim() || undefined,
        ...(vehicleDestination === 'marketplace'
          ? { daily_rate: Number(vehicleForm.daily_rate) }
          : {}),
      }

      const data = await addVehicle(payload)
      const addedVehicle = data?.vehicle
      const destinationLabel = vehicleDestination === 'my_vehicles' ? 'My Vehicles' : 'the marketplace'

      setNotice(`Added ${addedVehicle?.year || payload.year} ${addedVehicle?.make || payload.make} ${addedVehicle?.model || payload.model} to ${destinationLabel}.`)
      if (vehicleDestination === 'marketplace') {
        trackAnalyticsEvent('vehicle_listed', {
          vehicle_type: payload.vehicle_type,
          make: payload.make,
          model: payload.model,
          email: user.email,
        })
      }
      setVehicleForm(initialVehicleForm)
      await loadVehicles()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleOpenEditModal = (vehicle) => {
    setEditingVehicleId(vehicle.id)
    setEditingVehicleSource(vehicle.vehicle_source || 'marketplace')
    setEditVehicleForm(buildEditFormFromVehicle(vehicle))
    setShowEditModal(true)
  }

  const handleEditFormChange = (event) => {
    const { name, value } = event.target
    setEditVehicleForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSaveVehicleUpdate = async (event) => {
    event.preventDefault()
    if (!editingVehicleId || !editVehicleForm) {
      return
    }

    setActionLoading(`update:${editingVehicleId}`)
    setError('')
    setNotice('')

    try {
      const payload = {
        user_email: user.email,
        vehicle_type: editVehicleForm.vehicle_type.trim().toLowerCase(),
        make: editVehicleForm.make.trim(),
        model: editVehicleForm.model.trim(),
        year: Number(editVehicleForm.year),
        color: editVehicleForm.color.trim() || undefined,
        transmission: editVehicleForm.transmission.trim() || undefined,
        seats: Number(editVehicleForm.seats),
        fuel_type: editVehicleForm.fuel_type.trim() || undefined,
        ...(editingVehicleSource === 'marketplace'
          ? { daily_rate: Number(editVehicleForm.daily_rate) }
          : {}),
      }

      const data = await updateMarketplaceVehicle(editingVehicleId, payload)
      const updatedVehicle = data?.vehicle

      const destinationLabel = editingVehicleSource === 'personal' ? 'in My Vehicles' : 'listing'

      setNotice(`Updated ${updatedVehicle?.year || payload.year} ${updatedVehicle?.make || payload.make} ${updatedVehicle?.model || payload.model} ${destinationLabel} successfully.`)
      setShowEditModal(false)
      setEditingVehicleId('')
      setEditingVehicleSource('marketplace')
      setEditVehicleForm(null)
      await loadVehicles()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleRemoveVehicle = async (vehicle) => {
    const shouldRemove = window.confirm(`Remove ${vehicle.make} ${vehicle.model} from My Vehicles?`)
    if (!shouldRemove) {
      return
    }

    setActionLoading(`remove:${vehicle.id}`)
    setError('')
    setNotice('')

    try {
      const data = await removeVehicle({
        userEmail: user.email,
        vehicleId: vehicle.id,
      })
      const removedVehicle = data?.vehicle

      setNotice(`Removed ${removedVehicle?.year || vehicle.year} ${removedVehicle?.make || vehicle.make} ${removedVehicle?.model || vehicle.model} from My Vehicles.`)
      await loadVehicles()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  return {
    availableVehicles,
    myListings,
    userVehicles,
    paymentMethods,
    paymentMethod,
    vehicleTypeFilter,
    vehicleDestination,
    showPaymentModal,
    selectedVehicleForPayment,
    showEditModal,
    editingVehicleId,
    editingVehicleSource,
    editVehicleForm,
    loading,
    actionLoading,
    error,
    notice,
    vehicleForm,
    selectedPaymentOption,
    samplePaymentInfo,
    availableVehicleTypes,
    setPaymentMethod,
    setVehicleTypeFilter,
    setVehicleDestination,
    setShowPaymentModal,
    setSelectedVehicleForPayment,
    setShowEditModal,
    setEditingVehicleId,
    setEditingVehicleSource,
    setEditVehicleForm,
    setVehicleForm,
    handleRent,
    handleConfirmRent,
    handleReturn,
    handleVehicleFormChange,
    handleAutofillFromVin,
    handleAddVehicle,
    handleOpenEditModal,
    handleEditFormChange,
    handleRemoveVehicle,
    handleSaveVehicleUpdate,
  }
}
