import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type EnvironmentMode = 'sandbox' | 'production'

const STORAGE_KEY = 'ma_environment'

function getStored(): EnvironmentMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
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
      localStorage.setItem(STORAGE_KEY, newMode)
    } catch { /* ignore */ }
  }

  function $reset() {
    switchMode('sandbox')
  }

  return { mode, isSandbox, isProduction, switchMode, $reset }
})
