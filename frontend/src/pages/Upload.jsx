import React, { useState, useRef } from 'react'
import { api } from '../api'
import { useTheme } from '../ThemeContext'

const VALID_TYPES = ['sell_usdt', 'buy_usdt', 'deposit', 'withdrawal', 'cancel_order', 'internal', 'other']

const now = () => new Date().toISOString().slice(0, 16)

const CSV_TEMPLATE = `type,date,usdt_amount,uah_amount,price_per_usdt,counterparty
sell_usdt,2026-06-08 07:07,21.64,1000,46.19,elektrod
sell_usdt,2026-06-07 12:14,19.48,900,46.19,kiv***@gmail.com
buy_usdt,2026-06-05 09:24,50,2261,45.22,
deposit,2026-06-06 01:53,1748,,,`

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'okx_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

function ManualForm({ theme }) {
  const [form, setForm] = useState({
    type: 'sell_usdt', date: now(),
    usdt_amount: '', uah_amount: '', price_per_usdt: '', counterparty: '',
  })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    setLoading(true); setResult(null); setError(null)
    try {
      const body = {
        type: form.type,
        date: form.date.replace('T', ' '),
        usdt_amount: form.usdt_amount ? parseFloat(form.usdt_amount) : null,
        uah_amount: form.uah_amount ? parseFloat(form.uah_amount) : null,
        price_per_usdt: form.price_per_usdt ? parseFloat(form.price_per_usdt) : null,
        counterparty: form.counterparty || null,
      }
      const r = await api('/api/transactions', { method: 'POST', body: JSON.stringify(body) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Помилка')
      setResult(`✅ Транзакцію додано (id: ${data.id})`)
      setForm(f => ({ ...f, usdt_amount: '', uah_amount: '', price_per_usdt: '', counterparty: '' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    width: '100%', padding: '8px 10px', borderRadius: 7,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }
  const lbl = { fontSize: 11, color: theme.textDim, marginBottom: 4, display: 'block' }

  return (
    <div style={{ background: theme.surface, borderRadius: 12, padding: 24, marginTop: 24, border: `1px solid ${theme.border}` }}>
      <div style={{ fontWeight: 600, marginBottom: 16, color: theme.text, fontSize: 15 }}>✍️ Додати транзакцію вручну</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={lbl}>Тип</label>
          <select value={form.type} onChange={e => set('type', e.target.value)} style={inp}>
            {VALID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Дата</label>
          <input type="datetime-local" value={form.date} onChange={e => set('date', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>USDT</label>
          <input type="number" step="any" placeholder="0.00" value={form.usdt_amount} onChange={e => set('usdt_amount', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>UAH</label>
          <input type="number" step="any" placeholder="0.00" value={form.uah_amount} onChange={e => set('uah_amount', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Курс ₴/USDT</label>
          <input type="number" step="any" placeholder="0.0000" value={form.price_per_usdt} onChange={e => set('price_per_usdt', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Контрагент</label>
          <input type="text" placeholder="ім'я" value={form.counterparty} onChange={e => set('counterparty', e.target.value)} style={inp} />
        </div>
      </div>
      <button onClick={submit} disabled={loading} style={{
        padding: '9px 24px', borderRadius: 8, border: 'none',
        background: loading ? theme.border : theme.accent,
        color: loading ? theme.textDim : theme.accentText,
        fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? '⏳...' : 'Додати'}
      </button>
      {result && (
        <div style={{ marginTop: 10, padding: 10, background: theme.surface2, borderRadius: 7, border: `1px solid ${theme.green}`, color: theme.green, fontSize: 13 }}>
          {result}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 10, padding: 10, background: theme.surface2, borderRadius: 7, border: `1px solid ${theme.red}`, color: theme.red, fontSize: 13 }}>
          ❌ {error}
        </div>
      )}
    </div>
  )
}

export default function Upload() {
  const { theme } = useTheme()
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef()

  const upload = async () => {
    if (!file) return
    setLoading(true); setResult(null); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await api('/api/upload-csv', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Помилка')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false); setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const cardStyle = { background: theme.surface, borderRadius: 12, padding: 20, border: `1px solid ${theme.border}` }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: theme.textMuted }}>Завантажити CSV</h2>
      <p style={{ fontSize: 13, color: theme.textDim, marginBottom: 24, lineHeight: 1.6 }}>
        Скинь скріни OKX в чат Claude — він розпарсить і поверне готовий CSV.<br />
        Потім завантаж його тут.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

        <div style={{ ...cardStyle, flex: '1 1 320px', maxWidth: 440 }}>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
            style={{
              border: `2px dashed ${file ? theme.green : theme.border}`,
              borderRadius: 10, padding: '28px 20px', textAlign: 'center',
              cursor: 'pointer', marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            {file
              ? <div style={{ color: theme.green, fontWeight: 600 }}>{file.name}</div>
              : <div style={{ color: theme.textDim, fontSize: 14 }}>Натисни або перетягни CSV файл</div>
            }
          </div>

          <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files[0])} />

          <button onClick={upload} disabled={!file || loading} style={{
            width: '100%', padding: '11px', borderRadius: 8, border: 'none',
            background: !file || loading ? theme.border : theme.accent,
            color: !file || loading ? theme.textDim : theme.accentText,
            fontWeight: 700, fontSize: 15, cursor: !file || loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '⏳ Завантажую...' : 'Завантажити'}
          </button>

          {result && (
            <div style={{ marginTop: 14, padding: 14, background: theme.surface2, borderRadius: 8, border: `1px solid ${theme.green}` }}>
              <div style={{ color: theme.green, fontWeight: 600 }}>✅ Готово!</div>
              <div style={{ color: theme.green, fontSize: 13, marginTop: 4 }}>
                Збережено нових записів: <strong>{result.saved}</strong>
              </div>
              {result.skipped > 0 && (
                <div style={{ color: theme.accent, fontSize: 13, marginTop: 2 }}>
                  Пропущено дублів: <strong>{result.skipped}</strong>
                </div>
              )}
              {result.errors?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: '#f59e0b', fontSize: 12, marginBottom: 4 }}>⚠️ Пропущені рядки:</div>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ color: '#f59e0b', fontSize: 11 }}>{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, padding: 14, background: theme.surface2, borderRadius: 8, border: `1px solid ${theme.red}` }}>
              <div style={{ color: theme.red, fontWeight: 600 }}>❌ Помилка</div>
              <div style={{ color: theme.red, fontSize: 13, marginTop: 4 }}>{error}</div>
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 280px', maxWidth: 380 }}>
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: theme.text }}>Як підготувати CSV</div>
            <ol style={{ paddingLeft: 18, fontSize: 13, color: theme.textMuted, lineHeight: 2 }}>
              <li>Відкрий чат з Claude</li>
              <li>Скинь скріни з OKX (Ордера або Історія)</li>
              <li>Напиши: <span style={{ color: theme.accent, fontFamily: 'monospace' }}>"розпарси і дай CSV"</span></li>
              <li>Збережи отриманий CSV файл</li>
              <li>Завантаж його тут</li>
            </ol>
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: theme.text }}>Формат CSV</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: theme.textDim, lineHeight: 1.8, wordBreak: 'break-all' }}>
              type, date, usdt_amount,<br />
              uah_amount, price_per_usdt,<br />
              counterparty
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: theme.textDim }}>
              Типи: <span style={{ color: theme.green }}>sell_usdt</span> · <span style={{ color: theme.red }}>buy_usdt</span> · <span style={{ color: theme.purple }}>deposit</span>
            </div>
            <button onClick={downloadTemplate} style={{
              marginTop: 14, width: '100%', padding: '8px', borderRadius: 7,
              border: `1px solid ${theme.border}`, background: 'transparent',
              color: theme.textMuted, fontSize: 13, cursor: 'pointer',
            }}>
              ⬇️ Скачати шаблон CSV
            </button>
          </div>
        </div>

      </div>

      <ManualForm theme={theme} />
    </div>
  )
}
