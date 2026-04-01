import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Inject Bearer token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ma_auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
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
      localStorage.removeItem('ma_auth_token')
      localStorage.removeItem('ma_auth_email')
      localStorage.removeItem('ma_auth_role')
      localStorage.removeItem('ma_auth_name')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api
