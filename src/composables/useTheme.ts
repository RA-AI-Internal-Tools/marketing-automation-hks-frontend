/**
 * useTheme — composable for managing light/dark theme.
 *
 * Architecture:
 *  - Theme is stored as `data-theme` attribute on <html> element.
 *  - Persisted to localStorage under key `ma-theme`.
 *  - Supports 'light', 'dark', and 'system' preferences.
 *  - 'system' follows the user's OS preference via matchMedia.
 *  - Initialized before Vue mounts (see initTheme()) to prevent flash.
 */
import { computed, ref, watch } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'ma-theme'
const VALID_PREFERENCES: ReadonlySet<string> = new Set(['light', 'dark', 'system'])

function readLocal(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage full or blocked
  }
}

function getStoredPreference(): ThemePreference {
  const stored = readLocal(STORAGE_KEY, 'light')
  return VALID_PREFERENCES.has(stored) ? (stored as ThemePreference) : 'light'
}

function getSystemPreference(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemDark ? 'dark' : 'light'
  return pref
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', theme)
}

/** Shared reactive state — singleton across all component instances */
const preference = ref<ThemePreference>(getStoredPreference())
const systemPrefersDark = ref(getSystemPreference())

let listenerAttached = false
let mqRef: MediaQueryList | null = null

function onSystemPrefChange(e: MediaQueryListEvent) {
  systemPrefersDark.value = e.matches
}

function attachSystemListener() {
  if (listenerAttached || typeof window === 'undefined') return
  listenerAttached = true
  mqRef = window.matchMedia('(prefers-color-scheme: dark)')
  mqRef.addEventListener('change', onSystemPrefChange)
}

/**
 * Remove the system-preference listener. Intended as an escape hatch for
 * HMR and test teardown — normal runtime keeps the listener for the life
 * of the page (singleton behaviour).
 */
export function teardownTheme() {
  if (!listenerAttached || !mqRef) return
  mqRef.removeEventListener('change', onSystemPrefChange)
  mqRef = null
  listenerAttached = false
}

/**
 * Initialize theme immediately (call from main.ts before app.mount).
 * Prevents flash of wrong theme on first paint.
 */
export function initTheme() {
  const pref = getStoredPreference()
  preference.value = pref
  systemPrefersDark.value = getSystemPreference()
  applyTheme(resolveTheme(pref, systemPrefersDark.value))
}

export function useTheme() {
  attachSystemListener()

  const resolved = computed<ResolvedTheme>(() =>
    resolveTheme(preference.value, systemPrefersDark.value),
  )

  const isDark = computed(() => resolved.value === 'dark')

  watch(resolved, (theme) => {
    applyTheme(theme)
  }, { immediate: true })

  watch(preference, (pref) => {
    writeLocal(STORAGE_KEY, pref)
  })

  function setTheme(pref: ThemePreference) {
    if (!VALID_PREFERENCES.has(pref)) return
    preference.value = pref
  }

  function toggleTheme() {
    const cycle: Record<ThemePreference, ThemePreference> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    }
    preference.value = cycle[preference.value] ?? 'light'
  }

  return {
    theme: preference,
    resolvedTheme: resolved,
    isDark,
    setTheme,
    toggleTheme,
  }
}
