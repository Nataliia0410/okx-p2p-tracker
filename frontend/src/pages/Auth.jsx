import React, { useState } from 'react'
import { useAuth } from '../AuthContext'

export default function Auth() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f1117',
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 400,
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>
          OKX P2P Tracker
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 32 }}>
          {mode === 'login' ? 'Вхід в акаунт' : 'Реєстрація нового акаунту'}
        </p>

        <form onSubmit={submit}>
          <label style={labelStyle}>Email</label>
          <input
            type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 16 }}>Пароль</label>
          <input
            type="password" required value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={inputStyle}
          />

          {error && (
            <div style={{
              marginTop: 16, padding: '10px 14px', background: '#2a0f0f',
              borderRadius: 8, border: '1px solid #991b1b', color: '#f87171', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 24, width: '100%', padding: '13px',
              borderRadius: 8, border: 'none',
              background: loading ? '#334155' : '#38bdf8',
              color: loading ? '#64748b' : '#0f1117',
              fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '...' : mode === 'login' ? 'Увійти' : 'Зареєструватися'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          {mode === 'login' ? (
            <>Ще немає акаунту?{' '}
              <button onClick={() => { setMode('register'); setError(null) }} style={linkStyle}>
                Реєстрація
              </button>
            </>
          ) : (
            <>Вже є акаунт?{' '}
              <button onClick={() => { setMode('login'); setError(null) }} style={linkStyle}>
                Увійти
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#94a3b8', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase',
}

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 8,
  border: '1px solid #334155', background: '#0f1117',
  color: '#e2e8f0', fontSize: 15, outline: 'none',
  boxSizing: 'border-box',
}

const linkStyle = {
  background: 'none', border: 'none', color: '#38bdf8',
  cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline',
}
