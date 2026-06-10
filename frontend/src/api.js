const BASE = import.meta.env.VITE_API_URL || ''

export const api = (path, options = {}) => {
  const token = localStorage.getItem('okx_token')
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  return fetch(`${BASE}${path}`, { ...options, headers })
}
