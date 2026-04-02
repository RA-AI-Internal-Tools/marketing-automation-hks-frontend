import axios from 'axios'
import { STORAGE_KEYS } from '@/constants/storage'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Inject Bearer token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Inject environment header on every request
api.interceptors.request.use((config) => {
  const env = localStorage.getItem('ma_environment') || 'sandbox'
  config.headers['X-Environment'] = env
  return config
})

// On 401 responses, clear auth state and redirect to login
// Skip redirect for public routes (e.g. /preferences) that use token-based auth
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isPublicRoute = window.location.pathname === '/preferences'
    if (
      error.response?.status === 401 &&
      !error.config.url?.includes('/auth/login') &&
      !error.config._publicRequest &&
      !isPublicRoute
    ) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.AUTH_EMAIL)
      localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE)
      localStorage.removeItem(STORAGE_KEYS.AUTH_NAME)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api
