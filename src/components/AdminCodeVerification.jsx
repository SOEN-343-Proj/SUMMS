import { useState } from 'react'
import '../styles/Login.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function AdminCodeVerification({ onSuccess, onBack }) {
  const [adminCode, setAdminCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: adminCode })
      })

      const data = await response.json()

      if (response.ok && data.valid) {
        setError('')
        onSuccess()
        return
      }

      setError('Invalid admin code. Access denied.')
      setAdminCode('')
    } catch {
      setError('Unable to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
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
            {isLoading ? 'Verifying...' : 'Verify Code'}
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
