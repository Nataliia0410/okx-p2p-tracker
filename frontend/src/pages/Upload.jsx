import React, { useState, useRef } from 'react'
import { api } from '../api'

export default function Upload() {
  const [type, setType] = useState('orders')
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
    fd.append('screenshot_type', type)
    try {
      const r = await api('/api/upload', { method: 'POST', body: fd })
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
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#94a3b8' }}>Завантажити скріншот OKX</h2>

      <div style={{ background: '#1e293b', borderRadius: 12, padding: 28, maxWidth: 480 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>Тип скріншоту</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { id: 'orders', label: 'Ордера (P2P угоди)', desc: 'Розділ "Ордера → Завершено"' },
              { id: 'history', label: 'Історія', desc: 'Фандинг-акаунт → Історія' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${type === t.id ? '#38bdf8' : '#334155'}`,
                  background: type === t.id ? '#0c2a3a' : '#0f1117',
                  color: type === t.id ? '#38bdf8' : '#64748b',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
          style={{
            border: `2px dashed ${file ? '#4ade80' : '#334155'}`,
            borderRadius: 10, padding: '32px 24px', textAlign: 'center',
            cursor: 'pointer', marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
          {file
            ? <div style={{ color: '#4ade80', fontWeight: 600 }}>{file.name}</div>
            : <div style={{ color: '#64748b', fontSize: 14 }}>Натисни або перетягни скріншот сюди</div>
          }
        </div>

        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => setFile(e.target.files[0])} />

        <button
          onClick={upload}
          disabled={!file || loading}
          style={{
            width: '100%', padding: '12px', borderRadius: 8, border: 'none',
            background: !file || loading ? '#334155' : '#38bdf8',
            color: !file || loading ? '#64748b' : '#0f1117',
            fontWeight: 700, fontSize: 15, cursor: !file || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳ Аналізую...' : 'Завантажити та розпарсити'}
        </button>

        {result && (
          <div style={{ marginTop: 16, padding: 16, background: '#0f2a1a', borderRadius: 8, border: '1px solid #166534' }}>
            <div style={{ color: '#4ade80', fontWeight: 600 }}>✅ Успішно!</div>
            <div style={{ color: '#86efac', fontSize: 13, marginTop: 4 }}>
              Розпізнано: {result.parsed} · Збережено нових: {result.saved}
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: 16, background: '#2a0f0f', borderRadius: 8, border: '1px solid #991b1b' }}>
            <div style={{ color: '#f87171', fontWeight: 600 }}>❌ Помилка</div>
            <div style={{ color: '#fca5a5', fontSize: 13, marginTop: 4 }}>{error}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, padding: 16, background: '#1e293b', borderRadius: 10, maxWidth: 480, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
        <strong style={{ color: '#94a3b8' }}>Як завантажувати:</strong>
        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
          <li>P2P угоди: "Ордера → Завершено → Виконано"</li>
          <li>Поповнення/ЗП: "Активи → Фандинг → Історія"</li>
          <li>Можна завантажувати декілька скрінів підряд</li>
          <li>Дублікати автоматично ігноруються</li>
        </ul>
      </div>
    </div>
  )
}
