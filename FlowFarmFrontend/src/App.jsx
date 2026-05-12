// src/App.jsx
import './App.css'
import { useEffect, useState } from 'react'
import Game from './components/Game'
import { login, logout, me, register } from './services/authAPI'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('login')
  const [error, setError] = useState(null)
  const [view, setView] = useState('game')

  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await me()
        if (!cancelled) setUser(res.user)
      } catch {
        // not logged in
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      if (mode === 'register') {
        const res = await register({ email, username, password })
        setUser(res.user)
      } else {
        const res = await login({ identifier, password })
        setUser(res.user)
      }
    } catch (err) {
      setError(err?.message || String(err))
    }
  }

  const onLogout = async () => {
    try {
      await logout()
    } finally {
      setUser(null)
      setView('game')
    }
  }

  if (loading) {
    return <div className="App">Loading…</div>
  }

  if (!user) {
    return (
      <div className="App">
        <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Grow-n-Flow</h2>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => { setMode('login'); setError(null) }} disabled={mode === 'login'}>
              Login
            </button>
            <button type="button" onClick={() => { setMode('register'); setError(null) }} disabled={mode === 'register'}>
              Register
            </button>
          </div>

          <form onSubmit={onSubmit}>
            {mode === 'register' ? (
              <>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  Email
                  <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
                </label>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  Username (optional)
                  <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%' }} />
                </label>
              </>
            ) : (
              <label style={{ display: 'block', marginBottom: 8 }}>
                Email or Username
                <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} style={{ width: '100%' }} />
              </label>
            )}

            <label style={{ display: 'block', marginBottom: 12 }}>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%' }} />
            </label>

            {error && (
              <div style={{ marginBottom: 12, color: 'crimson' }}>{error}</div>
            )}

            <button type="submit">{mode === 'register' ? 'Create account' : 'Login'}</button>
          </form>
        </div>
      </div>
    )
  }

  if (view === 'account') {
    return (
      <div className="App">
        <div style={{ maxWidth: 420, margin: '40px auto', padding: 16, color: 'white' }}>
          <h2 style={{ marginTop: 0 }}>Grow-n-Flow</h2>

          <div style={{ marginBottom: 12 }}>
            <div><strong>Logged in as</strong></div>
            <div>Email: {user?.email || '—'}</div>
            <div>Username: {user?.username || '—'}</div>
            <div>User ID: {user?.id || '—'}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setView('game')}>Back to game</button>
            <button type="button" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      <Game onTitleClick={() => setView('account')} />
    </div>
  )
}

export default App