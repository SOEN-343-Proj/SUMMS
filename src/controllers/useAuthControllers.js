import { useState } from 'react'

import { loginAdmin, loginUser, registerUser, verifyAdminCode } from '../models/authModel'

export function useUserAuthController({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (isSignUp && !name) {
      setError('Please enter your name')
      return
    }

    setIsLoading(true)
    try {
      const data = isSignUp
        ? await registerUser(name, email, password)
        : await loginUser(email, password)

      setError('')
      onSuccess(data.user)
    } catch (err) {
      setError(err.message || 'Unable to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const showSignUp = () => {
    setIsSignUp(true)
    setError('')
  }

  const showLogin = () => {
    setIsSignUp(false)
    setError('')
    setName('')
  }

  return {
    email,
    password,
    name,
    error,
    isSignUp,
    isLoading,
    setEmail,
    setPassword,
    setName,
    handleSubmit,
    showSignUp,
    showLogin,
  }
}

export function useAdminCodeController({ onSuccess }) {
  const [adminCode, setAdminCode] = useState(import.meta.env.DEV ? 'ADMIN2025' : '')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    setIsLoading(true)
    try {
      const data = await verifyAdminCode(adminCode)
      if (data.valid) {
        setError('')
        onSuccess()
        return
      }

      setError('Invalid admin code. Access denied.')
      setAdminCode('')
    } catch (err) {
      setError(err.message || 'Unable to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    adminCode,
    error,
    isLoading,
    setAdminCode,
    handleSubmit,
  }
}

export function useAdminLoginController({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    setIsLoading(true)
    try {
      const data = await loginAdmin(email, password)
      setError('')
      onSuccess({
        ...data.admin,
        type: 'admin',
      })
    } catch (err) {
      setError(err.message || 'Unable to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    email,
    password,
    error,
    isLoading,
    setEmail,
    setPassword,
    handleSubmit,
  }
}
