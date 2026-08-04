import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { STORAGE_KEYS } from '@/constants/storage'

export type EnvironmentMode = 'sandbox' | 'production'

// Cold-boot default. The live deployment collapsed to a SINGLE api container
// pinned to MA_ENVIRONMENT=production on 2026-07-30, so `production` is the
// only value that corresponds to a real backend. See docs/DUAL_ENV.md.
const DEFAULT_MODE: EnvironmentMode = 'production'

function getStored(): EnvironmentMode {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.ENVIRONMENT)
    // One-shot migration: anyone who used the UI while the dual-env split was
    // live has `ma_environment: 'sandbox'` persisted, which would otherwise
    // outrank the new default forever and leave them staring at a "sandbox"
    // badge over production data (and, on the Integrations page, at 400s from
    // enforceEnvScope). Rewrite it in place so stale sessions self-heal on the
    // first load of the new bundle.
    if (v === 'sandbox') {
      localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, DEFAULT_MODE)
      return DEFAULT_MODE
    }
    if (v === 'production') return v
  } catch { /* ignore */ }
  return DEFAULT_MODE
}

export const useEnvironmentStore = defineStore('environment', () => {
  const mode = ref<EnvironmentMode>(getStored())

  const isSandbox = computed(() => mode.value === 'sandbox')
  const isProduction = computed(() => mode.value === 'production')

  function switchMode(newMode: EnvironmentMode) {
    mode.value = newMode
    // Re-arm the production guard. Switching environment is the single
    // moment an operator most needs to be told what they are now pointed at,
    // so an acknowledgement made against the previous environment must not
    // carry over. (`guardAcknowledgedFor` is compared against `mode`, so
    // this is belt-and-braces — but it keeps the invariant local to the one
    // function that can move `mode`.)
    guardAcknowledgedFor.value = null
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

  // Session memory for the production confirmation.
  //
  // The guard itself is correct and stays. What was missing is memory: it
  // fired on EVERY navigation into a requiresWrite route, and two of those
  // (/template-library, /catalog) are ordinary sidebar entries — so plain
  // navigation produced a "this will affect real customers and data" dialog.
  // A confirmation that fires on every click is not a safety feature; it
  // trains the operator to dismiss it unread, which is strictly worse than
  // not having it.
  //
  // Scope chosen — per tab, per environment:
  //   - NOT per route. Acknowledging "I am working in production" is a claim
  //     about the environment, not about /catalog specifically; per-route
  //     memory would still produce six separate dialogs.
  //   - NOT persisted to localStorage. A fresh browser session — next
  //     morning, or a different operator at a shared workstation — should
  //     confirm again. Plain in-memory state gives exactly that: a reload
  //     re-arms the guard, with no storage plumbing or staleness to migrate.
  //   - NOT a time window. A timer would re-prompt mid-task at an arbitrary
  //     moment, which is the same click-through-training problem on a delay.
  //   - Keyed by the mode it was granted under, so sandbox → production
  //     re-arms it even if some future path moves `mode` without going
  //     through switchMode.
  const guardAcknowledgedFor = ref<EnvironmentMode | null>(null)

  /** True once the operator has confirmed for the CURRENT environment this session. */
  const guardAcknowledged = computed(() => guardAcknowledgedFor.value === mode.value)

  /** True when entering a write route must prompt first. */
  const needsProductionGuard = computed(() => isProduction.value && !guardAcknowledged.value)

  function triggerGuard(onConfirm: () => void) {
    pendingGuardCallback.value = onConfirm
    showProductionGuard.value = true
  }

  // Promise-shaped entry point for the router guard.
  //
  // Replaces the previous approach of reassigning `envStore.cancelGuard` on
  // the live Pinia store from inside beforeEach: that mutated a shared store
  // action per navigation, and two overlapping navigations would nest their
  // `originalCancel` closures — the inner one restoring a patched function
  // rather than the real action, permanently. The settle callback lives in
  // store state instead, so nothing on the store is ever monkey-patched.
  const pendingGuardSettle = ref<((confirmed: boolean) => void) | null>(null)

  function requestGuard(onSettle: (confirmed: boolean) => void) {
    // A second navigation arriving while the dialog is open supersedes the
    // first. Settle the superseded promise as `false` rather than dropping
    // it — an unsettled beforeEach promise leaves that navigation pending
    // forever.
    pendingGuardSettle.value?.(false)
    pendingGuardSettle.value = onSettle
    showProductionGuard.value = true
  }

  function confirmGuard() {
    showProductionGuard.value = false
    guardAcknowledgedFor.value = mode.value
    const cb = pendingGuardCallback.value
    const settle = pendingGuardSettle.value
    pendingGuardCallback.value = null
    pendingGuardSettle.value = null
    cb?.()
    settle?.(true)
  }

  function cancelGuard() {
    showProductionGuard.value = false
    const settle = pendingGuardSettle.value
    pendingGuardCallback.value = null
    pendingGuardSettle.value = null
    settle?.(false)
  }

  function $reset() {
    switchMode(DEFAULT_MODE)
  }

  return {
    mode,
    isSandbox,
    isProduction,
    showProductionGuard,
    guardAcknowledged,
    needsProductionGuard,
    switchMode,
    setEnvironment,
    triggerGuard,
    requestGuard,
    confirmGuard,
    cancelGuard,
    $reset,
  }
})
