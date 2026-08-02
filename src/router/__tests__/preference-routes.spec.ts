/**
 * The preference-centre routes are the only pages a logged-out stranger is
 * ever meant to reach, so their public-ness is load-bearing rather than
 * incidental: the audience is someone who clicked "unsubscribe" in a
 * marketing email and has no session at all. If the auth guard starts
 * catching them, the recipient lands on an operator login page they can
 * never pass, and the only route out of our mailing list is gone.
 *
 * Drives the REAL router (no reimplementation), with localStorage empty so
 * the guard sees a genuinely anonymous visitor.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'

// router.push awaits each route's lazy import; this suite is about matching
// and guard behaviour, not about the pages themselves.
const Blank = { template: '<div />' }
for (const p of [
  '@/views/PreferenceCenterPage.vue',
  '@/views/PreferenceConfirmPage.vue',
  '@/views/LoginPage.vue',
  '@/views/OverviewPage.vue',
  '@/views/NotFoundPage.vue',
]) {
  vi.doMock(p, () => ({ default: Blank }))
}

let router: Router

beforeAll(async () => {
  router = (await import('../index')).default
})

beforeEach(async () => {
  setActivePinia(createPinia())
  localStorage.clear()
  await router.push('/preferences').catch(() => {})
  await router.isReady()
})

describe('public preference-centre routes', () => {
  it('matches /preferences/:token and carries the token as a route param', () => {
    const r = router.resolve('/preferences/abc.def.ghi')
    expect(r.name).toBe('preferences-token')
    expect(r.params.token).toBe('abc.def.ghi')
    expect(r.meta.public).toBe(true)
  })

  it('matches the confirm link without the token route swallowing it', () => {
    const r = router.resolve('/preferences/confirm/short-1?channel=email')
    expect(r.name).toBe('preferences-confirm')
    expect(r.params.shortToken).toBe('short-1')
    expect(r.query.channel).toBe('email')
    expect(r.meta.public).toBe(true)
  })

  it('keeps the legacy bare /preferences?token= form public', () => {
    const r = router.resolve('/preferences?token=legacy')
    expect(r.name).toBe('preferences')
    expect(r.meta.public).toBe(true)
  })

  it('lets an anonymous visitor through — no redirect to /login', async () => {
    for (const path of [
      '/preferences',
      '/preferences/abc.def.ghi',
      '/preferences/confirm/short-1',
    ]) {
      await router.push(path).catch(() => {})
      expect(router.currentRoute.value.path, `${path} must stay public`).toBe(path)
    }
  })

  it('still bounces an anonymous visitor off a non-public route', async () => {
    await router.push('/overview').catch(() => {})
    expect(router.currentRoute.value.name).toBe('login')
  })
})
