/**
 * Cross-page LogStatus vocabulary consistency (task #117).
 *
 * The defect these pin: the Channels page and the campaign-performance
 * table on the Overview page both printed the word "Skipped" over the same
 * campaign_logs rows while meaning two different sets.
 *
 *   Channels   → ChannelStats.skipped
 *                = COUNT(status = 'skipped')                       (one status)
 *   Overview   → CampaignPerformance.total_skipped
 *                = COUNT(status IN ('skipped','condition_not_met',
 *                                   'frequency_capped','no_consent'))
 *
 * (both in internal/store/dashboard.go, GetChannelStats /
 * GetCampaignPerformance). In production the roll-up is dominated by
 * no_consent, so the two "Skipped" numbers differ by orders of magnitude —
 * and the Channels page shows no_consent as its OWN line at the same time,
 * so the same row is counted under two different names on two pages.
 *
 * A secondary drift the same fix closes: frequency_capped rendered as
 * "Freq Capped" on Channels and "Frequency Capped" in the LogsPage filter.
 *
 * Every assertion below derives its expectations from
 * src/constants/logStatus.ts rather than hardcoding label strings, so a
 * status added to the backend vocabulary fails these tests until both
 * dashboards have been told what to do with it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  LOG_STATUSES,
  LOG_STATUS_LABELS,
  logStatusLabel,
  CHANNEL_BREAKDOWN_STATUSES,
  SUPPRESSED_STATUSES,
  SUPPRESSED_ROLLUP_LABEL,
  suppressedRollupTitle,
  DASHBOARD_UNRENDERED_STATUSES,
} from '@/constants/logStatus'

// ── Mocks ────────────────────────────────────────────────────────────────

const fetchChannelStats = vi.fn()
const fetchCampaignPerformance = vi.fn()

vi.mock('@/api/dashboard', () => ({
  fetchChannelStats: (...a: any[]) => fetchChannelStats(...a),
  fetchCampaignPerformance: (...a: any[]) => fetchCampaignPerformance(...a),
  fetchOverviewStats: () =>
    Promise.resolve({
      total_campaigns: 1,
      active_campaigns: 1,
      total_enrollments: 10,
      active_enrollments: 5,
      completed_enrollments: 4,
      cancelled_enrollments: 1,
    }),
  fetchDailyVolume: () => Promise.resolve([]),
}))

vi.mock('@/api/revenue_attribution', () => ({
  fetchRevenueAttributionOverview: () => Promise.resolve(null),
}))

vi.mock('@/stores/dashboard', () => ({
  useDashboardStore: () => ({
    sseConnected: false,
    recentLogs: [],
    recentEnrollments: [],
    startSSE: vi.fn(),
    stopSSE: vi.fn(),
  }),
}))

// Charts are irrelevant to label text and drag in canvas APIs happy-dom
// does not provide.
vi.mock('vue-chartjs', () => ({
  Bar: { name: 'Bar', template: '<div class="chart-stub" />' },
  Line: { name: 'Line', template: '<div class="chart-stub" />' },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
  RouterLink: { template: '<a><slot /></a>' },
}))

// A single channel carrying a non-zero count in every bucket, so no row can
// be hidden by a falsy value.
const CHANNEL_ROW = {
  channel: 'email',
  sent: 7,
  failed: 3,
  skipped: 5,
  frequency_capped: 11,
  no_consent: 9001,
}

const PERF_ROW = {
  campaign_slug: 'welcome',
  total_sent: 7,
  total_failed: 3,
  total_skipped: 9022,
  total_opened: 2,
  total_clicked: 1,
  enrollments: 10,
  completions: 4,
}

async function mountChannels() {
  const ChannelsPage = (await import('@/views/ChannelsPage.vue')).default
  const w = mount(ChannelsPage)
  await flushPromises()
  return w
}

async function mountOverview() {
  const OverviewPage = (await import('@/views/OverviewPage.vue')).default
  const w = mount(OverviewPage)
  await flushPromises()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  fetchChannelStats.mockResolvedValue([CHANNEL_ROW])
  fetchCampaignPerformance.mockResolvedValue([PERF_ROW])
})

// ── 1. The vocabulary itself ─────────────────────────────────────────────

describe('LogStatus vocabulary', () => {
  it('gives every status exactly one label, and no two statuses share one', () => {
    expect(LOG_STATUSES.length).toBeGreaterThan(0)
    for (const { value, label } of LOG_STATUSES) {
      expect(LOG_STATUS_LABELS[value], `no label for ${value}`).toBe(label)
      expect(logStatusLabel(value)).toBe(label)
    }
    const labels = LOG_STATUSES.map((s) => s.label)
    expect(new Set(labels).size, `duplicate labels in: ${labels.join(', ')}`).toBe(labels.length)
  })

  it('only references statuses that exist in the vocabulary', () => {
    const known = new Set(LOG_STATUSES.map((s) => s.value))
    for (const s of [
      ...CHANNEL_BREAKDOWN_STATUSES,
      ...SUPPRESSED_STATUSES,
      ...DASHBOARD_UNRENDERED_STATUSES,
    ]) {
      expect(known.has(s), `${s} is bucketed but is not a LogStatus`).toBe(true)
    }
  })

  it('accounts for every status in some dashboard bucket', () => {
    // Forcing function: a new backend LogStatus added to LOG_STATUSES fails
    // here until someone decides whether it is broken out on Channels,
    // folded into the roll-up, or deliberately unrendered.
    const placed = new Set([
      ...CHANNEL_BREAKDOWN_STATUSES,
      ...SUPPRESSED_STATUSES,
      ...DASHBOARD_UNRENDERED_STATUSES,
    ])
    const unplaced = LOG_STATUSES.map((s) => s.value).filter((v) => !placed.has(v))
    expect(unplaced, `unbucketed statuses: ${unplaced.join(', ')}`).toEqual([])
  })

  it('never names the roll-up after one of its own members', () => {
    // This is the #117 invariant, stated at the vocabulary level.
    for (const { value, label } of LOG_STATUSES) {
      expect(
        SUPPRESSED_ROLLUP_LABEL,
        `the roll-up is labelled "${SUPPRESSED_ROLLUP_LABEL}", which is also the label of the single status "${value}"`,
      ).not.toBe(label)
    }
    // Non-vacuity: the roll-up really does contain more than one status, so
    // the assertion above is constraining something real.
    expect(SUPPRESSED_STATUSES.length).toBeGreaterThan(1)
  })
})

// ── 2. Channels page ─────────────────────────────────────────────────────

describe('Channels page status labels', () => {
  it('renders one row per broken-out status, labelled from the shared vocabulary', async () => {
    const w = await mountChannels()
    const rows = w.findAll('[data-test="channel-stat"]')
    expect(rows.length).toBe(CHANNEL_BREAKDOWN_STATUSES.length)

    for (const status of CHANNEL_BREAKDOWN_STATUSES) {
      const row = rows.find((r) => r.attributes('data-status') === status)
      expect(row, `Channels page renders no row for status "${status}"`).toBeTruthy()
      expect(row!.get('[data-test="channel-stat-label"]').text()).toBe(logStatusLabel(status))
    }
  })
})

// ── 3. Overview campaign-performance table ───────────────────────────────

describe('Campaign performance roll-up column', () => {
  it('is labelled as a roll-up, not as the single "skipped" status', async () => {
    const w = await mountOverview()
    const th = w.get('[data-test="perf-col-suppressed"]')
    expect(th.text()).toContain(SUPPRESSED_ROLLUP_LABEL)
    expect(
      th.text().trim(),
      'the roll-up column is still named after a single LogStatus',
    ).not.toBe(logStatusLabel('skipped'))
  })

  it('discloses its membership in the column tooltip', async () => {
    const w = await mountOverview()
    const title = w.get('[data-test="perf-col-suppressed"]').attributes('title')
    expect(title).toBe(suppressedRollupTitle())
    for (const status of SUPPRESSED_STATUSES) {
      expect(title, `tooltip hides member "${status}"`).toContain(logStatusLabel(status))
    }
  })
})

// ── 4. The cross-page invariant (task #117) ──────────────────────────────

describe('Channels and campaign performance agree on vocabulary', () => {
  it('never uses one page’s single-status label for the other page’s roll-up', async () => {
    const channels = await mountChannels()
    const overview = await mountOverview()

    const channelLabels = channels
      .findAll('[data-test="channel-stat-label"]')
      .map((n) => n.text().trim())
    // Non-vacuity: if the Channels page stopped rendering labels entirely,
    // the disjointness check below would pass for the wrong reason.
    expect(channelLabels.length).toBe(CHANNEL_BREAKDOWN_STATUSES.length)

    const rollupHeader = overview.get('[data-test="perf-col-suppressed"]').text().trim()

    expect(
      channelLabels,
      `"${rollupHeader}" labels a ${SUPPRESSED_STATUSES.length}-status roll-up on the campaign-performance table, ` +
        'but the Channels page uses that same word for a single status over the same rows',
    ).not.toContain(rollupHeader)
  })

  it('renders the identical label for any status both pages name', async () => {
    const channels = await mountChannels()
    const overview = await mountOverview()

    const labelOn = (w: ReturnType<typeof mount>) => {
      const m = new Map<string, string>()
      for (const n of w.findAll('[data-test="channel-stat"]')) {
        const s = n.attributes('data-status')
        if (s) m.set(s, n.get('[data-test="channel-stat-label"]').text().trim())
      }
      return m
    }

    const fromChannels = labelOn(channels)
    const fromOverview = labelOn(overview) // empty today; guards future reuse

    expect(fromChannels.size).toBeGreaterThan(0)
    for (const [status, label] of fromOverview) {
      if (fromChannels.has(status)) {
        expect(fromChannels.get(status), `disagreement on "${status}"`).toBe(label)
      }
      expect(label).toBe(logStatusLabel(status))
    }
    for (const [status, label] of fromChannels) {
      expect(label, `Channels page hand-types a label for "${status}"`).toBe(logStatusLabel(status))
    }
  })
})
