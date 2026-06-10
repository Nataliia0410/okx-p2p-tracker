import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export const THEMES = {
  dark: {
    name: 'dark',
    bg: '#0f1117',
    surface: '#1e293b',
    surface2: '#0f1a2e',
    border: '#334155',
    borderLight: '#1a2744',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    textDim: '#64748b',
    textFaint: '#475569',
    accent: '#38bdf8',
    accentText: '#0f1117',
    green: '#4ade80',
    red: '#f87171',
    purple: '#a78bfa',
    inputBg: '#0f1117',
    navActive: '#38bdf8',
    navActiveText: '#0f1117',
    navInactive: '#1e293b',
    navInactiveText: '#94a3b8',
    shadow: '0 8px 40px rgba(0,0,0,0.4)',
    tableHover: 'rgba(56,189,248,0.04)',
  },
  light: {
    name: 'light',
    bg: '#f1f5f9',
    surface: '#ffffff',
    surface2: '#f8fafc',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    text: '#0f172a',
    textMuted: '#475569',
    textDim: '#64748b',
    textFaint: '#94a3b8',
    accent: '#0284c7',
    accentText: '#ffffff',
    green: '#16a34a',
    red: '#dc2626',
    purple: '#7c3aed',
    inputBg: '#f8fafc',
    navActive: '#0284c7',
    navActiveText: '#ffffff',
    navInactive: '#e2e8f0',
    navInactiveText: '#475569',
    shadow: '0 8px 40px rgba(0,0,0,0.12)',
    tableHover: 'rgba(2,132,199,0.04)',
  },
}

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => localStorage.getItem('okx_theme') || 'dark')
  const theme = THEMES[themeName]

  useEffect(() => {
    localStorage.setItem('okx_theme', themeName)
    document.body.style.background = theme.bg
    document.body.style.color = theme.text
  }, [themeName, theme])

  const toggle = () => setThemeName(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, themeName, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
