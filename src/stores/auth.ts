import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'
import { STORAGE_KEYS } from '@/constants/storage'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN))
  const email = ref<string | null>(localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL))
  const role = ref<string | null>(localStorage.getItem(STORAGE_KEYS.AUTH_ROLE))
  const name = ref<string | null>(localStorage.getItem(STORAGE_KEYS.AUTH_NAME))

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
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token)
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, data.email)
    localStorage.setItem(STORAGE_KEYS.AUTH_ROLE, data.role || 'viewer')
    localStorage.setItem(STORAGE_KEYS.AUTH_NAME, data.name || '')
  }

  function logout() {
    token.value = null
    email.value = null
    role.value = null
    name.value = null
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.AUTH_EMAIL)
    localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE)
    localStorage.removeItem(STORAGE_KEYS.AUTH_NAME)
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
