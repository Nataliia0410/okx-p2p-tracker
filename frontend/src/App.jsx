import React, { useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Cards from './pages/Cards'
import Upload from './pages/Upload'

const tabs = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'cards', label: 'Карти' },
  { id: 'upload', label: 'Завантажити скрін' },
]

function AppInner() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('dashboard')

  // Still checking token
  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Завантаження...</div>
      </div>
    )
  }

  // Not logged in
  if (user === null) return <Auth />

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#38bdf8', margin: 0 }}>
          OKX P2P Tracker
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>{user.email}</span>
          <button
            onClick={logout}
            style={{
              padding: '6px 14px', borderRadius: 7, border: '1px solid #334155',
              background: 'transparent', color: '#94a3b8', fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Вийти
          </button>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: tab === t.id ? '#38bdf8' : '#1e293b',
              color: tab === t.id ? '#0f1117' : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && <Dashboard />}
      {tab === 'cards' && <Cards />}
      {tab === 'upload' && <Upload />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
