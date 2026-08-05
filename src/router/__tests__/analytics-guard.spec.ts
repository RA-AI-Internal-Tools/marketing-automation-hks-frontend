/**
 * Analytics routes are gated to admin+editor, mirroring the server: every
 * /api/analytics/* endpoint is behind requireRole(admin, editor).
 *
 * WHY THIS SUITE EXISTS RATHER THAN TRUSTING THE SERVER GATE. The server is
 * the security boundary and it is tested separately (99 gated routes, 226
 * observed refusals). This guard is the UX half: without it a viewer still
 * sees the sidebar entries, clicks one, and lands on a page that renders
 * nothing but 403s. That was the live state for Churn Risk and Cohorts & LTV,
 * whose endpoints were admin+editor long before the flag existed.
 *
 * The negative cases matter more than the positive ones. A guard that lets
 * everyone through passes any test that only ever drives an admin, so every
 * assertion below is paired: the same path is driven as editor (allowed) and
 * as viewer (redirected).
 *
 * Drives the REAL router, not a reimplementation.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'
import { STORAGE_KEYS } from '@/constants/storage'

const Blank = { template: '<div />' }
for (const p of [
  '@/views/LoginPage.vue', '@/views/OverviewPage.vue', '@/views/NotFoundPage.vue',
  '@/views/analytics/ExecutivePage.vue', '@/views/analytics/AcquisitionPage.vue',
  '@/views/analytics/FunnelPage.vue', '@/views/analytics/ClientsPage.vue',
  '@/views/analytics/ProductsPage.vue', '@/views/analytics/PaymentsPage.vue',
  '@/views/analytics/OrdersPage.vue', '@/views/analytics/RetentionPage.vue',
  '@/views/analytics/DataHealthPage.vue', '@/views/analytics/AttributionPage.vue',
  '@/views/analytics/ChurnPage.vue', '@/views/analytics/RFMPage.vue',
  '@/views/analytics/CohortPage.vue', '@/views/analytics/JourneyPage.vue',
  '@/views/analytics/ReportsPage.vue',
]) {
  vi.doMock(p, () => ({ default: Blank }))
}

let router: Router

beforeAll(async () => {
  router = (await import('../index')).default
})

function signInAs(role: 'admin' | 'editor' | 'viewer') {
  localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, `${role}@test.local`)
  localStorage.setItem(STORAGE_KEYS.AUTH_ROLE, role)
}

async function landsOn(path: string): Promise<string> {
  await router.push(path).catch(() => {})
  await router.isReady()
  return router.currentRoute.value.path
}

// The thirteen pages whose data comes from admin+editor endpoints.
const GATED = [
  '/analytics/executive', '/analytics/acquisition', '/analytics/funnel',
  '/analytics/clients', '/analytics/products', '/analytics/payments',
  '/analytics/orders', '/analytics/retention', '/analytics/data-health',
  '/analytics/attribution', '/analytics/churn', '/analytics/rfm',
  '/analytics/cohort',
]

// Under /analytics/ but backed by endpoints that are NOT gated:
// /api/dashboard/* and GET /api/reports are readable by every role, so
// gating these pages would deny a viewer data the server still serves.
const NOT_GATED = ['/analytics/journey', '/analytics/reports']

beforeEach(async () => {
  setActivePinia(createPinia())
  localStorage.clear()
  await router.push('/login').catch(() => {})
  await router.isReady()
})

describe('analytics routes are admin+editor only', () => {
  it.each(GATED)('redirects a viewer away from %s', async (path) => {
    signInAs('viewer')
    expect(await landsOn(path)).toBe('/overview')
  })

  it.each(GATED)('admits an editor to %s', async (path) => {
    signInAs('editor')
    expect(await landsOn(path)).toBe(path)
  })

  it.each(GATED)('admits an admin to %s', async (path) => {
    signInAs('admin')
    expect(await landsOn(path)).toBe(path)
  })
})

describe('ungated analytics pages stay open to viewers', () => {
  it.each(NOT_GATED)('admits a viewer to %s', async (path) => {
    signInAs('viewer')
    expect(await landsOn(path)).toBe(path)
  })
})

describe('the guard did not swallow the rest of the app', () => {
  // If requiresAnalytics were accidentally applied broadly — or the check
  // written as "redirect unless admin/editor" without reading the flag —
  // these would fail while every assertion above still passed.
  it.each(['/overview', '/campaigns', '/segments', '/consents', '/cart-activity'])(
    'still admits a viewer to %s',
    async (path) => {
      signInAs('viewer')
      expect(await landsOn(path)).toBe(path)
    },
  )
})
