import React, { useEffect, useState } from 'react'
import { api } from '../api'

const TYPE_LABELS = {
  buy_usdt: '🟢 Купівля USDT',
  sell_usdt: '🔴 Продаж USDT',
  deposit: '💰 Поповнення',
  withdrawal: '📤 Виведення',
  cancel_order: '↩️ Скасування',
  internal: '🔄 Внутрішній',
  other: '❓ Інше',
}

function StatCard({ label, value, sub, color = '#38bdf8' }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: '20px 24px', flex: 1, minWidth: 180 }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: '#64748b' }}>Завантаження...</div>
  if (!stats) return <div style={{ color: '#ef4444' }}>Помилка завантаження</div>

  return (
    <div>
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
        Місяць: <strong style={{ color: '#e2e8f0' }}>{stats.month}</strong>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <StatCard label="Продано USDT → UAH" value={`${stats.total_sold_uah.toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ₴`} color="#4ade80" />
        <StatCard label="Витрачено UAH на покупку" value={`${stats.total_bought_uah.toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ₴`} color="#f87171" />
        <StatCard label="Прибуток P2P" value={`${stats.estimated_profit_uah.toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ₴`} color={stats.estimated_profit_uah >= 0 ? '#4ade80' : '#f87171'} sub="продажі − покупки" />
        <StatCard label="Поповнення USDT" value={`${stats.total_deposited_usdt.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} USDT`} color="#a78bfa" />
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#94a3b8' }}>Останні транзакції</h2>
      <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
        {stats.recent_transactions.length === 0 ? (
          <div style={{ padding: 24, color: '#475569', textAlign: 'center' }}>Немає даних. Завантажте скріншоти.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {['Тип', 'Дата', 'USDT', 'UAH', 'Ціна', 'Контрагент'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.recent_transactions.map(tx => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #1a2744' }}>
                  <td style={{ padding: '10px 16px' }}>{TYPE_LABELS[tx.type] || tx.type}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>
                    {new Date(tx.date).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 16px' }}>{tx.usdt_amount != null ? `${tx.usdt_amount} USDT` : '—'}</td>
                  <td style={{ padding: '10px 16px' }}>{tx.uah_amount != null ? `${tx.uah_amount} ₴` : '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{tx.price_per_usdt != null ? `${tx.price_per_usdt} ₴` : '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{tx.counterparty || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
