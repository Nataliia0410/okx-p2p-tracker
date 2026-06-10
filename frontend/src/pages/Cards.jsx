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

const inputStyle = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #334155',
  background: '#0f1117', color: '#e2e8f0', fontSize: 13, width: '100%', boxSizing: 'border-box',
}

const btnStyle = (bg = '#38bdf8', fg = '#0f1117') => ({
  padding: '5px 11px', borderRadius: 6, border: 'none',
  background: bg, color: fg, fontWeight: 600, cursor: 'pointer', fontSize: 12,
})

export default function Cards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [newCard, setNewCard] = useState({ name: '', bank: '', monthly_limit: '' })
  const [editUsage, setEditUsage] = useState({})
  const [editCard, setEditCard] = useState(null) // { id, name, bank, monthly_limit }
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
    setEditUsage(p => ({ ...p, [cardId]: '' }))
    load()
  }

  const resetUsage = async (cardId) => {
    if (!window.confirm('Скинути використання до 0?')) return
    await api(`/api/cards/${cardId}/usage?amount=0`, { method: 'PUT' })
    load()
  }

  const deleteCard = async (cardId, name) => {
    if (!window.confirm(`Видалити карту "${name}"?`)) return
    await api(`/api/cards/${cardId}`, { method: 'DELETE' })
    load()
  }

  const saveEditCard = async () => {
    if (!editCard.name || !editCard.monthly_limit) return
    setSaving(true)
    await api(`/api/cards/${editCard.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editCard.name,
        bank: editCard.bank || null,
        monthly_limit: parseFloat(editCard.monthly_limit),
      }),
    })
    setSaving(false)
    setEditCard(null)
    load()
  }

  if (loading) return <div style={{ color: '#64748b' }}>Завантаження...</div>

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#94a3b8' }}>Ліміти карт (поточний місяць)</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 40 }}>
        {cards.map(card => (
          <div key={card.id} style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>

            {editCard?.id === card.id ? (
              /* ── Edit mode ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={inputStyle} placeholder="Назва" value={editCard.name}
                  onChange={e => setEditCard(p => ({ ...p, name: e.target.value }))} />
                <input style={inputStyle} placeholder="Банк (необов'язково)" value={editCard.bank || ''}
                  onChange={e => setEditCard(p => ({ ...p, bank: e.target.value }))} />
                <input style={inputStyle} type="number" placeholder="Місячний ліміт ₴" value={editCard.monthly_limit}
                  onChange={e => setEditCard(p => ({ ...p, monthly_limit: e.target.value }))} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={saveEditCard} disabled={saving} style={btnStyle('#4ade80')}>Зберегти</button>
                  <button onClick={() => setEditCard(null)} style={btnStyle('#334155', '#e2e8f0')}>Скасувати</button>
                </div>
              </div>
            ) : (
              /* ── View mode ── */
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600 }}>{card.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {card.bank && <span style={{ fontSize: 12, color: '#64748b' }}>{card.bank}</span>}
                    <button
                      onClick={() => setEditCard({ id: card.id, name: card.name, bank: card.bank || '', monthly_limit: card.monthly_limit })}
                      title="Редагувати"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
                    >✏️</button>
                    <button
                      onClick={() => deleteCard(card.id, card.name)}
                      title="Видалити карту"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
                    >🗑️</button>
                  </div>
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
                  <button onClick={() => saveUsage(card.id)} disabled={saving} style={btnStyle()}>Зберегти</button>
                  {card.used_amount > 0 && (
                    <button onClick={() => resetUsage(card.id)} title="Скинути до 0" style={btnStyle('#334155', '#ef4444')}>✕</button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#94a3b8' }}>Додати карту</h2>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[
          { key: 'name', placeholder: 'Назва (напр. Mono 1)' },
          { key: 'bank', placeholder: "Банк (необов'язково)" },
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
