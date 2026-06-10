import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = logged out

  useEffect(() => {
    const token = localStorage.getItem('okx_token')
    if (!token) { setUser(null); return }
    api('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUser(data))
      .catch(() => { localStorage.removeItem('okx_token'); setUser(null) })
  }, [])

  const login = async (email, password) => {
    const r = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail || 'Помилка входу')
    localStorage.setItem('okx_token', data.access_token)
    setUser({ email: data.email })
  }

  const register = async (email, password) => {
    const r = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail || 'Помилка реєстрації')
    localStorage.setItem('okx_token', data.access_token)
    setUser({ email: data.email })
  }

  const logout = () => {
    localStorage.removeItem('okx_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
