import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

const TOKEN_KEY = 'ma_auth_token'
const EMAIL_KEY = 'ma_auth_email'
const ROLE_KEY = 'ma_auth_role'
const NAME_KEY = 'ma_auth_name'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const email = ref<string | null>(localStorage.getItem(EMAIL_KEY))
  const role = ref<string | null>(localStorage.getItem(ROLE_KEY))
  const name = ref<string | null>(localStorage.getItem(NAME_KEY))

  const isAuthenticated = computed(() => !!token.value)
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
    token.value = data.token
    email.value = data.email
    role.value = data.role || 'viewer'
    name.value = data.name || ''
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(EMAIL_KEY, data.email)
    localStorage.setItem(ROLE_KEY, data.role || 'viewer')
    localStorage.setItem(NAME_KEY, data.name || '')
  }

  function logout() {
    token.value = null
    email.value = null
    role.value = null
    name.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(NAME_KEY)
  }

  function getToken() {
    return token.value
  }

  return {
    token, email, role, name,
    isAuthenticated, isAdmin, isEditor, isViewer,
    canWrite, canManageUsers,
    login, logout, getToken,
  }
})
