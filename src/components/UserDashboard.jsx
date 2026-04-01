import '../styles/UserDashboard.css'
import ParkingMap from './ParkingMap'
import UberBixiMap from './UberBixiMap'
import PublicTransitHub from './PublicTransitHub'
import BixiRentalFlow from './BixiRentalFlow'
import VehicleRentalFlow from './VehicleRentalFlow'
import { useUserDashboardController } from '../controllers/useUserDashboardController'

function UserDashboard({ user, onLogout }) {
  const {
    showParkingMap,
    showUberBixiMap,
    showPublicTransitHub,
    showBixiRental,
    showVehicleRental,
    openParkingMap,
    closeParkingMap,
    openUberBixiMap,
    closeUberBixiMap,
    openPublicTransitHub,
    closePublicTransitHub,
    openBixiRental,
    closeBixiRental,
    openVehicleRental,
    closeVehicleRental,
  } = useUserDashboardController()

  if (showPublicTransitHub) {
    return <PublicTransitHub onClose={closePublicTransitHub} />
  }

  return (
    <div className="user-dashboard">
      {showParkingMap && <ParkingMap onClose={closeParkingMap} />}
      {showUberBixiMap && <UberBixiMap onClose={closeUberBixiMap} />}
      {showBixiRental && (
        <BixiRentalFlow
          user={user}
          onClose={closeBixiRental}
        />
      )}
      {showVehicleRental && (
        <VehicleRentalFlow
          user={user}
          onClose={closeVehicleRental}
        />
      )}

      <div className="dashboard-header">
        <div>
          <h1>Welcome to CityFlow</h1>
          <p className="welcome-text">Hello, {user.name}!</p>
          <p className="user-email">{user.email}</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-section">
          <h2> Find Parking </h2>
          <p className="section-info">Find parking spots near your location</p>
          <button className="action-btn" onClick={openParkingMap}>
            Search
          </button>
        </div>

        <div className="dashboard-section">
          <h2> Find my Uber/Bixi </h2>
          <p className="section-info">Your Uber & Bixi all in one spot</p>
          <button className="action-btn" onClick={openUberBixiMap}>
            Search
          </button>
        </div>

        <div className="dashboard-section">
          <h2> Public Transit </h2>
          <p className="section-info">Plan a trip with bus, metro, and walking directions</p>
          <button className="action-btn" onClick={openPublicTransitHub}>
            Search
          </button>
        </div>

        <div className="dashboard-section">
          <h2> Rental Service </h2>
          <p className="section-info">Find and manage rental services</p>
          <div className="rental-actions">
            <button className="action-btn" onClick={openBixiRental}>
              Bixi Rental
            </button>
            <button className="action-btn" onClick={openVehicleRental}>
              Vehicle Rental
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

export default UserDashboard
