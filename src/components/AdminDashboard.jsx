import { useAdminDashboardController } from "../controllers/useAdminDashboardController";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import "../styles/AdminDashboard.css";

const PIE_COLORS = ["#e1ff73", "#667eea", "#f093fb", "#f5576c", "#43e97b"];

const EVENT_LABELS = {
  admin_login: "Admin Login",
  user_login: "User Login",
  parking_search: "Parking Search",
  uber_bixi_search: "Uber/Bixi Search",
  bixi_reserved: "Bixi Reserved",
  bixi_payment: "Bixi Payment",
  bixi_returned: "Bixi Returned",
  vehicle_rented: "Vehicle Rented",
  vehicle_returned: "Vehicle Returned",
  vehicle_listed: "Vehicle Listed",
  transit_route_searched: "Transit Route Search",
  feature_opened: "Feature Opened",
};

const EVENT_ICONS = {
  admin_login: "🔐",
  user_login: "👤",
  parking_search: "🅿️",
  uber_bixi_search: "🚲",
  bixi_reserved: "🚲",
  bixi_payment: "💳",
  bixi_returned: "✅",
  vehicle_rented: "🚗",
  vehicle_returned: "🏁",
  vehicle_listed: "📋",
  transit_route_searched: "🚌",
  feature_opened: "📂",
};

function formatHour(isoKey) {
  const date = new Date(isoKey);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildHourlyChartData(hourlyBuckets) {
  if (!hourlyBuckets || Object.keys(hourlyBuckets).length === 0) return [];

  const now = new Date();
  const slots = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(d.getUTCHours() - i);
    const key = d.toISOString().slice(0, 13) + ":00:00+00:00";
    slots.push({ key, label: formatHour(d) });
  }

  return slots.map(({ key, label }) => ({
    hour: label,
    requests: hourlyBuckets[key] || 0,
  }));
}

function buildPieData(serviceUsage) {
  // Exclude login entries
  const excluded = new Set(["admin_login", "user_login"]);
  const labelMap = {
    parking: "Parking",
    uber_bixi: "Uber/Bixi",
    bixi: "Bixi",
    vehicle_rental: "Vehicle Rental",
    transit: "Transit",
  };
  return Object.entries(serviceUsage)
    .filter(([key]) => !excluded.has(key))
    .map(([key, value]) => ({
      name: labelMap[key] || key,
      value,
    }));
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-value">{payload[0].value} requests</p>
      </div>
    );
  }
  return null;
};

function AdminDashboard({ admin, onLogout }) {
  const { stats, loading, error, lastUpdated, fetchAnalytics } = useAdminDashboardController()

  const hourlyData = stats ? buildHourlyChartData(stats.hourly_buckets) : [];
  const pieData = stats ? buildPieData(stats.service_usage) : [];

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="welcome-text">Welcome, {admin.name}</p>
          <p className="admin-code">Admin Code: {admin.code}</p>
        </div>
        <div className="header-right">
          {lastUpdated && (
            <p className="last-updated">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
            </p>
          )}
          <button className="refresh-btn" onClick={fetchAnalytics}>↻ Refresh</button>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="dashboard-content">
        {loading && <p className="loading-text">Loading analytics...</p>}
        {error && <p className="error-text">{error}</p>}

        {stats && (
          <>
            {/* ── Stat Cards ── */}
            <div className="stat-cards">
              <div className="card">
                <span className="card-icon">🌐</span>
                <div>
                  <h3>Total Requests</h3>
                  <p>{stats.total_requests.toLocaleString()}</p>
                </div>
              </div>
              <div className="card">
                <span className="card-icon">🔐</span>
                <div>
                  <h3>Admin Logins</h3>
                  <p>{stats.admin_logins.toLocaleString()}</p>
                </div>
              </div>
              <div className="card">
                <span className="card-icon">👤</span>
                <div>
                  <h3>User Logins</h3>
                  <p>{stats.user_logins.toLocaleString()}</p>
                </div>
              </div>
              <div className="card">
                <span className="card-icon">🅿️</span>
                <div>
                  <h3>Parking Searches</h3>
                  <p>{stats.parking_searches.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* ── Service Stat Cards ── */}
            <div className="stat-cards">
              <div className="card">
                <span className="card-icon">🚲</span>
                <div>
                  <h3>Bixi Reservations</h3>
                  <p>{(stats.bixi_reservations ?? 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="card">
                <span className="card-icon">✅</span>
                <div>
                  <h3>Bixi Rides Completed</h3>
                  <p>{(stats.bixi_rides_completed ?? 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="card">
                <span className="card-icon">🚗</span>
                <div>
                  <h3>Vehicle Rentals</h3>
                  <p>{(stats.vehicle_rentals ?? 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="card">
                <span className="card-icon">🚌</span>
                <div>
                  <h3>Transit Searches</h3>
                  <p>{(stats.transit_searches ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* ── Charts Row ── */}
            <div className="charts-row">
              <div className="chart-box wide">
                <h3>Activity — Last 24 Hours</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={hourlyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "#999", fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      interval={3}
                    />
                    <YAxis
                      tick={{ fill: "#999", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="requests"
                      stroke="#e1ff73"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, fill: "#e1ff73", stroke: "#282c34", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-box">
                <h3>Service Breakdown</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span style={{ color: "#ccc", fontSize: "12px" }}>{value}</span>
                        )}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(30,35,45,0.95)",
                          border: "1px solid rgba(225,255,115,0.3)",
                          borderRadius: "8px",
                          color: "#fff",
                          fontSize: "13px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="no-data">No service data yet</p>
                )}
              </div>
            </div>

            {/* ── Recent Events Feed ── */}
            <div className="event-feed">
              <h3>Recent Activity</h3>
              {stats.event_log && stats.event_log.length > 0 ? (
                <ul className="event-list scrollable">
                  {stats.event_log.slice(0, 50).map((entry, i) => (
                    <li key={i} className="event-item">
                      <span className="event-icon">
                        {EVENT_ICONS[entry.event] || "•"}
                      </span>
                      <span className="event-label">
                        {EVENT_LABELS[entry.event] || entry.event}
                        {entry.data?.email && (
                          <span className="event-meta"> — {entry.data.email}</span>
                        )}
                        {entry.data?.make && (
                          <span className="event-meta"> — {entry.data.make} {entry.data.model}</span>
                        )}
                        {entry.data?.station_name && (
                          <span className="event-meta"> — {entry.data.station_name}</span>
                        )}
                        {entry.data?.origin && (
                          <span className="event-meta"> — {entry.data.origin} → {entry.data.destination}</span>
                        )}
                        {entry.data?.feature && (
                          <span className="event-meta"> — {entry.data.feature}</span>
                        )}
                        {entry.data?.lat !== undefined && (
                          <span className="event-meta">
                            {" "}— {entry.data.lat.toFixed(3)}, {entry.data.lng.toFixed(3)}
                          </span>
                        )}
                      </span>
                      <span className="event-time">{formatTimestamp(entry.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-data">No events recorded yet</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
