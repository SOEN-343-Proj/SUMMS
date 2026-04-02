import { useState } from 'react'

export function useWelcomeController() {
  const [view, setView] = useState('selection')
  const [loggedInAdmin, setLoggedInAdmin] = useState(null)
  const [loggedInUser, setLoggedInUser] = useState(null)

  const handleAdminCodeSuccess = () => {
    setView('adminLogin')
  }

  const handleAdminLoginSuccess = (adminInfo) => {
    setLoggedInAdmin(adminInfo)
    setView('adminDashboard')
  }

  const handleUserLoginSuccess = (userInfo) => {
    setLoggedInUser(userInfo)
    setView('userDashboard')
  }

  const handleBackToSelection = () => {
    setView('selection')
    setLoggedInAdmin(null)
    setLoggedInUser(null)
  }

  return {
    view,
    loggedInAdmin,
    loggedInUser,
    setView,
    handleAdminCodeSuccess,
    handleAdminLoginSuccess,
    handleUserLoginSuccess,
    handleBackToSelection,
  }
}
