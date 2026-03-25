import { useState } from 'react'
import '../styles/WelcomePage.css'
import UserLogin from './UserLogin'
import AdminCodeVerification from './AdminCodeVerification'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import UserDashboard from './UserDashboard'

function WelcomePage() {
  const [view, setView] = useState('selection') // selection, userLogin, adminCode, adminLogin, adminDashboard, userDashboard
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

  return (
    <div className="main">
      <h1>CityFlow - Urban Mobility Management</h1>
      
      {view === 'selection' && (
        <div className="selection-container">
          <h2>Please select your account type:</h2>
          <div className="button-group">
            <button 
              className="selection-btn user-btn"
              onClick={() => setView('userLogin')}
            >
              User Login
            </button>
            <button 
              className="selection-btn admin-btn"
              onClick={() => setView('adminCode')}
            >
              Admin Login
            </button>
          </div>
        </div>
      )}

      {view === 'userLogin' && (
        <UserLogin 
          onSuccess={handleUserLoginSuccess}
          onBack={handleBackToSelection}
        />
      )}

      {view === 'adminCode' && (
        <AdminCodeVerification 
          onSuccess={handleAdminCodeSuccess}
          onBack={handleBackToSelection}
        />
      )}

      {view === 'adminLogin' && (
        <AdminLogin 
          onSuccess={handleAdminLoginSuccess}
          onBack={handleBackToSelection}
        />
      )}

      {view === 'adminDashboard' && (
        <AdminDashboard 
          admin={loggedInAdmin}
          onLogout={handleBackToSelection}
        />
      )}

      {view === 'userDashboard' && (
        <UserDashboard 
          user={loggedInUser}
          onLogout={handleBackToSelection}
        />
      )}
    </div>
  )
}

export default WelcomePage
