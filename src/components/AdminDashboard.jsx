import '../styles/AdminDashboard.css'

function AdminDashboard({ admin, onLogout }) {
  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="welcome-text">Welcome, {admin.name}</p>
          <p className="admin-code">Admin Code: {admin.code}</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>

    </div>
  )
}

export default AdminDashboard
