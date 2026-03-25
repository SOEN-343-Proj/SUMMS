import { useState } from 'react'
import '../styles/UserDashboard.css'
import ParkingMap from './ParkingMap'
import UberBixiMap from './UberBixiMap'
import PublicTransitHub from './PublicTransitHub'
import BixiRentalFlow from './BixiRentalFlow'
import VehicleRentalFlow from './VehicleRentalFlow'

function UserDashboard({ user, onLogout }) {
  const [showParkingMap, setShowParkingMap] = useState(false)
  const [showUberBixiMap, setShowUberBixiMap] = useState(false)
  const [showPublicTransitHub, setShowPublicTransitHub] = useState(false)
  const [showBixiRental, setShowBixiRental] = useState(false)
  const [showVehicleRental, setShowVehicleRental] = useState(false)

  if (showPublicTransitHub) {
    return <PublicTransitHub onClose={() => setShowPublicTransitHub(false)} />
  }

  return (
    <div className="user-dashboard">
      {showParkingMap && <ParkingMap onClose={() => setShowParkingMap(false)} />}
      {showUberBixiMap && <UberBixiMap onClose={() => setShowUberBixiMap(false)} />}
      {showBixiRental && (
        <BixiRentalFlow
          user={user}
          onClose={() => setShowBixiRental(false)}
        />
      )}
      {showVehicleRental && (
        <VehicleRentalFlow
          user={user}
          onClose={() => setShowVehicleRental(false)}
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
          <button className="action-btn" onClick={() => setShowParkingMap(true)}>
            Search
          </button>
        </div>

        <div className="dashboard-section">
          <h2> Find my Uber/Bixi </h2>
          <p className="section-info">Your Uber & Bixi all in one spot</p>
          <button className="action-btn" onClick={() => setShowUberBixiMap(true)}>
            Search
          </button>
        </div>

        <div className="dashboard-section">
          <h2> Public Transit </h2>
          <p className="section-info">Plan a trip with bus, metro, and walking directions</p>
          <button className="action-btn" onClick={() => setShowPublicTransitHub(true)}>
            Search
          </button>
        </div>

        <div className="dashboard-section">
          <h2> Rental Service </h2>
          <p className="section-info">Find and manage rental services</p>
          <div className="rental-actions">
            <button className="action-btn" onClick={() => setShowBixiRental(true)}>
              Bixi Rental
            </button>
            <button className="action-btn" onClick={() => setShowVehicleRental(true)}>
              Vehicle Rental
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

export default UserDashboard
