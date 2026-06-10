import React, { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../api'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

// ── Date helpers ───────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
const firstPrevMonth = () => {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10)
}
const lastPrevMonth = () => {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10)
}
const firstOfYear = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

// ── Formatting ─────────────────────────────────────────────────────────────
const fmtUah  = v => (v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 }) + ' ₴'
const fmtUsdt = v => (v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 }) + ' USDT'
const fmtRate = v => v ? v.toFixed(2) + ' ₴' : '—'
const fmtPct  = v => v ? v.toFixed(2) + '%' : '—'
const fmtDate = iso => {
  const d = new Date(iso)
  return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, subValue, sub, color, small }) {
  const { theme } = useTheme()
  return (
    <div style={{
      background: theme.surface, borderRadius: 12,
      padding: small ? '14px 18px' : '18px 22px',
      flex: '1 1 150px', minWidth: 140,
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{ fontSize: 12, color: theme.textDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: small ? 18 : 22, fontWeight: 700, color: color || theme.accent, lineHeight: 1.2 }}>{value}</div>
      {subValue && <div style={{ fontSize: 13, color: theme.textDim, marginTop: 3, fontWeight: 500 }}>{subValue}</div>}
      {sub && <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Quick filter button ────────────────────────────────────────────────────
function QuickBtn({ label, onClick }) {
  const { theme } = useTheme()
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 6, border: `1px solid ${theme.border}`,
      background: 'transparent', color: theme.textMuted, fontSize: 12, cursor: 'pointer',
    }}>{label}</button>
  )
}

// ── Pagination button ──────────────────────────────────────────────────────
function PageBtn({ label, onClick, disabled, active }) {
  const { theme } = useTheme()
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '5px 10px', borderRadius: 6, minWidth: 32,
      border: active ? 'none' : `1px solid ${theme.border}`,
      background: active ? theme.accent : 'transparent',
      color: active ? theme.accentText : disabled ? theme.textFaint : theme.textMuted,
      fontWeight: active ? 700 : 400, fontSize: 13,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
    }}>{label}</button>
  )
}

// ── Salary inline editor ───────────────────────────────────────────────────
function SalaryCell({ year, month, current, onSaved, theme, t }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(current)

  const save = async () => {
    await api('/api/salary', {
      method: 'PUT',
      body: JSON.stringify({ year, month, usdt_amount: parseFloat(val) || 0 }),
    })
    setEditing(false)
    onSaved()
  }

  if (editing) return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input
        type="number" value={val} autoFocus
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          width: 80, padding: '3px 6px', borderRadius: 5,
          border: `1px solid ${theme.accent}`, background: theme.inputBg,
          color: theme.text, fontSize: 12,
        }}
      />
      <button onClick={save} style={{
        padding: '3px 8px', borderRadius: 5, border: 'none',
        background: theme.accent, color: theme.accentText, fontSize: 11, cursor: 'pointer',
      }}>{t.salarySave}</button>
      <button onClick={() => setEditing(false)} style={{
        padding: '3px 6px', borderRadius: 5,
        border: `1px solid ${theme.border}`, background: 'transparent',
        color: theme.textDim, fontSize: 11, cursor: 'pointer',
      }}>✕</button>
    </div>
  )

  return (
    <span
      onClick={() => { setVal(current); setEditing(true) }}
      title={t.salaryEditTitle}
      style={{ cursor: 'pointer', borderBottom: `1px dashed ${theme.textFaint}`, color: current > 0 ? theme.purple : theme.textFaint }}
    >
      {current > 0 ? `${current} USDT` : '— ✎'}
    </span>
  )
}

