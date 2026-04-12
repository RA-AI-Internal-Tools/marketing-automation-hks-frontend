// Vitest setup — runs once before any spec loads. Globals + shims needed
// by pinia, Vue Router, and code paths that touch browser-only APIs.
import { beforeEach, vi } from 'vitest'

// happy-dom lacks fetch on some versions — polyfill when missing.
if (typeof globalThis.fetch === 'undefined') {
  ;(globalThis as any).fetch = vi.fn(() => Promise.reject(new Error('fetch not mocked')))
}

// localStorage is provided by happy-dom. Clear between tests so auth tokens
// from one spec don't leak into another.
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
