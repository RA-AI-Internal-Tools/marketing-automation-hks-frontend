import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'
import { STORAGE_KEYS } from '@/constants/storage'

export const useAuthStore = defineStore('auth', () => {
  // Phase 4 cookie-auth: the JWT lives in an HTTP-only cookie the browser
  // attaches automatically, and is NOT accessible to JS. We no longer hold
  // it in memory or localStorage — the email marker is the non-sensitive
  // presence signal we use to decide whether to render the shell vs redirect
  // to login before the first /auth/me round-trip completes.
  const email = ref<string | null>(localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL))
  const role = ref<string | null>(localStorage.getItem(STORAGE_KEYS.AUTH_ROLE))
  const name = ref<string | null>(localStorage.getItem(STORAGE_KEYS.AUTH_NAME))

  const isAuthenticated = computed(() => !!email.value)
  const isAdmin = computed(() => role.value === 'admin')
  const isEditor = computed(() => role.value === 'admin' || role.value === 'editor')
  const isViewer = computed(() => role.value === 'viewer')

  // Permission helpers
  const canWrite = computed(() => isEditor.value)
  const canManageUsers = computed(() => isAdmin.value)

  async function login(emailInput: string, password: string) {
    const { data } = await api.post('/api/auth/login', {
      email: emailInput,
      password,
    })
    // The JWT comes back in the response for backwards compat but we
    // deliberately do not store it — the backend has already set the
    // HTTP-only ma_session cookie, which is the real credential now.
    email.value = data.email
    role.value = data.role || 'viewer'
    name.value = data.name || ''
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, data.email)
    localStorage.setItem(STORAGE_KEYS.AUTH_ROLE, data.role || 'viewer')
    localStorage.setItem(STORAGE_KEYS.AUTH_NAME, data.name || '')
  }

  async function logout() {
    // Best-effort server call so the backend clears the HTTP-only session
    // cookie it set on login. If the network or the server is unreachable
    // the cookie would linger, but the next request it rides on will 401
    // anyway once the JWT expires — so we deliberately do not block logout
    // UX on this round-trip failing.
    try {
      await api.post('/api/auth/logout')
    } catch {
      // ignored — see above
    }
    email.value = null
    role.value = null
    name.value = null
    localStorage.removeItem(STORAGE_KEYS.AUTH_EMAIL)
    localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE)
    localStorage.removeItem(STORAGE_KEYS.AUTH_NAME)
    // AUTH_TOKEN removed in phase 4 — clean up any residue from older builds.
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
  }

  return {
    email, role, name,
    isAuthenticated, isAdmin, isEditor, isViewer,
    canWrite, canManageUsers,
    login, logout,
  }
})
