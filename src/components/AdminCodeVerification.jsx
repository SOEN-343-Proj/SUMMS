import { useState } from 'react'
import '../styles/Login.css'

// Hardcoded admin code - matches backend/credentials.py
const ADMIN_CODE = "ADMIN2025"

function AdminCodeVerification({ onSuccess, onBack }) {
  const [adminCode, setAdminCode] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (adminCode === ADMIN_CODE) {
      setError('')
      onSuccess()
    } else {
      setError('Invalid admin code. Access denied.')
      setAdminCode('')
    }
  }

  return (
    <div className="login-container">
      <h2>Admin Code Verification</h2>
      <p className="info-text">Please enter your admin code to proceed</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="adminCode">Admin Code</label>
          <input
            type="password"
            id="adminCode"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
            placeholder="Enter admin code"
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="button-group">
          <button type="submit" className="submit-btn">
            Verify Code
          </button>
          <button type="button" className="back-btn" onClick={onBack}>
            Back
          </button>
        </div>
      </form>

      <div className="hint-text">
        Note: Admin codes are assigned to authorized administrators only.
      </div>
    </div>
  )
}

export default AdminCodeVerification
