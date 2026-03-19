import { useState, useEffect } from 'react'
import { api } from '../../services/api'

const TOKEN_KEY = 'lh_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export default function LoginGate({ children }) {
  const [authenticated, setAuthenticated] = useState(!!getToken())
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Verify token on mount
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setChecking(false)
      setAuthenticated(false)
      return
    }
    api.get('/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => {
        setAuthenticated(true)
        setChecking(false)
      })
      .catch(() => {
        clearToken()
        setAuthenticated(false)
        setChecking(false)
      })
  }, [])

  // Listen for 401 events from api interceptor
  useEffect(() => {
    const handler = () => {
      clearToken()
      setAuthenticated(false)
    }
    window.addEventListener('lh-auth-expired', handler)
    return () => window.removeEventListener('lh-auth-expired', handler)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { username, password })
      setToken(res.data.token)
      setAuthenticated(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Prihlaseni selhalo')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-navy-800 flex items-center justify-center">
        <div className="text-2xl text-theme-primary">Overovani...</div>
      </div>
    )
  }

  if (authenticated) {
    return children
  }

  return (
    <div className="min-h-screen bg-navy-800 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-black text-theme-primary mb-2">
          Label<span className="text-brand-orange">Hunter</span>
        </h1>
        <p className="text-xl text-theme-secondary">MROAUTO AUTODILY s.r.o.</p>
      </div>

      {/* Login form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-navy-700 border border-navy-500 rounded-2xl p-8 shadow-2xl"
      >
        <h2 className="text-2xl font-bold text-theme-primary text-center mb-6">
          Prihlaseni do systemu
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-theme-secondary mb-1">
              Uzivatelske jmeno
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
              className="w-full bg-navy-800 border border-navy-500 rounded-lg px-4 py-3 text-theme-primary text-lg focus:outline-none focus:border-brand-orange"
            />
          </div>

          <div>
            <label className="block text-sm text-theme-secondary mb-1">
              Heslo
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-navy-800 border border-navy-500 rounded-lg px-4 py-3 text-theme-primary text-lg focus:outline-none focus:border-brand-orange"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 text-white rounded-lg py-3 font-bold text-lg transition-colors mt-2"
          >
            {loading ? 'Prihlasuji...' : 'Prihlasit se'}
          </button>
        </div>
      </form>
    </div>
  )
}
