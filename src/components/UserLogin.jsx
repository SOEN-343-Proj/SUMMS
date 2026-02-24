import { useState } from 'react'
import '../styles/Login.css'

// User credentials - matches backend/credentials.py
let userCredentials = [
  {
    email: "john.doe@student.com",
    password: "student123",
    name: "John Doe",
    role: "user"
  },
  {
    email: "jane.smith@student.com",
    password: "student456",
    name: "Jane Smith",
    role: "user"
  },
  {
    email: "alex.wilson@student.com",
    password: "student789",
    name: "Alex Wilson",
    role: "user"
  }
]

function UserLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = (e) => {
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
      // Sign up logic
      if (!name) {
        setError('Please enter your name')
        return
      }

      // Check if email already exists
      const existingUser = userCredentials.find(u => u.email === email)
      if (existingUser) {
        setError('Email already registered. Please login instead.')
        return
      }

      // Add new user
      const newUser = {
        email,
        password,
        name,
        role: "user"
      }
      userCredentials.push(newUser)

      setError('')
      onSuccess({ email, name, role: 'user' })
    } else {
      // Login logic
      const user = userCredentials.find(
        u => u.email === email && u.password === password
      )

      if (!user) {
        setError('Invalid email or password')
        return
      }

      setError('')
      onSuccess({ email: user.email, name: user.name, role: 'user' })
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
            {isSignUp ? 'Sign Up' : 'Login'}
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
