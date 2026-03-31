import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

const TOKEN_KEY = 'ma_auth_token'
const EMAIL_KEY = 'ma_auth_email'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const email = ref<string | null>(localStorage.getItem(EMAIL_KEY))

  const isAuthenticated = computed(() => !!token.value)

  async function login(emailInput: string, password: string) {
    const { data } = await api.post('/api/auth/login', {
      email: emailInput,
      password,
    })
    token.value = data.token
    email.value = data.email
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(EMAIL_KEY, data.email)
  }

  function logout() {
    token.value = null
    email.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
  }

  function getToken() {
    return token.value
  }

  return { token, email, isAuthenticated, login, logout, getToken }
})