// ── Withdrawal inline editor ───────────────────────────────────────────────
function WithdrawalCell({ year, month, current, onSaved, theme, t }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(current)

  const save = async () => {
    await api('/api/withdrawals', {
      method: 'PUT',
      body: JSON.stringify({ year, month, usdt_amount: parseFloat(val) || 0 }),
    })
    setEditing(false)
    onSaved()
  }

  if (editing) return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input
        type="number" value={val} autoFocus
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          width: 80, padding: '3px 6px', borderRadius: 5,
          border: `1px solid ${theme.accent}`, background: theme.inputBg,
          color: theme.text, fontSize: 12,
        }}
      />
      <button onClick={save} style={{
        padding: '3px 8px', borderRadius: 5, border: 'none',
        background: theme.accent, color: theme.accentText, fontSize: 11, cursor: 'pointer',
      }}>{t.salarySave}</button>
      <button onClick={() => setEditing(false)} style={{
        padding: '3px 6px', borderRadius: 5,
        border: `1px solid ${theme.border}`, background: 'transparent',
        color: theme.textDim, fontSize: 11, cursor: 'pointer',
      }}>✕</button>
    </div>
  )

  return (
    <span
      onClick={() => { setVal(current); setEditing(true) }}
      title={t.salaryEditTitle}
      style={{ cursor: 'pointer', borderBottom: `1px dashed ${theme.textFaint}`, color: current > 0 ? theme.purple : theme.textFaint }}
    >
      {current > 0 ? `${current} USDT` : '— ✎'}
    </span>
  )
}

