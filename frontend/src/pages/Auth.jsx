import React, { useState } from 'react'
import { useAuth } from '../AuthContext'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

export default function Auth() {
  const { login, register } = useAuth()
  const { theme } = useTheme()
  const { t } = useLang()
  const [mode, setMode] = useState('login')
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
      background: theme.bg,
    }}>
      <div style={{
        background: theme.surface, borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 400, boxShadow: theme.shadow,
        border: `1px solid ${theme.border}`,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: theme.accent, marginBottom: 4 }}>
          {t.appTitle}
        </h1>
        <p style={{ fontSize: 13, color: theme.textDim, marginBottom: 32 }}>
          {mode === 'login' ? t.authLogin : t.authRegister}
        </p>

        <form onSubmit={submit}>
          <label style={labelStyle(theme)}>{t.authEmail}</label>
          <input
            type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle(theme)}
          />

          <label style={{ ...labelStyle(theme), marginTop: 16 }}>{t.authPassword}</label>
          <input
            type="password" required value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={inputStyle(theme)}
          />

          {error && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: theme.name === 'dark' ? '#2a0f0f' : '#fef2f2',
              borderRadius: 8, border: `1px solid ${theme.red}33`,
              color: theme.red, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 24, width: '100%', padding: '13px',
              borderRadius: 8, border: 'none',
              background: loading ? theme.border : theme.accent,
              color: loading ? theme.textDim : theme.accentText,
              fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '...' : mode === 'login' ? t.authSubmitLogin : t.authSubmitRegister}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: theme.textDim }}>
          {mode === 'login' ? (
            <>{t.authGoRegister}{' '}
              <button onClick={() => { setMode('register'); setError(null) }} style={linkStyle(theme)}>
                {t.authLinkRegister}
              </button>
            </>
          ) : (
            <>{t.authGoLogin}{' '}
              <button onClick={() => { setMode('login'); setError(null) }} style={linkStyle(theme)}>
                {t.authLinkLogin}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle = (theme) => ({
  display: 'block', fontSize: 12, fontWeight: 600,
  color: theme.textMuted, marginBottom: 6,
  letterSpacing: '0.05em', textTransform: 'uppercase',
})
const inputStyle = (theme) => ({
  width: '100%', padding: '11px 14px', borderRadius: 8,
  border: `1px solid ${theme.border}`, background: theme.inputBg,
  color: theme.text, fontSize: 15, outline: 'none', boxSizing: 'border-box',
})
const linkStyle = (theme) => ({
  background: 'none', border: 'none', color: theme.accent,
  cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline',
})
