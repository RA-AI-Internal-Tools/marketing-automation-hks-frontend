/**
 * Degradation flags — "could not determine" must not render as "zero".
 *
 * The analytics endpoints are fail-soft: a failed upstream query zeroes its
 * own field and the response is still served 200. Until these flags were
 * consumed, an unreachable CRM produced a confident $0 revenue, an empty
 * cohort table under the copy "requires at least 2 weeks of events", and a
 * data-health page reporting 0 rows for tables it could not count. Each of
 * those looks like a true, actionable answer, which is the worst way to
 * fail.
 *
 * Every test asserts BOTH halves of the distinction:
 *   1. the notice IS rendered when the flag is set, and
 *   2. it is NOT rendered on an identical-but-healthy response.
 * Asserting only (1) would pass for a component that always renders.
 *
 * Flags confirmed in backend source (marketing-automation-hks):
 *   internal/api/routes_analytics.go:325  tracardi_degraded (executive only)
 *   internal/api/routes_analytics.go:326  crm_degraded (executive)
 *   internal/api/routes_analytics.go:453  crm_degraded (orders)
 *   internal/api/routes_analytics.go:828  crm_degraded (payments)
 *   internal/api/routes_analytics.go:879  crm_degraded (retention)
 *   internal/api/routes_analytics.go:1029 crm_degraded (data-health)
 *   internal/api/routes_analytics.go:1061 row_count:null + available:false
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const fetchExecutiveOverview = vi.fn()
const fetchOrders = vi.fn()
const fetchPayments = vi.fn()
const fetchRetention = vi.fn()
const fetchDataHealth = vi.fn()

vi.mock('@/api/analytics', () => ({
  fetchExecutiveOverview: (...a: any[]) => fetchExecutiveOverview(...a),
  fetchOrders: (...a: any[]) => fetchOrders(...a),
  fetchPayments: (...a: any[]) => fetchPayments(...a),
  fetchRetention: (...a: any[]) => fetchRetention(...a),
  fetchDataHealth: (...a: any[]) => fetchDataHealth(...a),
}))

vi.mock('vue-chartjs', () => ({
  Line: { name: 'Line', props: ['data', 'options'], template: '<div data-test="line-chart"></div>' },
}))
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {}, LinearScale: {}, PointElement: {}, LineElement: {},
  Title: {}, Tooltip: {}, Legend: {}, Filler: {},
}))

import { clearAllCache } from '@/composables/useCache'
import DegradedNotice from '@/components/DegradedNotice.vue'
import ExecutivePage from '../ExecutivePage.vue'
import OrdersPage from '../OrdersPage.vue'
import PaymentsPage from '../PaymentsPage.vue'
import RetentionPage from '../RetentionPage.vue'
import DataHealthPage from '../DataHealthPage.vue'

const stubs = {
  AnalyticsLayout: { template: '<section><slot /></section>' },
  PageHeader: { template: '<div><slot /></div>' },
  DonutChart: true,
  CohortTable: true,
}
const mountOpts = { global: { stubs } }

// Healthy baselines. Every field is a real zero / empty array, so a page that
// rendered the notice unconditionally — or keyed it off emptiness rather than
// off the flag — fails the "healthy" half of each pair.
const executive = (over: Record<string, unknown> = {}) => ({
  revenue: 0, revenue_delta: 0, traffic: 0, traffic_delta: 0,
  conversion_rate: 0, conversion_rate_delta: 0,
  active_users: 0, active_users_delta: 0,
  total_orders: 0, total_orders_delta: 0, total_campaigns_active: 0,
  daily_revenue: [], daily_traffic: [],
  ...over,
})
const orders = (over: Record<string, unknown> = {}) => ({
  aov: 0, aov_delta: 0, total_revenue: 0, total_revenue_delta: 0,
  total_orders: 0, total_orders_delta: 0, revenue_trend: [], order_status: [],
  ...over,
})
// methods_supported defaults to TRUE here on purpose. The healthy baseline has
// to be a backend that can supply methods and simply had none in-window,
// otherwise "no notice rendered" would prove nothing about the flag.
const payments = (over: Record<string, unknown> = {}) => ({
  methods: [], approval_rate: 0, decline_rate: 0,
  failure_reasons: [], daily_approvals: [], methods_supported: true,
  ...over,
})
const retention = (over: Record<string, unknown> = {}) => ({
  cohorts: [], campaign_conversions: [], consent_stats: [],
  ...over,
})
const dataHealth = (over: Record<string, unknown> = {}) => ({
  services: [], event_freshness: [], volume_anomalies: [], table_stats: [],
  ...over,
})

function notices(w: ReturnType<typeof mount>) {
  return w.findAllComponents(DegradedNotice)
}

describe('analytics pages surface backend degradation flags', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // ExecutivePage memoises through useCachedFetch; a stale entry would
    // serve the previous test's payload and mask a regression.
    clearAllCache()
    fetchExecutiveOverview.mockResolvedValue(executive())
    fetchOrders.mockResolvedValue(orders())
    fetchPayments.mockResolvedValue(payments())
    fetchRetention.mockResolvedValue(retention())
    fetchDataHealth.mockResolvedValue(dataHealth())
  })

  // ── ExecutivePage: the only endpoint reporting both halves ──────────────

  it('ExecutivePage shows a CRM notice, naming revenue, when crm_degraded', async () => {
    fetchExecutiveOverview.mockResolvedValue(executive({ crm_degraded: true }))
    const w = mount(ExecutivePage, mountOpts)
    await flushPromises()

    const found = notices(w)
    expect(found.length).toBe(1)
    expect(found[0]!.props('source')).toBe('crm')
    expect(w.text()).toContain('Revenue, orders and conversion rate could not be loaded')
    // The whole point: the $0 on screen must be explicitly disowned.
    expect(w.text()).toContain('they are not zero')
  })

  it('ExecutivePage shows only a Tracardi notice when only tracardi_degraded', async () => {
    fetchExecutiveOverview.mockResolvedValue(executive({ tracardi_degraded: true }))
    const w = mount(ExecutivePage, mountOpts)
    await flushPromises()

    const found = notices(w)
    // Half-degraded must stay half-degraded: the CRM revenue figures are
    // fine here and must not be discredited by a page-level banner.
    expect(found.length).toBe(1)
    expect(found[0]!.props('source')).toBe('tracardi')
    expect(w.text()).toContain('Traffic, active clients and conversion rate could not be loaded')
    expect(w.text()).not.toContain('Revenue, orders and conversion rate could not be loaded')
  })

  it('ExecutivePage shows both notices independently when both halves fail', async () => {
    fetchExecutiveOverview.mockResolvedValue(
      executive({ crm_degraded: true, tracardi_degraded: true }),
    )
    const w = mount(ExecutivePage, mountOpts)
    await flushPromises()

    expect(notices(w).map((n) => n.props('source')).sort()).toEqual(['crm', 'tracardi'])
  })

  it('ExecutivePage shows no notice on an all-zero but healthy response', async () => {
    const w = mount(ExecutivePage, mountOpts)
    await flushPromises()

    expect(notices(w).length).toBe(0)
    expect(w.text()).not.toContain('could not be loaded')
  })

  // ── OrdersPage ─────────────────────────────────────────────────────────

  it('OrdersPage names the affected revenue figures when crm_degraded', async () => {
    fetchOrders.mockResolvedValue(orders({ crm_degraded: true }))
    const w = mount(OrdersPage, mountOpts)
    await flushPromises()

    expect(notices(w).length).toBe(1)
    expect(w.text()).toContain('Revenue, AOV, order counts and the revenue trend could not be loaded')
    expect(w.text()).toContain('they are not zero')
  })

  it('OrdersPage shows no notice on a healthy zero-revenue window', async () => {
    const w = mount(OrdersPage, mountOpts)
    await flushPromises()
    expect(notices(w).length).toBe(0)
  })

  // ── PaymentsPage: only `methods` is CRM-sourced ─────────────────────────

  it('PaymentsPage scopes the notice to the method breakdown, sparing Tracardi rates', async () => {
    fetchPayments.mockResolvedValue(payments({ crm_degraded: true, approval_rate: 92.5 }))
    const w = mount(PaymentsPage, mountOpts)
    await flushPromises()

    expect(notices(w).length).toBe(1)
    expect(w.text()).toContain('The payment method breakdown could not be loaded')
    // approval/decline come from Tracardi and stay trustworthy — the notice
    // must not claim otherwise, and the figure must still render.
    expect(w.text()).toContain('92.5%')
    expect(w.text()).not.toContain('Approval Rate could not be loaded')
  })

  it('PaymentsPage shows no notice when the CRM is healthy', async () => {
    const w = mount(PaymentsPage, mountOpts)
    await flushPromises()
    expect(notices(w).length).toBe(0)
    expect(w.find('[data-test="methods-unsupported"]').exists()).toBe(false)
  })

  // ── PaymentsPage: capability absence is NOT degradation ─────────────────
  //
  // This is the shape production is actually in, on every request. The CRM
  // database is reachable; it simply has no payment-method column, because the
  // `orders` table belongs to the CRM service. Until 2026-08-03 the backend
  // reported that through crm_degraded, so this page permanently rendered "We
  // could not reach the CRM database, so these figures are unavailable — they
  // are not zero." Every word of that is false, and no operator could clear it.

  it('PaymentsPage states the capability is absent, not broken, when methods_supported is false', async () => {
    fetchPayments.mockResolvedValue(
      payments({
        methods_supported: false,
        methods_unavailable_reason:
          'payment method distribution unavailable: the CRM-owned public.orders table has no payment-method column',
        approval_rate: 92.5,
      }),
    )
    const w = mount(PaymentsPage, mountOpts)
    await flushPromises()

    // No outage notice. This is the assertion the old behaviour failed.
    expect(notices(w).length).toBe(0)
    expect(w.text()).not.toContain('could not be loaded')
    expect(w.text()).not.toContain('could not reach')
    expect(w.text()).not.toContain('they are not zero')

    // A capability statement in its place, naming the real cause.
    const statement = w.find('[data-test="methods-unsupported"]')
    expect(statement.exists()).toBe(true)
    expect(statement.text()).toContain('not tracked in this database')
    expect(statement.text()).toContain('orders')
    // methods_unavailable_reason had zero consumers across src/ and dist/ when
    // it shipped. It is rendered now, so drift between the copy and the real
    // backend reason is visible on the page rather than only in a payload.
    expect(statement.text()).toContain('has no payment-method column')

    // The Tracardi half is untouched and must still render as fact.
    expect(w.text()).toContain('92.5%')
  })

  it('PaymentsPage does not report zero payment methods when it cannot count them', async () => {
    fetchPayments.mockResolvedValue(payments({ methods_supported: false }))
    const w = mount(PaymentsPage, mountOpts)
    await flushPromises()

    const card = w
      .findAll('*')
      .map((n) => n.text())
      .find((t) => t.startsWith('Payment Methods'))
    expect(card).toBeDefined()
    // `methods.length` is 0 here, and "0" on a metric card is a confident
    // claim that nobody used any payment method.
    expect(card).toContain('Not tracked')
    expect(card).not.toContain('0')
  })

  it('PaymentsPage treats an absent methods_supported as supported', async () => {
    // A backend older than the deploy that added the field omits it. Undefined
    // must not render the capability statement — that would tell every operator
    // on an older build that a feature they have is missing.
    const { methods_supported: _omitted, ...older } = payments()
    fetchPayments.mockResolvedValue(older)
    const w = mount(PaymentsPage, mountOpts)
    await flushPromises()

    expect(w.find('[data-test="methods-unsupported"]').exists()).toBe(false)
    expect(notices(w).length).toBe(0)
  })

  it('PaymentsPage still shows the outage notice when a real query fails', async () => {
    // Both signals at once is the only combination that proves they are
    // independent: a genuine failure on a backend that DOES support methods.
    fetchPayments.mockResolvedValue(payments({ crm_degraded: true, methods_supported: true }))
    const w = mount(PaymentsPage, mountOpts)
    await flushPromises()

    expect(notices(w).length).toBe(1)
    expect(w.text()).toContain('The payment method breakdown could not be loaded')
    expect(w.find('[data-test="methods-unsupported"]').exists()).toBe(false)
  })

  // ── RetentionPage ──────────────────────────────────────────────────────

  it('RetentionPage contradicts the encouraging empty copy when crm_degraded', async () => {
    fetchRetention.mockResolvedValue(retention({ crm_degraded: true }))
    const w = mount(RetentionPage, mountOpts)
    await flushPromises()

    expect(notices(w).length).toBe(1)
    expect(w.text()).toContain('Cohorts, campaign conversions and consent stats could not be loaded')
  })

  it('RetentionPage shows no notice on a genuinely empty cohort set', async () => {
    const w = mount(RetentionPage, mountOpts)
    await flushPromises()

    expect(notices(w).length).toBe(0)
    // The "not enough history yet" copy is correct in this case and stays.
    expect(w.text()).toContain('requires at least 2 weeks')
  })

  // ── DataHealthPage: per-row `available` beats the endpoint-level flag ───

  it('DataHealthPage renders "Unavailable" — not 0 — for a table it could not count', async () => {
    fetchDataHealth.mockResolvedValue(
      dataHealth({
        crm_degraded: true,
        table_stats: [
          { table: 'users', row_count: 42, available: true },
          { table: 'campaign_logs', row_count: null, available: false },
        ],
      }),
    )
    const w = mount(DataHealthPage, mountOpts)
    await flushPromises()

    expect(notices(w).length).toBe(1)
    const rows = w.findAll('tbody tr').map((r) => r.text())
    const users = rows.find((t) => t.includes('users'))
    const logs = rows.find((t) => t.includes('campaign_logs'))

    expect(users).toContain('42')
    expect(logs).toContain('Unavailable')
    // The regression this pins: a null row_count coerced to a confident 0
    // on the one page whose whole job is reporting what is broken.
    expect(logs).not.toContain('0')
  })

  it('DataHealthPage renders a real zero count as 0, with no notice', async () => {
    fetchDataHealth.mockResolvedValue(
      dataHealth({ table_stats: [{ table: 'users', row_count: 0, available: true }] }),
    )
    const w = mount(DataHealthPage, mountOpts)
    await flushPromises()

    expect(notices(w).length).toBe(0)
    const row = w.findAll('tbody tr').map((r) => r.text()).find((t) => t.includes('users'))
    expect(row).toContain('0')
    expect(row).not.toContain('Unavailable')
  })

  it('DataHealthPage treats a legacy row with no `available` field as available', async () => {
    // Older backends sent neither `available` nor a null row_count. A missing
    // flag must read as available, never as degraded.
    fetchDataHealth.mockResolvedValue(
      dataHealth({ table_stats: [{ table: 'users', row_count: 7 }] }),
    )
    const w = mount(DataHealthPage, mountOpts)
    await flushPromises()

    const row = w.findAll('tbody tr').map((r) => r.text()).find((t) => t.includes('users'))
    expect(row).toContain('7')
    expect(row).not.toContain('Unavailable')
  })
})
