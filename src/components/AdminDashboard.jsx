import { useEffect, useState } from "react";
import "../styles/AdminDashboard.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function AdminDashboard({ admin, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/analytics`);
      const data = await res.json();

      if (!res.ok) {
        setError(data?.detail || "Failed to fetch analytics");
        return;
      }

      setStats(data);
      setError("");
    } catch {
      setError("Unable to connect to backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, []);

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

      <div className="dashboard-content">
        {loading && <p>Loading analytics...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        {stats && (
          <div className="analytics-grid">

            <div className="card">
              <h3>Total Requests</h3>
              <p>{stats.total_requests}</p>
            </div>

            <div className="card">
              <h3>Parking Searches</h3>
              <p>{stats.parking_searches}</p>
            </div>

            <div className="card">
              <h3>Admin Logins</h3>
              <p>{stats.admin_logins}</p>
            </div>

            <div className="card">
              <h3>User Logins</h3>
              <p>{stats.user_logins}</p>
            </div>

            <div className="card full-width">
              <h3>Service Usage</h3>
              <ul>
                {Object.entries(stats.service_usage).map(([key, value]) => (
                  <li key={key}>
                    {key}: {value}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;