// ── Monthly analytics table ────────────────────────────────────────────────
function MonthlyTable({ data, onSalaryChange, onWithdrawalChange, theme, t, lang }) {
  if (!data || !data.rows.length) return null
  const { rows, totals, global_avg_buy_rate } = data

  const thStyle = {
    padding: '10px 10px', textAlign: 'right', color: theme.textDim,
    fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap',
    borderBottom: `1px solid ${theme.border}`,
  }
  const thL = { ...thStyle, textAlign: 'left' }
  const td = (val, color) => ({
    padding: '9px 10px', textAlign: 'right', fontSize: 12,
    color: color || theme.text, whiteSpace: 'nowrap',
  })
  const tdL = (color) => ({ ...td(null, color), textAlign: 'left' })

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: theme.textMuted }}>{t.analyticsTitle}</h2>
        <span style={{ fontSize: 12, color: theme.textFaint }}>
          {t.globalAvgNote}: <strong style={{ color: theme.textMuted }}>{global_avg_buy_rate} ₴</strong>
        </span>
      </div>
      <div style={{ background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thL}>{t.colMonth}</th>
              <th style={thStyle}>{t.colBuyUsdt}</th>
              <th style={thStyle}>{t.colBuyUah}</th>
              <th style={thStyle}>{t.colSalary}</th>
              <th style={thStyle}>{t.colTotalIn}</th>
              <th style={thStyle}>{t.colAvgBuy}</th>
              <th style={thStyle}>{t.colSellUsdt}</th>
              <th style={thStyle}>{t.colSellUah}</th>
              <th style={thStyle}>{t.colAvgSell}</th>
              <th style={thStyle}>{t.colSpread}</th>
              <th style={thStyle}>{t.colProfit}</th>
              <th style={thStyle}>{t.colProfitPct}</th>
              <th style={thStyle}>{t.colRoi}</th>
              <th style={thStyle}>{t.colWithdrawal}</th>
              <th style={thStyle}>{t.colBuySellCount}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const spreadOk = r.spread >= 0.90
              const spreadColor = r.spread > 0 ? (spreadOk ? theme.green : theme.red) : theme.textFaint
              return (
                <tr key={`${r.year}-${r.month}`} style={{ borderBottom: `1px solid ${theme.borderLight}`, background: i % 2 ? theme.surface2 : 'transparent' }}>
                  <td style={tdL(theme.textMuted)}>{r.month_names[lang] || `${r.year}-${String(r.month).padStart(2,'0')}`}</td>
                  <td style={td()}>{r.buy_usdt > 0 ? r.buy_usdt.toLocaleString('uk-UA', {maximumFractionDigits:2}) : '—'}</td>
                  <td style={td()}>{r.buy_uah > 0 ? fmtUah(r.buy_uah) : '—'}</td>
                  <td style={{ ...td(), textAlign: 'right', padding: '9px 10px' }}>
                    <SalaryCell year={r.year} month={r.month} current={r.salary_usdt} onSaved={onSalaryChange} theme={theme} t={t} />
                  </td>
                  <td style={td(theme.accent)}>{r.total_in_usdt > 0 ? r.total_in_usdt.toLocaleString('uk-UA',{maximumFractionDigits:2}) : '—'}</td>
                  <td style={td()}>{fmtRate(r.avg_buy_rate)}</td>
                  <td style={td()}>{r.sell_usdt > 0 ? r.sell_usdt.toLocaleString('uk-UA',{maximumFractionDigits:2}) : '—'}</td>
                  <td style={td()}>{r.sell_uah > 0 ? fmtUah(r.sell_uah) : '—'}</td>
                  <td style={td()}>{fmtRate(r.avg_sell_rate)}</td>
                  <td style={td(spreadColor)}>
                    {r.spread > 0 ? `${r.spread.toFixed(2)} ${spreadOk ? '🟢' : '🔴'}` : '—'}
                  </td>
                  <td style={td(r.profit_uah > 0 ? theme.green : r.profit_uah < 0 ? theme.red : theme.textFaint)}>
                    {r.profit_uah !== 0 ? fmtUah(r.profit_uah) : '—'}
                  </td>
                  <td style={td(r.profit_pct > 0 ? theme.green : theme.textFaint)}>
                    {r.profit_pct ? fmtPct(r.profit_pct) : '—'}
                  </td>
                  <td style={td(r.roi_pct > 0 ? theme.green : theme.textFaint)}>
                    {r.roi_pct ? fmtPct(r.roi_pct) : '—'}
                  </td>
                  <td style={{ ...td(), textAlign: 'right', padding: '9px 10px' }}>
                    <WithdrawalCell year={r.year} month={r.month} current={r.manual_withdrawal_usdt} onSaved={onWithdrawalChange} theme={theme} t={t} />
                  </td>
                  <td style={td(theme.textDim)}>{r.buy_count}/{r.sell_count}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${theme.border}`, background: theme.surface2, fontWeight: 700 }}>
              <td style={{ ...tdL(theme.textMuted), fontWeight: 700 }}>{t.totalRow}</td>
              <td style={td(theme.accent)}>{totals.buy_usdt.toLocaleString('uk-UA',{maximumFractionDigits:2})}</td>
              <td style={td()}>{fmtUah(totals.buy_uah)}</td>
              <td style={td(theme.purple)}>{totals.salary_usdt > 0 ? `${totals.salary_usdt} USDT` : '—'}</td>
              <td style={td(theme.accent)}>{totals.total_in_usdt.toLocaleString('uk-UA',{maximumFractionDigits:2})}</td>
              <td style={td()}>{fmtRate(totals.avg_buy_rate)}</td>
              <td style={td(theme.accent)}>{totals.sell_usdt.toLocaleString('uk-UA',{maximumFractionDigits:2})}</td>
              <td style={td()}>{fmtUah(totals.sell_uah)}</td>
              <td style={td()}>{fmtRate(totals.avg_sell_rate)}</td>
              <td style={td(totals.spread >= 0.9 ? theme.green : theme.red)}>
                {totals.spread > 0 ? `${totals.spread.toFixed(2)} ${totals.spread >= 0.9 ? '🟢' : '🔴'}` : '—'}
              </td>
              <td style={td(totals.profit_uah > 0 ? theme.green : theme.red)}>{fmtUah(totals.profit_uah)}</td>
              <td style={td(theme.green)}>{fmtPct(totals.profit_pct)}</td>
              <td style={td(totals.roi_pct > 0 ? theme.green : theme.textFaint)}>{totals.roi_pct ? fmtPct(totals.roi_pct) : '—'}</td>
              <td style={td(theme.purple)}>{totals.manual_withdrawal_usdt > 0 ? `${totals.manual_withdrawal_usdt} USDT` : '—'}</td>
              <td style={td(theme.textDim)}>—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { theme } = useTheme()
  const { t, lang } = useLang()

  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo,   setDateTo]   = useState(today())
  const [appliedFrom, setAppliedFrom] = useState(firstOfMonth())
  const [appliedTo,   setAppliedTo]   = useState(today())

  const [stats,      setStats]      = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [monthly,    setMonthly]    = useState(null)
  const [txData,     setTxData]     = useState(null)
  const [txLoading,  setTxLoading]  = useState(true)
  const [page,       setPage]       = useState(1)
  const [counterparties, setCounterparties] = useState(null)
  const [cpOpen, setCpOpen] = useState(false)
  const LIMIT = 20

  const fetchStats = useCallback((from, to) => {
    setStatsLoading(true)
    api(`/api/stats?date_from=${from}&date_to=${to}`)
      .then(r => r.json()).then(d => { setStats(d); setStatsLoading(false) })
      .catch(() => setStatsLoading(false))
  }, [])

  const fetchMonthly = useCallback(() => {
    api('/api/analytics/monthly')
      .then(r => r.json()).then(setMonthly).catch(() => {})
  }, [])

  const fetchCounterparties = useCallback(() => {
    api('/api/analytics/counterparties')
      .then(r => r.json()).then(setCounterparties).catch(() => {})
  }, [])

  const fetchTx = useCallback((from, to, p) => {
    setTxLoading(true)
    api(`/api/transactions?date_from=${from}&date_to=${to}&page=${p}&limit=${LIMIT}`)
      .then(r => r.json()).then(d => { setTxData(d); setTxLoading(false) })
      .catch(() => setTxLoading(false))
  }, [])

  useEffect(() => { fetchStats(appliedFrom, appliedTo) }, [appliedFrom, appliedTo, fetchStats])
  useEffect(() => { fetchTx(appliedFrom, appliedTo, page) }, [appliedFrom, appliedTo, page, fetchTx])
  useEffect(() => { fetchMonthly() }, [fetchMonthly])
  useEffect(() => { fetchCounterparties() }, [fetchCounterparties])

  const applyFilter = () => { setPage(1); setAppliedFrom(dateFrom); setAppliedTo(dateTo) }
  const setQuick = (from, to) => { setDateFrom(from); setDateTo(to); setPage(1); setAppliedFrom(from); setAppliedTo(to) }

  return (
    <div>
      {/* ── Date filter ── */}
      <div style={{
        background: theme.surface, borderRadius: 12, padding: '14px 18px',
        marginBottom: 20, border: `1px solid ${theme.border}`,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 600 }}>{t.period}:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: theme.textDim }}>{t.dateFrom}</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInput(theme)} />
          <span style={{ fontSize: 12, color: theme.textDim }}>{t.dateTo}</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInput(theme)} />
        </div>
        <button onClick={applyFilter} style={{
          padding: '6px 14px', borderRadius: 7, border: 'none',
          background: theme.accent, color: theme.accentText, fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>{t.applyFilter}</button>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <QuickBtn label={t.filterThisMonth}  onClick={() => setQuick(firstOfMonth(), today())} />
          <QuickBtn label={t.filterPrevMonth}  onClick={() => setQuick(firstPrevMonth(), lastPrevMonth())} />
          <QuickBtn label={t.filterThisYear}   onClick={() => setQuick(firstOfYear(), today())} />
        </div>
      </div>

      {/* ── Stats cards — row 1: main ── */}
      {!statsLoading && stats ? (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <StatCard label={t.statSold}    value={`${fmtUsdt(stats.total_sold_usdt)} → ${fmtUah(stats.total_sold_uah)}`}     color={theme.green} />
            <StatCard label={t.statBought}  value={`${fmtUsdt(stats.total_bought_usdt)} → ${fmtUah(stats.total_bought_uah)}`}  color={theme.red} />
            <StatCard label={t.statProfit}  value={fmtUah(stats.estimated_profit_uah)}
              color={stats.estimated_profit_uah >= 0 ? theme.green : theme.red}
              sub={t.statProfitSub} />
            <StatCard label={t.statDeposit} value={fmtUsdt(stats.total_deposited_usdt)} color={theme.purple} />
            <StatCard label={t.statBalance} value={fmtUsdt(stats.current_balance_usdt)} color={theme.accent} />
          </div>
          {/* Row 2: analytics */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <StatCard small label={t.statAvgBuy}    value={fmtRate(stats.avg_buy_rate)} />
            <StatCard small label={t.statAvgSell}   value={fmtRate(stats.avg_sell_rate)} />
            <StatCard small label={t.statSpread}
              value={stats.spread > 0 ? `${stats.spread.toFixed(2)} ₴ ${stats.spread >= 0.9 ? '🟢' : '🔴'}` : '—'}
              color={stats.spread >= 0.9 ? theme.green : stats.spread > 0 ? theme.red : theme.textDim}
              sub={t.statSpreadHint} />
            <StatCard small label={t.statProfitPct} value={fmtPct(stats.profit_pct)} color={stats.profit_pct > 0 ? theme.green : theme.red} />
            <StatCard small label={t.statBuyCount}  value={stats.buy_count} />
            <StatCard small label={t.statSellCount} value={stats.sell_count} />
            <StatCard small label={t.statCancelRate}
              value={stats.cancel_count > 0 ? `${stats.cancel_rate}% (${stats.cancel_count})` : '0%'}
              color={stats.cancel_rate > 10 ? theme.red : stats.cancel_rate > 5 ? '#f59e0b' : theme.green} />
            {stats.total_withdrawn_usdt > 0 && (
              <StatCard small label={t.statWithdrawal} value={fmtUsdt(stats.total_withdrawn_usdt)} color={theme.purple} />
            )}
          </div>
        </>
      ) : (
        <div style={{ color: theme.textDim, marginBottom: 28 }}>{t.loading}</div>
      )}

      {/* ── Monthly analytics table ── */}
      <MonthlyTable data={monthly} onSalaryChange={fetchMonthly} onWithdrawalChange={fetchMonthly} theme={theme} t={t} lang={lang} />

      {/* ── Counterparty analytics ── */}
      {counterparties && counterparties.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: theme.textMuted }}>{t.counterpartiesTitle}</h2>
            <button onClick={() => setCpOpen(o => !o)} style={{
              padding: '4px 10px', borderRadius: 6, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textMuted, fontSize: 12, cursor: 'pointer',
            }}>{cpOpen ? '▲ Згорнути' : '▼ Розгорнути'}</button>
          </div>
          {cpOpen && (
            <div style={{ background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {['Контрагент', 'Угод', 'USDT', 'Сер. курс', 'Останній', 'Продав/Купив'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Контрагент' ? 'left' : 'right', color: theme.textDim, fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {counterparties.map((r, i) => (
                    <tr key={r.counterparty} style={{ borderBottom: `1px solid ${theme.borderLight}`, background: i % 2 ? theme.surface2 : 'transparent' }}>
                      <td style={{ padding: '8px 12px', color: theme.textMuted, fontWeight: 500 }}>{r.counterparty}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: theme.accent }}>{r.deal_count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.total_usdt.toLocaleString('uk-UA', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: theme.textDim }}>{r.avg_price ? r.avg_price.toFixed(2) + ' ₴' : '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: theme.textFaint }}>{r.last_date || '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: theme.textDim }}>
                        <span style={{ color: theme.red }}>{r.sell_count}</span>
                        {' / '}
                        <span style={{ color: theme.green }}>{r.buy_count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Transactions ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: theme.textMuted }}>{t.recentTx}</h2>
        {txData && (
          <span style={{ fontSize: 12, color: theme.textDim }}>
            {t.pageOf(txData.page, txData.pages || 1)} · {txData.total}
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
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: theme.textDim, fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txData.items.map((tx, i) => (
                    <tr key={tx.id} style={{ borderBottom: `1px solid ${theme.borderLight}`, background: i % 2 ? theme.surface2 : 'transparent' }}>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>{t[tx.type] || tx.type}</td>
                      <td style={{ padding: '9px 14px', color: theme.textDim, whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>{tx.usdt_amount != null ? `${tx.usdt_amount} USDT` : '—'}</td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>{tx.uah_amount != null ? `${Number(tx.uah_amount).toLocaleString('uk-UA')} ₴` : '—'}</td>
                      <td style={{ padding: '9px 14px', color: theme.textMuted, whiteSpace: 'nowrap' }}>{tx.price_per_usdt != null ? `${tx.price_per_usdt} ₴` : '—'}</td>
                      <td style={{ padding: '9px 14px', color: theme.textDim, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.counterparty || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {txData.pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', borderTop: `1px solid ${theme.border}` }}>
                <PageBtn label={t.prevPage} disabled={page === 1} onClick={() => setPage(p => p - 1)} />
                {Array.from({ length: txData.pages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === txData.pages || Math.abs(p - page) <= 2)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('…')
                    acc.push(p); return acc
                  }, [])
                  .map((p, i) => p === '…'
                    ? <span key={`e${i}`} style={{ color: theme.textDim, padding: '0 2px' }}>…</span>
                    : <PageBtn key={p} label={String(p)} active={p === page} onClick={() => setPage(p)} />
                  )}
                <PageBtn label={t.nextPage} disabled={page === txData.pages} onClick={() => setPage(p => p + 1)} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const dateInput = (theme) => ({
  padding: '5px 9px', borderRadius: 6, border: `1px solid ${theme.border}`,
  background: theme.inputBg, color: theme.text, fontSize: 13, outline: 'none',
})
