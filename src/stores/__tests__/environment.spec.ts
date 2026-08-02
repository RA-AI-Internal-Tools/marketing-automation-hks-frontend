import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEnvironmentStore } from '../environment'
import { STORAGE_KEYS } from '@/constants/storage'

// The live deployment is pinned to MA_ENVIRONMENT=production (single container,
// 2026-07-30). `sandbox` no longer corresponds to any running backend.

describe('environment store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('cold-boots to production when nothing is stored', () => {
    const env = useEnvironmentStore()
    expect(env.mode).toBe('production')
    expect(env.isProduction).toBe(true)
  })

  it('migrates a persisted sandbox value to production', () => {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, 'sandbox')
    const env = useEnvironmentStore()
    expect(env.mode).toBe('production')
    // Migration is written back, so the stale value cannot resurface.
    expect(localStorage.getItem(STORAGE_KEYS.ENVIRONMENT)).toBe('production')
  })

  it('honours a persisted production value', () => {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, 'production')
    const env = useEnvironmentStore()
    expect(env.mode).toBe('production')
  })

  it('ignores a garbage stored value and falls back to production', () => {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, 'staging')
    const env = useEnvironmentStore()
    expect(env.mode).toBe('production')
  })

  it('$reset returns to production, not sandbox', () => {
    const env = useEnvironmentStore()
    env.switchMode('sandbox')
    expect(env.mode).toBe('sandbox')
    env.$reset()
    expect(env.mode).toBe('production')
    expect(localStorage.getItem(STORAGE_KEYS.ENVIRONMENT)).toBe('production')
  })
})

/**
 * Production guard memory.
 *
 * The guard is correct and stays — the defect was that it had no memory, so
 * `needsProductionGuard` was simply `isProduction` and every navigation into
 * a requiresWrite route re-prompted. Two of those routes (/template-library,
 * /catalog) are plain sidebar entries, so ordinary navigation produced a
 * "this will affect real customers and data" dialog on every click, which
 * trains the operator to dismiss it unread.
 *
 * Scope under test: per tab, per environment. Acknowledgement survives
 * further navigations, and is revoked by an environment change.
 */
describe('environment store — production guard memory', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('demands the guard on the first write route in production', () => {
    const env = useEnvironmentStore()
    expect(env.isProduction).toBe(true)
    expect(env.needsProductionGuard).toBe(true)
  })

  it('remembers the acknowledgement for subsequent navigations', () => {
    const env = useEnvironmentStore()
    env.requestGuard(() => {})
    env.confirmGuard()

    expect(env.guardAcknowledged).toBe(true)
    // This is the whole fix: the second, third, nth write route is silent.
    expect(env.needsProductionGuard).toBe(false)
    expect(env.showProductionGuard).toBe(false)
  })

  it('does NOT remember a cancellation', () => {
    const env = useEnvironmentStore()
    env.requestGuard(() => {})
    env.cancelGuard()

    // Declining is not consent; the next attempt must prompt again.
    expect(env.guardAcknowledged).toBe(false)
    expect(env.needsProductionGuard).toBe(true)
  })

  it('never demands the guard in sandbox', () => {
    const env = useEnvironmentStore()
    env.switchMode('sandbox')
    expect(env.needsProductionGuard).toBe(false)
  })

  it('re-arms when the environment changes back to production', () => {
    const env = useEnvironmentStore()
    env.confirmGuard()
    expect(env.needsProductionGuard).toBe(false)

    env.switchMode('sandbox')
    env.switchMode('production')

    // Switching environment is exactly when the operator needs telling what
    // they are now pointed at — a stale acknowledgement must not carry over.
    expect(env.guardAcknowledged).toBe(false)
    expect(env.needsProductionGuard).toBe(true)
  })

  it('re-arms via setEnvironment, the alias used by guard flows', () => {
    const env = useEnvironmentStore()
    env.confirmGuard()
    env.setEnvironment('sandbox')
    env.setEnvironment('production')
    expect(env.needsProductionGuard).toBe(true)
  })

  it('re-arms on $reset', () => {
    const env = useEnvironmentStore()
    env.confirmGuard()
    env.$reset()
    expect(env.needsProductionGuard).toBe(true)
  })
})

/**
 * requestGuard settlement.
 *
 * The router previously reassigned `envStore.cancelGuard` on the live Pinia
 * store from inside beforeEach, restoring it from a captured `originalCancel`.
 * Two overlapping navigations nested those closures, so the inner restore put
 * back a patched function rather than the real action — permanently. The
 * settle callback now lives in store state and nothing is monkey-patched.
 */
describe('environment store — requestGuard settlement', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('settles true on confirm and opens the dialog', () => {
    const env = useEnvironmentStore()
    const settle = vi.fn()
    env.requestGuard(settle)

    expect(env.showProductionGuard).toBe(true)
    env.confirmGuard()
    expect(settle).toHaveBeenCalledWith(true)
  })

  it('settles false on cancel', () => {
    const env = useEnvironmentStore()
    const settle = vi.fn()
    env.requestGuard(settle)

    env.cancelGuard()
    expect(settle).toHaveBeenCalledWith(false)
    expect(env.showProductionGuard).toBe(false)
  })

  it('settles a superseded request instead of leaving it pending forever', () => {
    const env = useEnvironmentStore()
    const first = vi.fn()
    const second = vi.fn()

    env.requestGuard(first)
    env.requestGuard(second)

    // An unsettled beforeEach promise keeps that navigation alive indefinitely.
    expect(first).toHaveBeenCalledWith(false)
    expect(second).not.toHaveBeenCalled()

    env.confirmGuard()
    expect(second).toHaveBeenCalledWith(true)
    expect(first).toHaveBeenCalledTimes(1)
  })

  it('settles each request exactly once across a confirm/cancel sequence', () => {
    const env = useEnvironmentStore()
    const settle = vi.fn()

    env.requestGuard(settle)
    env.confirmGuard()
    // A stray cancel (e.g. backdrop click as the dialog leaves) must not
    // re-settle an already-settled promise.
    env.cancelGuard()

    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle).toHaveBeenCalledWith(true)
  })

  it('keeps cancelGuard a stable action across repeated requests', () => {
    const env = useEnvironmentStore()
    const before = env.cancelGuard

    env.requestGuard(() => {})
    env.cancelGuard()
    env.requestGuard(() => {})
    env.cancelGuard()

    // Pins the removal of the monkey-patch: nothing reassigns store actions.
    expect(env.cancelGuard).toBe(before)
  })
})
