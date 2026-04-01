<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import hksLogo from '@/assets/hks-logo.svg'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push('/overview')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#020288] via-[#0a0a1a] to-[#020288] flex items-center justify-center px-4 relative overflow-hidden">
    <!-- Decorative gradient orbs -->
    <div class="absolute top-1/4 -left-32 w-96 h-96 bg-[#0099db]/20 rounded-full blur-3xl"></div>
    <div class="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#020288]/30 rounded-full blur-3xl"></div>

    <div class="w-full max-w-sm relative z-10">
      <div class="bg-white/[0.97] backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
        <!-- Brand -->
        <div class="text-center mb-8">
          <img :src="hksLogo" alt="HKS Global" class="h-10 mx-auto mb-4 invert" />
          <h1 class="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">Marketing Automation</h1>
          <p class="text-sm text-[#0099db] font-medium mt-1">HKS Global Growth Engine</p>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              class="w-full px-3.5 py-2.5 border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db] transition-shadow shadow-sm"
              placeholder="admin@duegate.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              class="w-full px-3.5 py-2.5 border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db] transition-shadow shadow-sm"
              placeholder="Enter your password"
            />
          </div>

          <div v-if="error" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] px-4 py-3 rounded-xl">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 px-4 bg-gradient-to-r from-[#020288] to-[#0d35d7] text-white text-sm font-semibold rounded-xl hover:from-[#0d35d7] hover:to-[#020288] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#020288]/25"
          >
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>
      </div>

      <p class="text-center text-xs text-white/30 mt-6">&copy; HKS Global Group</p>
    </div>
  </div>
</template>
