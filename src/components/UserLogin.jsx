import '../styles/Login.css'
import { useUserAuthController } from '../controllers/useAuthControllers'

function UserLogin({ onSuccess, onBack }) {
  const {
    email,
    password,
    name,
    error,
    isSignUp,
    isLoading,
    setEmail,
    setPassword,
    setName,
    handleSubmit,
    showSignUp,
    showLogin,
  } = useUserAuthController({ onSuccess })

  return (
    <div className="login-container">
      <h2>{isSignUp ? 'User Sign Up' : 'User Login'}</h2>
      
      <form onSubmit={handleSubmit}>
        {isSignUp && (
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
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
            placeholder="Enter your password"
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="button-group">
          <button type="submit" className="submit-btn">
            {isLoading ? (isSignUp ? 'Signing up...' : 'Logging in...') : (isSignUp ? 'Sign Up' : 'Login')}
          </button>
          <button type="button" className="back-btn" onClick={onBack}>
            Back
          </button>
        </div>
      </form>

      <div className="toggle-form">
        {isSignUp ? (
          <p>
            Already have an account?{' '}
              <button 
                className="link-btn" 
                onClick={showLogin}
              >
                Login
              </button>
          </p>
        ) : (
          <>
            <p>
              Don't have an account?{' '}
              <button 
                className="link-btn" 
                onClick={showSignUp}
              >
                Sign Up
              </button>
            </p>
            <div className="hint-text" style={{ marginTop: '15px' }}>
              <strong>Demo User Accounts:</strong><br/>
              john.doe@student.com / student123<br/>
              jane.smith@student.com / student456<br/>
              alex.wilson@student.com / student789
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default UserLogin
