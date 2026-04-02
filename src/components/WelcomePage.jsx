import '../styles/WelcomePage.css'
import UserLogin from './UserLogin'
import AdminCodeVerification from './AdminCodeVerification'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import UserDashboard from './UserDashboard'
import { useWelcomeController } from '../controllers/useWelcomeController'

function WelcomePage() {
  const {
    view,
    loggedInAdmin,
    loggedInUser,
    setView,
    handleAdminCodeSuccess,
    handleAdminLoginSuccess,
    handleUserLoginSuccess,
    handleBackToSelection,
  } = useWelcomeController()

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
