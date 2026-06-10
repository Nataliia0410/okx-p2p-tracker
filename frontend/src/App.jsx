import React, { useState, useRef, useEffect } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import { ThemeProvider, useTheme } from './ThemeContext'
import { LangProvider, useLang, LANGS, LANG_LABELS } from './LangContext'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Cards from './pages/Cards'
import Upload from './pages/Upload'

// ── Language selector ──────────────────────────────────────────────────────
function LangSelector() {
  const { lang, setLanguage } = useLang()
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Language"
        style={{
          width: 36, height: 36, borderRadius: 8,
          border: `1px solid ${theme.border}`,
          background: theme.surface,
          color: theme.textMuted, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}
      >
        🌐
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 42, zIndex: 100,
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 10, overflow: 'hidden', minWidth: 100,
          boxShadow: theme.shadow,
        }}>
          {LANGS.map(l => (
            <button
              key={l}
              onClick={() => { setLanguage(l); setOpen(false) }}
              style={{
                display: 'block', width: '100%', padding: '9px 16px',
                textAlign: 'left', border: 'none', cursor: 'pointer',
                background: l === lang ? theme.accent : 'transparent',
                color: l === lang ? theme.accentText : theme.text,
                fontSize: 13, fontWeight: l === lang ? 600 : 400,
              }}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Theme toggle ──────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, themeName, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={themeName === 'dark' ? 'Switch to light' : 'Switch to dark'}
      style={{
        width: 36, height: 36, borderRadius: 8,
        border: `1px solid ${theme.border}`,
        background: theme.surface,
        color: theme.textMuted, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}
    >
      {themeName === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

// ── Main app ──────────────────────────────────────────────────────────────
function AppInner() {
  const { user, logout } = useAuth()
  const { theme, themeName } = useTheme()
  const { t } = useLang()
  const [tab, setTab] = useState('dashboard')

  // Sync body class for CSS
  useEffect(() => {
    document.body.className = themeName
    document.body.style.background = theme.bg
    document.body.style.color = theme.text
  }, [themeName, theme])

  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg }}>
        <div style={{ color: theme.textDim }}>{t.loading}</div>
      </div>
    )
  }

  if (user === null) return <Auth />

  const tabs = [
    { id: 'dashboard', label: t.tabDashboard },
    { id: 'cards', label: t.tabCards },
    { id: 'upload', label: t.tabUpload },
  ]

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, transition: 'background 0.2s' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: theme.accent, margin: 0 }}>
            {t.appTitle}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            <LangSelector />
            <span style={{ fontSize: 13, color: theme.textDim, marginLeft: 4 }}>{user.email}</span>
            <button
              onClick={logout}
              style={{
                padding: '6px 14px', borderRadius: 7,
                border: `1px solid ${theme.border}`,
                background: 'transparent', color: theme.textMuted,
                fontSize: 13, cursor: 'pointer',
              }}
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {tabs.map(tab_ => (
            <button
              key={tab_.id}
              onClick={() => setTab(tab_.id)}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontWeight: 600, fontSize: 14,
                background: tab === tab_.id ? theme.navActive : theme.navInactive,
                color: tab === tab_.id ? theme.navActiveText : theme.navInactiveText,
                transition: 'all 0.15s',
              }}
            >
              {tab_.label}
            </button>
          ))}
        </nav>

        {tab === 'dashboard' && <Dashboard />}
        {tab === 'cards' && <Cards />}
        {tab === 'upload' && <Upload />}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  )
}
