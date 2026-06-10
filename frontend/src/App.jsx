import React, { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Cards from './pages/Cards'
import Upload from './pages/Upload'

const tabs = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'cards', label: 'Карти' },
  { id: 'upload', label: 'Завантажити скрін' },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#38bdf8' }}>
        OKX P2P Tracker
      </h1>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
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
