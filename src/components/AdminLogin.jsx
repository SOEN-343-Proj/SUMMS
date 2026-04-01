import '../styles/Login.css'
import { useAdminLoginController } from '../controllers/useAuthControllers'

function AdminLogin({ onSuccess, onBack }) {
  const {
    email,
    password,
    error,
    isLoading,
    setEmail,
    setPassword,
    handleSubmit,
  } = useAdminLoginController({ onSuccess })

  return (
    <div className="login-container">
      <h2>Admin Login</h2>
      <p className="info-text">Enter your admin credentials</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Admin Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter admin email"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="button-group">
          <button type="submit" className="submit-btn">
            {isLoading ? 'Logging in...' : 'Login as Admin'}
          </button>
          <button type="button" className="back-btn" onClick={onBack}>
            Back
          </button>
        </div>
      </form>

      <div className="hint-text">
        <strong>Demo Credentials:</strong><br/>
        Email: admin@cityflow.com<br/>
        Password: SecureAdmin123!<br/>
        Admin Code: ADMIN2025
      </div>
    </div>
  )
}

export default AdminLogin
