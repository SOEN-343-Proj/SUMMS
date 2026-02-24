import { useState } from 'react'
import '../styles/Login.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function UserLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Basic validation
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (isSignUp) {
      if (!name) {
        setError('Please enter your name')
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/auth/user/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, email, password })
        })

        const data = await response.json()
        if (!response.ok) {
          setError(data?.detail || 'Registration failed')
          return
        }

        setError('')
        onSuccess(data.user)
      } catch {
        setError('Unable to connect to server. Please try again.')
      } finally {
        setIsLoading(false)
      }
    } else {
      setIsLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/auth/user/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        })

        const data = await response.json()
        if (!response.ok) {
          setError(data?.detail || 'Invalid email or password')
          return
        }

        setError('')
        onSuccess(data.user)
      } catch {
        setError('Unable to connect to server. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
  }

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
              onClick={() => {
                setIsSignUp(false)
                setError('')
                setName('')
              }}
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
                onClick={() => {
                  setIsSignUp(true)
                  setError('')
                }}
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
