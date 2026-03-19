import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lh_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message)

    // If 401, clear token and notify LoginGate
    if (error.response?.status === 401) {
      // Don't clear on login/verify endpoints (those are expected 401s)
      const url = error.config?.url || ''
      if (!url.includes('/auth/login') && !url.includes('/auth/verify')) {
        localStorage.removeItem('lh_token')
        window.dispatchEvent(new Event('lh-auth-expired'))
      }
    }

    return Promise.reject(error)
  }
)
