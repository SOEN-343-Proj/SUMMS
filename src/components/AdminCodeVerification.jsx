import '../styles/Login.css'
import { useAdminCodeController } from '../controllers/useAuthControllers'

function AdminCodeVerification({ onSuccess, onBack }) {
  const {
    adminCode,
    error,
    isLoading,
    setAdminCode,
    handleSubmit,
  } = useAdminCodeController({ onSuccess })

  return (
    <div className="login-container">
      <h2>Admin Code Verification</h2>
      <p className="info-text">Please enter your admin code to proceed</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="adminCode">Admin Code</label>
          {/* Hidden username field so browsers offer to save the password */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            defaultValue="admin"
            readOnly
            style={{ display: "none" }}
            aria-hidden="true"
          />
          <input
            type="password"
            id="adminCode"
            name="password"
            autoComplete="current-password"
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
