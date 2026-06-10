import React, { useEffect, useState } from 'react'
import { api } from '../api'

function ProgressBar({ percent }) {
  const color = percent >= 90 ? '#ef4444' : percent >= 70 ? '#f59e0b' : '#4ade80'
  return (
    <div style={{ background: '#0f1117', borderRadius: 99, height: 10, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s' }} />
    </div>
  )
}

export default function Cards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [newCard, setNewCard] = useState({ name: '', bank: '', monthly_limit: '' })
  const [editUsage, setEditUsage] = useState({})
  const [saving, setSaving] = useState(false)

  const load = () => {
    api('/api/cards').then(r => r.json()).then(d => { setCards(d); setLoading(false) })
  }

  useEffect(load, [])

  const createCard = async () => {
    if (!newCard.name || !newCard.monthly_limit) return
    await api('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newCard, monthly_limit: parseFloat(newCard.monthly_limit) }),
    })
    setNewCard({ name: '', bank: '', monthly_limit: '' })
    load()
  }

  const saveUsage = async (cardId) => {
    const amount = parseFloat(editUsage[cardId])
    if (isNaN(amount)) return
    setSaving(true)
    await api(`/api/cards/${cardId}/usage?amount=${amount}`, { method: 'PUT' })
    setSaving(false)
    load()
  }

  if (loading) return <div style={{ color: '#64748b' }}>Завантаження...</div>

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#94a3b8' }}>Ліміти карт (поточний місяць)</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 40 }}>
        {cards.map(card => (
          <div key={card.id} style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontWeight: 600 }}>{card.name}</div>
              {card.bank && <div style={{ fontSize: 12, color: '#64748b' }}>{card.bank}</div>}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
              {card.used_amount.toLocaleString('uk-UA')} ₴ з {card.monthly_limit.toLocaleString('uk-UA')} ₴
            </div>
            <div style={{ fontSize: 12, color: card.percent >= 90 ? '#ef4444' : card.percent >= 70 ? '#f59e0b' : '#4ade80' }}>
              {card.percent}% використано · залишок {card.remaining.toLocaleString('uk-UA')} ₴
            </div>
            <ProgressBar percent={card.percent} />

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <input
                type="number"
                placeholder="Ввести витрачено ₴"
                value={editUsage[card.id] || ''}
                onChange={e => setEditUsage(p => ({ ...p, [card.id]: e.target.value }))}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #334155', background: '#0f1117', color: '#e2e8f0', fontSize: 13 }}
              />
              <button
                onClick={() => saveUsage(card.id)}
                disabled={saving}
                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#38bdf8', color: '#0f1117', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                Зберегти
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#94a3b8' }}>Додати карту</h2>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[
          { key: 'name', placeholder: 'Назва (напр. Mono 1)' },
          { key: 'bank', placeholder: 'Банк (необов\'язково)' },
          { key: 'monthly_limit', placeholder: 'Місячний ліміт ₴', type: 'number' },
        ].map(f => (
          <input
            key={f.key}
            type={f.type || 'text'}
            placeholder={f.placeholder}
            value={newCard[f.key]}
            onChange={e => setNewCard(p => ({ ...p, [f.key]: e.target.value }))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f1117', color: '#e2e8f0', fontSize: 14, minWidth: 200 }}
          />
        ))}
        <button
          onClick={createCard}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4ade80', color: '#0f1117', fontWeight: 700, cursor: 'pointer' }}
        >
          Додати
        </button>
      </div>
    </div>
  )
}
