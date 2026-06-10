import React, { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function firstDayPrevMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10)
}
function lastDayPrevMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10)
}
function firstDayOfYear() {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function StatCard({ label, value, sub, color }) {
  const { theme } = useTheme()
  return (
    <div style={{
      background: theme.surface, borderRadius: 12, padding: '20px 24px',
      flex: 1, minWidth: 180, border: `1px solid ${theme.border}`,
    }}>
      <div style={{ fontSize: 13, color: theme.textDim, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || theme.accent }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: theme.textFaint, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function QuickBtn({ label, onClick, theme }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '5px 12px', borderRadius: 6, border: `1px solid ${theme.border}`,
        background: hover ? theme.border : 'transparent',
        color: theme.textMuted, fontSize: 12, cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  )
}

export default function Dashboard() {
  const { theme } = useTheme()
  const { t } = useLang()

  // Filter state
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [appliedFrom, setAppliedFrom] = useState(firstDayOfMonth())
  const [appliedTo, setAppliedTo] = useState(todayStr())

  // Stats
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Transactions
  const [txData, setTxData] = useState(null)
  const [txLoading, setTxLoading] = useState(true)
  const [page, setPage] = useState(1)
  const LIMIT = 20

  const fetchStats = useCallback((from, to) => {
    setStatsLoading(true)
    api(`/api/stats?date_from=${from}&date_to=${to}`)
      .then(r => r.json())
      .then(d => { setStats(d); setStatsLoading(false) })
      .catch(() => setStatsLoading(false))
  }, [])

  const fetchTx = useCallback((from, to, p) => {
    setTxLoading(true)
    api(`/api/transactions?date_from=${from}&date_to=${to}&page=${p}&limit=${LIMIT}`)
      .then(r => r.json())
      .then(d => { setTxData(d); setTxLoading(false) })
      .catch(() => setTxLoading(false))
  }, [])

  useEffect(() => {
    fetchStats(appliedFrom, appliedTo)
    fetchTx(appliedFrom, appliedTo, page)
  }, [appliedFrom, appliedTo, page, fetchStats, fetchTx])

  const applyFilter = () => {
    setPage(1)
    setAppliedFrom(dateFrom)
    setAppliedTo(dateTo)
  }

  const setQuick = (from, to) => {
    setDateFrom(from)
    setDateTo(to)
    setPage(1)
    setAppliedFrom(from)
    setAppliedTo(to)
  }

  const fmtUah = v => v.toLocaleString('uk-UA', { maximumFractionDigits: 0 }) + ' ₴'
  const fmtUsdt = v => v.toLocaleString('uk-UA', { maximumFractionDigits: 2 }) + ' USDT'
  const fmtDate = iso => {
    const d = new Date(iso)
    return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      {/* ── Date filter ── */}
      <div style={{
        background: theme.surface, borderRadius: 12, padding: '16px 20px',
        marginBottom: 24, border: `1px solid ${theme.border}`,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>{t.period}:</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: theme.textDim }}>{t.dateFrom}</span>
          <input
            type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={dateInputStyle(theme)}
          />
          <span style={{ fontSize: 12, color: theme.textDim }}>{t.dateTo}</span>
          <input
            type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={dateInputStyle(theme)}
          />
        </div>

        <button
          onClick={applyFilter}
          style={{
            padding: '6px 16px', borderRadius: 7, border: 'none',
            background: theme.accent, color: theme.accentText,
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          {t.applyFilter}
        </button>

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <QuickBtn label={t.filterThisMonth} onClick={() => setQuick(firstDayOfMonth(), todayStr())} theme={theme} />
          <QuickBtn label={t.filterPrevMonth} onClick={() => setQuick(firstDayPrevMonth(), lastDayPrevMonth())} theme={theme} />
          <QuickBtn label={t.filterThisYear} onClick={() => setQuick(firstDayOfYear(), todayStr())} theme={theme} />
        </div>
      </div>

      {/* ── Stat cards ── */}
      {statsLoading ? (
        <div style={{ color: theme.textDim, marginBottom: 32 }}>{t.loading}</div>
      ) : stats ? (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          <StatCard label={t.statSold} value={fmtUah(stats.total_sold_uah)} color={theme.green} />
          <StatCard label={t.statBought} value={fmtUah(stats.total_bought_uah)} color={theme.red} />
          <StatCard
            label={t.statProfit}
            value={fmtUah(stats.estimated_profit_uah)}
            color={stats.estimated_profit_uah >= 0 ? theme.green : theme.red}
            sub={t.statProfitSub}
          />
          <StatCard label={t.statDeposit} value={fmtUsdt(stats.total_deposited_usdt)} color={theme.purple} />
        </div>
      ) : (
        <div style={{ color: theme.red, marginBottom: 32 }}>{t.error}</div>
      )}

      {/* ── Transactions table ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: theme.textMuted }}>{t.recentTx}</h2>
        {txData && (
          <span style={{ fontSize: 13, color: theme.textDim }}>
            {t.pageOf(txData.page, txData.pages || 1)} · {txData.total} {txData.total === 1 ? 'запис' : 'записів'}
          </span>
        )}
      </div>

      <div style={{ background: theme.surface, borderRadius: 12, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
        {txLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: theme.textDim }}>{t.loading}</div>
        ) : !txData || txData.items.length === 0 ? (
          <div style={{ padding: 24, color: theme.textFaint, textAlign: 'center' }}>{t.noData}</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {[t.colType, t.colDate, t.colUsdt, t.colUah, t.colPrice, t.colCounterparty].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left',
                        color: theme.textDim, fontWeight: 500, whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txData.items.map((tx, i) => (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: `1px solid ${theme.borderLight}`,
                        background: i % 2 === 0 ? 'transparent' : theme.surface2,
                      }}
                    >
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{t[tx.type] || tx.type}</td>
                      <td style={{ padding: '10px 16px', color: theme.textDim, whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{tx.usdt_amount != null ? `${tx.usdt_amount} USDT` : '—'}</td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{tx.uah_amount != null ? `${Number(tx.uah_amount).toLocaleString('uk-UA')} ₴` : '—'}</td>
                      <td style={{ padding: '10px 16px', color: theme.textMuted, whiteSpace: 'nowrap' }}>{tx.price_per_usdt != null ? `${tx.price_per_usdt} ₴` : '—'}</td>
                      <td style={{ padding: '10px 16px', color: theme.textDim, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.counterparty || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {txData.pages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 16px', borderTop: `1px solid ${theme.border}`,
              }}>
                <PaginationBtn
                  label={t.prevPage}
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  theme={theme}
                />
                {Array.from({ length: txData.pages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === txData.pages || Math.abs(p - page) <= 2)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === '…'
                      ? <span key={`e${i}`} style={{ color: theme.textDim, padding: '0 4px' }}>…</span>
                      : <PaginationBtn
                          key={p}
                          label={String(p)}
                          active={p === page}
                          onClick={() => setPage(p)}
                          theme={theme}
                        />
                  )
                }
                <PaginationBtn
                  label={t.nextPage}
                  disabled={page === txData.pages}
                  onClick={() => setPage(p => p + 1)}
                  theme={theme}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PaginationBtn({ label, onClick, disabled, active, theme }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px', borderRadius: 6,
        border: active ? 'none' : `1px solid ${theme.border}`,
        background: active ? theme.accent : disabled ? 'transparent' : 'transparent',
        color: active ? theme.accentText : disabled ? theme.textFaint : theme.textMuted,
        fontWeight: active ? 700 : 400,
        fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        minWidth: 36,
      }}
    >
      {label}
    </button>
  )
}

function dateInputStyle(theme) {
  return {
    padding: '6px 10px', borderRadius: 7,
    border: `1px solid ${theme.border}`,
    background: theme.inputBg, color: theme.text,
    fontSize: 13, outline: 'none',
  }
}
