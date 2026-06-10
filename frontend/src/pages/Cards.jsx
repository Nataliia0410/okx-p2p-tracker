import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { useTheme } from '../ThemeContext'

function ProgressBar({ percent, theme }) {
  const color = percent >= 90 ? theme.red : percent >= 70 ? '#f59e0b' : theme.green
  return (
    <div style={{ background: theme.bg, borderRadius: 99, height: 10, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s' }} />
    </div>
  )
}

export default function Cards() {
  const { theme } = useTheme()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [newCard, setNewCard] = useState({ name: '', bank: '', monthly_limit: '' })
  const [editUsage, setEditUsage] = useState({})
  const [editCard, setEditCard] = useState(null)
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

  const inp = (extra = {}) => ({
    padding: '6px 10px', borderRadius: 6,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.text, fontSize: 13, boxSizing: 'border-box', ...extra,
  })

  const btn = (bg, fg = theme.accentText, extra = {}) => ({
    padding: '5px 11px', borderRadius: 6, border: 'none',
    background: bg, color: fg, fontWeight: 600, cursor: 'pointer', fontSize: 12, ...extra,
  })

  if (loading) return <div style={{ color: theme.textDim }}>Завантаження...</div>

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: theme.textMuted }}>
        Ліміти карт (поточний місяць)
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 40 }}>
        {cards.map(card => (
          <div key={card.id} style={{ background: theme.surface, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }}>

            {editCard?.id === card.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={inp({ width: '100%' })} placeholder="Назва" value={editCard.name}
                  onChange={e => setEditCard(p => ({ ...p, name: e.target.value }))} />
                <input style={inp({ width: '100%' })} placeholder="Банк (необов'язково)" value={editCard.bank || ''}
                  onChange={e => setEditCard(p => ({ ...p, bank: e.target.value }))} />
                <input style={inp({ width: '100%' })} type="number" placeholder="Місячний ліміт ₴" value={editCard.monthly_limit}
                  onChange={e => setEditCard(p => ({ ...p, monthly_limit: e.target.value }))} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={saveEditCard} disabled={saving} style={btn(theme.green, '#0f1117')}>Зберегти</button>
                  <button onClick={() => setEditCard(null)} style={btn(theme.border, theme.textMuted)}>Скасувати</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, color: theme.text }}>{card.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {card.bank && <span style={{ fontSize: 12, color: theme.textDim }}>{card.bank}</span>}
                    <button
                      onClick={() => setEditCard({ id: card.id, name: card.name, bank: card.bank || '', monthly_limit: card.monthly_limit })}
                      title="Редагувати"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: 14, padding: '0 2px', lineHeight: 1 }}
                    >✏️</button>
                    <button
                      onClick={() => deleteCard(card.id, card.name)}
                      title="Видалити карту"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.red, fontSize: 14, padding: '0 2px', lineHeight: 1 }}
                    >🗑️</button>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 4 }}>
                  {card.used_amount.toLocaleString('uk-UA')} ₴ з {card.monthly_limit.toLocaleString('uk-UA')} ₴
                </div>
                <div style={{ fontSize: 12, color: card.percent >= 90 ? theme.red : card.percent >= 70 ? '#f59e0b' : theme.green }}>
                  {card.percent}% використано · залишок {card.remaining.toLocaleString('uk-UA')} ₴
                </div>
                <ProgressBar percent={card.percent} theme={theme} />

                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    placeholder="Ввести витрачено ₴"
                    value={editUsage[card.id] || ''}
                    onChange={e => setEditUsage(p => ({ ...p, [card.id]: e.target.value }))}
                    style={inp({ flex: 1 })}
                  />
                  <button onClick={() => saveUsage(card.id)} disabled={saving} style={btn(theme.accent)}>Зберегти</button>
                  {card.used_amount > 0 && (
                    <button onClick={() => resetUsage(card.id)} title="Скинути до 0" style={btn(theme.surface2, theme.red)}>✕</button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: theme.textMuted }}>Додати карту</h2>
      <div style={{ background: theme.surface, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}`, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
            style={inp({ minWidth: 200, padding: '8px 12px', borderRadius: 8, fontSize: 14 })}
          />
        ))}
        <button onClick={createCard} style={btn(theme.green, '#0f1117', { padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700 })}>
          Додати
        </button>
      </div>
    </div>
  )
}
