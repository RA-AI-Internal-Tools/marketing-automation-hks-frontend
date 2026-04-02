import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { STORAGE_KEYS } from '@/constants/storage'

export type EnvironmentMode = 'sandbox' | 'production'

function getStored(): EnvironmentMode {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.ENVIRONMENT)
    if (v === 'sandbox' || v === 'production') return v
  } catch { /* ignore */ }
  return 'sandbox'
}

export const useEnvironmentStore = defineStore('environment', () => {
  const mode = ref<EnvironmentMode>(getStored())

  const isSandbox = computed(() => mode.value === 'sandbox')
  const isProduction = computed(() => mode.value === 'production')

  function switchMode(newMode: EnvironmentMode) {
    mode.value = newMode
    try {
      localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, newMode)
    } catch { /* ignore */ }
  }

  // Alias used by security guard flows
  function setEnvironment(env: EnvironmentMode) {
    switchMode(env)
  }

  // Production guard state (security fix: confirmation before write actions in prod)
  const pendingGuardCallback = ref<(() => void) | null>(null)
  const showProductionGuard = ref(false)

  function triggerGuard(onConfirm: () => void) {
    pendingGuardCallback.value = onConfirm
    showProductionGuard.value = true
  }

  function confirmGuard() {
    showProductionGuard.value = false
    const cb = pendingGuardCallback.value
    pendingGuardCallback.value = null
    cb?.()
  }

  function cancelGuard() {
    showProductionGuard.value = false
    pendingGuardCallback.value = null
  }

  function $reset() {
    switchMode('sandbox')
  }

  return {
    mode,
    isSandbox,
    isProduction,
    showProductionGuard,
    switchMode,
    setEnvironment,
    triggerGuard,
    confirmGuard,
    cancelGuard,
    $reset,
  }
})
