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

  const travelTools = [
    {
      category: 'Trip Planning',
      title: 'Find Parking',
      description: 'Search for nearby parking spots and open the map around your destination.',
      actionLabel: 'Search Parking',
      onClick: openParkingMap,
    },
    {
      category: 'Ride Handoff',
      title: 'Find My Uber',
      description: 'Pick a location on the map and jump straight into Uber with that pickup point.',
      actionLabel: 'Open Uber Map',
      onClick: openUberBixiMap,
    },
    {
      category: 'Transit',
      title: 'Public Transit',
      description: 'Plan routes with bus, metro, and walking directions in one place.',
      actionLabel: 'Plan Transit Trip',
      onClick: openPublicTransitHub,
    },
  ]

  const rentalTools = [
    {
      category: 'Bike Rentals',
      title: 'BIXI Rental',
      description: 'Reserve bikes, track your rental flow, and return rides when you are done.',
      actionLabel: 'Open BIXI Rental',
      onClick: openBixiRental,
    },
    {
      category: 'Garage',
      title: 'Vehicle Management',
      description: 'Manage your vehicles, marketplace listings, and available vehicle rentals.',
      actionLabel: 'Open Vehicle Management',
      onClick: openVehicleRental,
    },
  ]

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
        <div className="dashboard-copy">
          <h1>Welcome to CityFlow</h1>
          <p className="welcome-text">Hello, {user.name}!</p>
          <p className="dashboard-subtext">Choose a tool below to plan your trip or manage your rentals.</p>
          <p className="user-email">{user.email}</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="dashboard-sections">
        <section className="dashboard-subsection">
          <div className="dashboard-grid">
            {travelTools.map((tool) => (
              <div key={tool.title} className="dashboard-section">
                <span className="dashboard-section-tag">{tool.category}</span>
                <h2>{tool.title}</h2>
                <p className="section-info">{tool.description}</p>
                <button className="action-btn" onClick={tool.onClick}>
                  {tool.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-subsection">
          <div className="dashboard-grid dashboard-grid-compact">
            {rentalTools.map((tool) => (
              <div key={tool.title} className="dashboard-section">
                <span className="dashboard-section-tag">{tool.category}</span>
                <h2>{tool.title}</h2>
                <p className="section-info">{tool.description}</p>
                <button className="action-btn" onClick={tool.onClick}>
                  {tool.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default UserDashboard
