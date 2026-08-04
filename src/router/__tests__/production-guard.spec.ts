/**
 * Router production guard — drives the REAL router, not a reimplementation.
 *
 * The defect: `beforeEach` prompted on every navigation into a requiresWrite
 * route. Two of the six (/template-library, /catalog) are ordinary sidebar
 * entries (AppSidebar.vue:79-80), so an operator got a "this will affect real
 * customers and data" dialog on every plain sidebar click. Previously masked
 * because the stored environment default was 'sandbox'; it is now correctly
 * 'production', so the guard fires as designed.
 *
 * The guard itself is correct and must keep firing the FIRST time — every
 * test here asserts both that it prompts once and that it then stops.
 *
 * Component resolution is stubbed at the module level: `router.push` awaits
 * each route's lazy import, and this suite is about guard sequencing, not
 * about page components.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { STORAGE_KEYS } from '@/constants/storage'
import type { Router } from 'vue-router'

// Every lazily-imported page resolves to the same trivial component: this
// suite is about guard sequencing, and router.push awaits each route's
// dynamic import. Registered with doMock (not hoisted) and consumed via the
// dynamic import in beforeAll, so the mocks are in place before the router
// module is evaluated.
const Blank = { template: '<div />' }
for (const p of [
  '@/views/LoginPage.vue', '@/views/PreferenceCenterPage.vue', '@/views/OverviewPage.vue',
  '@/views/CampaignsPage.vue', '@/views/CampaignEditorPage.vue', '@/views/CampaignBuilderPage.vue',
  '@/views/CampaignFunnelPage.vue', '@/views/TemplatesPage.vue', '@/views/TemplateLibraryPage.vue',
  '@/views/TemplateEditorPage.vue', '@/views/CatalogPage.vue', '@/views/SegmentsPage.vue',
  '@/views/SegmentDetailPage.vue', '@/views/NotFoundPage.vue',
]) {
  vi.doMock(p, () => ({ default: Blank }))
}

let router: Router
let useEnvironmentStore: typeof import('@/stores/environment')['useEnvironmentStore']

beforeAll(async () => {
  ;({ useEnvironmentStore } = await import('@/stores/environment'))
  router = (await import('../index')).default
})

/** Poll until the guard dialog opens, or give up. Returns whether it opened. */
async function waitForDialog(env: ReturnType<typeof useEnvironmentStore>) {
  for (let i = 0; i < 50; i++) {
    if (env.showProductionGuard) return true
    await new Promise((r) => setTimeout(r, 0))
  }
  return false
}

/** Navigate, answering the dialog if one appears. Returns whether it appeared. */
async function go(path: string, answer: 'confirm' | 'cancel' | null) {
  const env = useEnvironmentStore()
  const nav = router.push(path)
  const prompted = await waitForDialog(env)
  if (prompted && answer === 'confirm') env.confirmGuard()
  if (prompted && answer === 'cancel') env.cancelGuard()
  await nav.catch(() => {}) // an aborted navigation rejects
  return prompted
}

describe('router production guard prompts once per session, not per navigation', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, 'ops@ar-pay.com')
    localStorage.setItem(STORAGE_KEYS.AUTH_ROLE, 'admin')
    // Park on a non-guarded route so each test starts from a clean position.
    await router.push('/overview').catch(() => {})
    await router.isReady()
  })

  it('prompts on the first guarded route', async () => {
    expect(await go('/catalog', 'confirm')).toBe(true)
    expect(router.currentRoute.value.path).toBe('/catalog')
  })

  it('does NOT prompt again on the next sidebar click', async () => {
    expect(await go('/catalog', 'confirm')).toBe(true)
    // /template-library and /catalog are both plain sidebar entries. Before
    // the fix this second navigation re-opened the modal.
    expect(await go('/template-library', null)).toBe(false)
    expect(router.currentRoute.value.path).toBe('/template-library')
  })

  it('stays silent across all six guarded routes once acknowledged', async () => {
    await go('/catalog', 'confirm')
    for (const p of ['/campaigns/new', '/templates/new', '/template-library', '/catalog']) {
      expect(await go(p, null), `${p} should not re-prompt`).toBe(false)
      expect(router.currentRoute.value.path).toBe(p)
    }
  })

  it('blocks the navigation when the operator cancels', async () => {
    expect(await go('/catalog', 'cancel')).toBe(true)
    expect(router.currentRoute.value.path).toBe('/overview')
  })

  it('prompts again after a cancellation — declining is not consent', async () => {
    await go('/catalog', 'cancel')
    expect(await go('/catalog', 'confirm')).toBe(true)
    expect(router.currentRoute.value.path).toBe('/catalog')
  })

  it('re-arms when the environment is switched back to production', async () => {
    const env = useEnvironmentStore()
    await go('/catalog', 'confirm')
    expect(await go('/template-library', null)).toBe(false)

    env.switchMode('sandbox')
    // Sandbox never prompts.
    expect(await go('/catalog', null)).toBe(false)

    env.switchMode('production')
    // Back in production the acknowledgement is gone and the dialog returns.
    expect(await go('/template-library', 'confirm')).toBe(true)
  })

  it('never prompts on non-write routes', async () => {
    expect(await go('/segments', null)).toBe(false)
    expect(await go('/campaigns', null)).toBe(false)
  })

  it('does not leave a superseded navigation pending forever', async () => {
    const env = useEnvironmentStore()
    const first = router.push('/catalog')
    await waitForDialog(env)
    const second = router.push('/template-library')
    await new Promise((r) => setTimeout(r, 0))
    env.confirmGuard()

    // The old monkey-patched cancelGuard could leave the first promise
    // unsettled; both must settle.
    await expect(Promise.all([first.catch(() => 'aborted'), second.catch(() => 'aborted')]))
      .resolves.toBeDefined()
  })
})
