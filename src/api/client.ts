import axios from 'axios'
import { STORAGE_KEYS } from '@/constants/storage'

// Auth is cookie-only (phase 4 of cookie-auth migration). The backend sets an
// HTTP-only `ma_session` cookie on login; `withCredentials: true` tells the
// browser to attach it. JavaScript cannot read or steal the cookie — that's
// the whole point, and closes the original S2 localStorage-XSS finding.
//
// For CORS to permit credentialed requests the backend must reply with
// `Access-Control-Allow-Credentials: true` AND a specific origin (never `*`).
// See internal/middleware/cors.go.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// SINGLE-CONTAINER TOPOLOGY (reversed the dual-env split on 2026-07-30).
//
// Call sites emit bare `/api/...` and that is exactly what gets sent. There is
// ONE api container (127.0.0.1:8081, ENVIRONMENT/MA_ENVIRONMENT=production) and
// the host nginx serves plain `/api/*`. The `/api/sandbox/*` and
// `/api/production/*` routes are RETIRED and now return 404.
//
// DO NOT reintroduce a request interceptor that rewrites `/api/x` into
// `/api/{env}/x`. The previous version of this file did exactly that; against
// the current nginx it 404s every single API call and takes the whole dashboard
// down. Environment is a property of the deployment (MA_ENVIRONMENT on the
// container), not of the request.
//
// The `X-Environment` request header was also dropped here. The Go backend
// never reads it — its only mention is the Access-Control-Allow-Headers list in
// internal/middleware/cors.go, and requests are same-origin (VITE_API_URL is
// empty, see .env.production) so CORS never engages. It was a no-op that
// implied a per-request env the server does not honour.

// Double-submit CSRF: the backend sets a non-HttpOnly `ma_csrf` cookie on any
// authenticated request, and requires a matching X-CSRF-Token header on every
// state-changing request that authenticated via cookie. We echo the cookie on
// every request — harmless when Bearer auth is used (backend skips the check),
// required when cookie auth is used. See docs/specs/cookie-jwt-migration.md.
function readCookie(name: string): string | null {
  const prefix = name + '='
  const parts = document.cookie.split('; ')
  for (const p of parts) {
    if (!p.startsWith(prefix)) continue
    const raw = p.slice(prefix.length)
    try {
      return decodeURIComponent(raw)
    } catch {
      // decodeURIComponent throws on malformed %-sequences. The CSRF cookie
      // we set is pure hex so this should never happen for our value, but a
      // stray third-party cookie with a broken encoding could poison the
      // read. Fall back to the raw string rather than nuking CSRF entirely.
      return raw
    }
  }
  return null
}
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrf = readCookie('ma_csrf')
    if (csrf) config.headers['X-CSRF-Token'] = csrf
  }
  return config
})

// On 401 responses, clear auth state and redirect to login
// Skip redirect for public routes (e.g. /preferences) that use token-based auth.
// The preference centre now lives at /preferences/:token and
// /preferences/confirm/:shortToken as well as the legacy bare /preferences, so
// this matches the whole subtree — an exact-match check would bounce a
// customer holding an expired link to the operator login page. Those pages use
// the interceptor-free instance in ./publicPreferences and should never reach
// here; this is the belt to that braces.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const path = window.location.pathname
    const isPublicRoute = path === '/preferences' || path.startsWith('/preferences/')
    if (
      error.response?.status === 401 &&
      !error.config.url?.includes('/auth/login') &&
      !error.config._publicRequest &&
      !isPublicRoute
    ) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_EMAIL)
      localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE)
      localStorage.removeItem(STORAGE_KEYS.AUTH_NAME)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api
