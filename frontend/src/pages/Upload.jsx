import React, { useState, useRef } from 'react'
import { api } from '../api'

const CSV_TEMPLATE = `type,date,usdt_amount,uah_amount,price_per_usdt,counterparty
sell_usdt,2026-06-08 07:07,21.64,1000,46.19,elektrod
sell_usdt,2026-06-07 12:14,19.48,900,46.19,kiv***@gmail.com
buy_usdt,2026-06-05 09:24,50,2261,45.22,
deposit,2026-06-06 01:53,1748,,,`

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'okx_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Upload() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef()

  const upload = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    setError(null)
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
      setLoading(false)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>
        Завантажити CSV
      </h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
        Скинь скріни OKX в чат Claude — він розпарсить і поверне готовий CSV.<br />
        Потім завантаж його тут.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

        {/* Upload block */}
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, flex: '1 1 320px', maxWidth: 440 }}>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
            style={{
              border: `2px dashed ${file ? '#4ade80' : '#334155'}`,
              borderRadius: 10, padding: '28px 20px', textAlign: 'center',
              cursor: 'pointer', marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            {file
              ? <div style={{ color: '#4ade80', fontWeight: 600 }}>{file.name}</div>
              : <div style={{ color: '#64748b', fontSize: 14 }}>
                  Натисни або перетягни CSV файл
                </div>
            }
          </div>

          <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files[0])} />

          <button
            onClick={upload}
            disabled={!file || loading}
            style={{
              width: '100%', padding: '11px', borderRadius: 8, border: 'none',
              background: !file || loading ? '#334155' : '#38bdf8',
              color: !file || loading ? '#64748b' : '#0f1117',
              fontWeight: 700, fontSize: 15, cursor: !file || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '⏳ Завантажую...' : 'Завантажити'}
          </button>

          {result && (
            <div style={{ marginTop: 14, padding: 14, background: '#0f2a1a', borderRadius: 8, border: '1px solid #166534' }}>
              <div style={{ color: '#4ade80', fontWeight: 600 }}>✅ Готово!</div>
              <div style={{ color: '#86efac', fontSize: 13, marginTop: 4 }}>
                Збережено нових записів: <strong>{result.saved}</strong>
              </div>
              {result.errors?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: '#fbbf24', fontSize: 12, marginBottom: 4 }}>⚠️ Пропущені рядки:</div>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ color: '#fde68a', fontSize: 11 }}>{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, padding: 14, background: '#2a0f0f', borderRadius: 8, border: '1px solid #991b1b' }}>
              <div style={{ color: '#f87171', fontWeight: 600 }}>❌ Помилка</div>
              <div style={{ color: '#fca5a5', fontSize: 13, marginTop: 4 }}>{error}</div>
            </div>
          )}
        </div>

        {/* Instructions block */}
        <div style={{ flex: '1 1 280px', maxWidth: 380 }}>
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>Як підготувати CSV</div>
            <ol style={{ paddingLeft: 18, fontSize: 13, color: '#94a3b8', lineHeight: 2 }}>
              <li>Відкрий чат з Claude</li>
              <li>Скинь скріни з OKX (Ордера або Історія)</li>
              <li>Напиши: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>"розпарси і дай CSV"</span></li>
              <li>Збережи отриманий CSV файл</li>
              <li>Завантаж його тут</li>
            </ol>
          </div>

          <div style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: '#e2e8f0' }}>Формат CSV</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b', lineHeight: 1.8, wordBreak: 'break-all' }}>
              type, date, usdt_amount,<br />
              uah_amount, price_per_usdt,<br />
              counterparty
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>
              Типи: <span style={{ color: '#4ade80' }}>sell_usdt</span> · <span style={{ color: '#f87171' }}>buy_usdt</span> · <span style={{ color: '#a78bfa' }}>deposit</span>
            </div>
            <button
              onClick={downloadTemplate}
              style={{
                marginTop: 14, width: '100%', padding: '8px', borderRadius: 7,
                border: '1px solid #334155', background: 'transparent',
                color: '#94a3b8', fontSize: 13, cursor: 'pointer',
              }}
            >
              ⬇️ Скачати шаблон CSV
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
