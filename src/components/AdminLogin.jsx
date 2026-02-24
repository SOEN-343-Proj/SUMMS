import { useState } from 'react'
import '../styles/Login.css'

// Admin credentials - matches backend/credentials.py
const adminCredentials = [
  {
    email: "admin@summs.com",
    password: "SecureAdmin123!",
    name: "System Administrator",
    code: "ADMIN2025",
    role: "admin"
  }
]

function AdminLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Find matching admin
    const admin = adminCredentials.find(
      a => a.email === email && a.password === password
    )
    
    if (!admin) {
      setError('Invalid admin credentials')
      return
    }

    // Login successful
    setError('')
    onSuccess({
      email: admin.email,
      name: admin.name,
      code: admin.code,
      type: 'admin'
    })
  }

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
            Login as Admin
          </button>
          <button type="button" className="back-btn" onClick={onBack}>
            Back
          </button>
        </div>
      </form>

      <div className="hint-text">
        <strong>Demo Credentials:</strong><br/>
        Email: admin@summs.com<br/>
        Password: SecureAdmin123!<br/>
        Admin Code: ADMIN2025
      </div>
    </div>
  )
}

export default AdminLogin
