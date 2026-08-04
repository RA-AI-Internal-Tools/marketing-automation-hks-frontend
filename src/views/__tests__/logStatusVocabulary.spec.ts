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
 * status added to LOG_STATUSES fails these tests until both dashboards
 * have been told what to do with it.
 *
 * That is a frontend-only property, and on its own it is not the one the
 * header used to advertise ("a status added to the BACKEND vocabulary
 * fails these tests"): the coverage test iterates LOG_STATUSES, so it only
 * fires when someone edits that file. It was claiming a backend-sync
 * guarantee while LOG_STATUSES sat two statuses behind
 * internal/model/campaign.go — `queued`, written live by executor.go's
 * logAndAdvance, and `unsubscribed`, written by the provider-webhook
 * classifier — with all 287 tests green. The `backendVocabulary` block
 * below closes that gap by reading the backend constants directly; the
 * chain "backend const block → LOG_STATUSES → dashboard bucket → rendered
 * label" is only unbroken with both halves present.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StatusBadge from '@/components/StatusBadge.vue'
import type { ChannelStats } from '@/api/types'
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

// A single channel carrying a distinct non-zero count in every bucket, so
// no row can be hidden by a falsy value and no row can pass a value
// assertion by coincidence. Typed as ChannelStats so the fixture cannot
// drift from the DTO the page actually consumes.
const CHANNEL_ROW: ChannelStats = {
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

// ── 0. Backend vocabulary sync ───────────────────────────────────────────

// The backend is a sibling checkout. This is not a new assumption invented
// for this test: package.json's `generate-types` script already reads
// ../marketing-automation-hks/docs/swagger.json to regenerate the API
// types. MA_BACKEND_REPO overrides the location for non-standard layouts.
//
// Located by walking up from cwd to the package.json that identifies this
// repo, rather than from import.meta.url — under the vitest transform
// import.meta.url is not a file: URL and fileURLToPath throws. If the walk
// fails it returns cwd, which simply makes the candidate paths below not
// exist, and the test fails loudly listing what it searched. There is no
// path through this function that lets the guard pass without reading the
// backend.
function resolveFrontendRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, 'package.json')
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, 'utf8')).name === 'marketing-automation-hks-frontend') {
          return dir
        }
      } catch {
        // Unparseable package.json — keep walking.
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

const FRONTEND_ROOT = resolveFrontendRoot()

const BACKEND_CANDIDATES = (
  process.env.MA_BACKEND_REPO
    ? [process.env.MA_BACKEND_REPO]
    : [
        path.resolve(FRONTEND_ROOT, '..', 'marketing-automation-hks'),
        path.resolve(FRONTEND_ROOT, '..', 'backend'),
      ]
).map((root) => path.join(root, 'internal', 'model', 'campaign.go'))

// Explicit, visible opt-out for environments without the backend checked
// out. Deliberately NOT the default: a guard that quietly disappears when
// its input is missing is the failure mode this whole block exists to
// close, so absent this flag a missing backend is a loud test FAILURE, not
// a skip.
const SKIP_BACKEND_SYNC = process.env.MA_SKIP_BACKEND_SYNC === '1'
if (SKIP_BACKEND_SYNC) {
  // console.warn is swallowed here: vitest's default reporter does not
  // print module-scope console output to the terminal at all (verified —
  // under `vitest run` a bare console.warn at this scope never reaches
  // stdout/stderr). process.stderr.write bypasses that interception and
  // is the one line in this file actually guaranteed to reach a human (or
  // a CI log) running the suite with the flag set.
  process.stderr.write(
    '[logStatusVocabulary] MA_SKIP_BACKEND_SYNC=1 — the LOG_STATUSES <-> ' +
      'internal/model/campaign.go drift guard is DISABLED for this run.\n',
  )
}

/**
 * Extract the string values of the `// Log status constants.` const block.
 *
 * Scoped to that one block rather than grepping the whole file for
 * /LogStatus\w+/, so unrelated references (helpers, switch arms, other
 * const groups) cannot inflate the set. Doc-comment lines inside the block
 * start with `//` and therefore never match the declaration pattern.
 *
 * Block-scoping is a defensible design choice on its own, but it is only
 * safe paired with the whole-file cross-check below: without it, a
 * LogStatus constant declared in a SECOND, later `const (...)` block (Go
 * allows any number of const blocks) is invisible to this parser and the
 * guard silently stops covering it — the exact failure mode this file
 * exists to prevent, one level up.
 */
function parseBackendLogStatuses(src: string, file: string): Set<string> {
  const marker = '// Log status constants.'
  const start = src.indexOf(marker)
  expect(start, `${file} no longer contains the "${marker}" marker`).toBeGreaterThanOrEqual(0)

  const open = src.indexOf('const (', start)
  expect(open, `no "const (" block follows "${marker}" in ${file}`).toBeGreaterThan(start)

  const close = src.indexOf('\n)', open)
  expect(close, `unterminated const block after "${marker}" in ${file}`).toBeGreaterThan(open)

  const block = src.slice(open, close)
  // The `(?:\s+\w+)?` allows an optional Go type token between the
  // identifier and `=` — e.g. `LogStatusTyped string = "typed_thing"` is a
  // legal, type-annotated const declaration that the bare
  // `LogStatus\w+\s*=` pattern silently skipped.
  const values = [...block.matchAll(/^\s*LogStatus\w+(?:\s+\w+)?\s*=\s*"([^"]+)"/gm)].map((m) => m[1])

  // Non-vacuity: an empty or near-empty parse means the block's shape
  // changed and this guard has stopped guarding. Fail on the parse, not
  // silently on a trivially-satisfied set comparison.
  expect(
    values.length,
    `parsed only ${values.length} LogStatus constants from ${file} — the const block shape changed and this guard is no longer reading it`,
  ).toBeGreaterThan(8)

  const set = new Set(values)
  expect(set.size, `duplicate LogStatus values in ${file}: ${values.join(', ')}`).toBe(values.length)

  // Whole-file cross-check: count every LogStatus assignment anywhere in
  // the file (not just inside the delimited block) and require it to equal
  // the in-block count. A mismatch means a LogStatus constant exists
  // outside the block this parser reads — most commonly a second,
  // later `const (...)` group — and would otherwise be silently invisible
  // to the backend/frontend comparison below.
  const wholeFileCount = [...src.matchAll(/^\s*LogStatus\w+.*=\s*"/gm)].length
  expect(
    wholeFileCount,
    `found ${wholeFileCount} LogStatus constant declaration(s) across the whole file but only ` +
      `${values.length} inside the "${marker}" block in ${file} — a LogStatus constant exists ` +
      `outside the delimited block and this guard is not reading it`,
  ).toBe(values.length)

  return set
}

// The name also carries the opt-out state, as a secondary signal for any
// reporter/CI dashboard that lists individual (including skipped) test
// names. It is NOT the primary signal: this repo's default `vitest run`
// reporter prints neither module-scope console output nor skipped test
// names — with the flag set, its entire visible trace is the
// process.stderr.write line above and the "N skipped" count in the
// summary totals (`Tests X passed | 1 skipped (X+1)`). Watch for that
// count, or grep the stderr line; do not rely on this name appearing
// anywhere in a default `vitest run`.
const BACKEND_SYNC_NAME = SKIP_BACKEND_SYNC
  ? 'DISABLED by MA_SKIP_BACKEND_SYNC=1 — LOG_STATUSES is NOT checked against the backend LogStatus* constants'
  : 'LOG_STATUSES matches the backend LogStatus* constant block exactly (set MA_SKIP_BACKEND_SYNC=1 to disable)'

describe('backendVocabulary', () => {
  it.skipIf(SKIP_BACKEND_SYNC)(BACKEND_SYNC_NAME, () => {
    const file = BACKEND_CANDIDATES.find((p) => existsSync(p))
    if (!file) {
      expect.fail(
        'Cannot locate the backend LogStatus vocabulary, so LOG_STATUSES cannot be ' +
          'checked for drift. Searched:\n  ' +
          BACKEND_CANDIDATES.join('\n  ') +
          '\nSet MA_BACKEND_REPO=/path/to/marketing-automation-hks, or set ' +
          'MA_SKIP_BACKEND_SYNC=1 to run without this guard (and lose drift detection).',
      )
    }

    const backend = parseBackendLogStatuses(readFileSync(file, 'utf8'), file)
    const frontend = new Set(LOG_STATUSES.map((s) => s.value))

    const missing = [...backend].filter((v) => !frontend.has(v)).sort()
    const extra = [...frontend].filter((v) => !backend.has(v)).sort()

    expect(
      missing,
      `campaign_logs statuses the backend can write but LOG_STATUSES does not know about — ` +
        `they are unfilterable on LogsPage and unbucketed on both dashboards: ${missing.join(', ')}`,
    ).toEqual([])

    expect(
      extra,
      `LOG_STATUSES claims statuses the backend has no constant for: ${extra.join(', ')}`,
    ).toEqual([])
  })
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
    // Compared case- and whitespace-insensitively: "Skipped " and "skipped"
    // are the same word to a reader, so they must be the same collision to
    // this test. An exact-string comparison would hand out a green tick for
    // a trailing space.
    const norm = (s: string) => s.trim().toLowerCase()
    for (const { value, label } of LOG_STATUSES) {
      expect(
        norm(SUPPRESSED_ROLLUP_LABEL),
        `the roll-up is labelled "${SUPPRESSED_ROLLUP_LABEL}", which is also the label of the single status "${value}"`,
      ).not.toBe(norm(label))
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

      // The VALUE, not just the label. Without this, a status broken out
      // here that the backend never sends rendered a confident `0` — a
      // fabricated statistic on an operator dashboard, with the row count
      // and label assertions above both still green. The fixture carries a
      // distinct non-zero count per bucket, so `0` (or any other row's
      // number) fails.
      const rendered = row!.get('[data-test="channel-stat-value"]').text().trim()
      expect(
        rendered,
        `Channels row "${status}" does not render the count the backend supplied`,
      ).toBe(String(CHANNEL_ROW[status]))
      expect(Number(rendered), `Channels row "${status}" rendered a fabricated zero`).toBeGreaterThan(0)
    }
  })
})

// ── 2b. StatusBadge — the highest-impression status surface ──────────────

describe('StatusBadge status labels', () => {
  it('renders every LogStatus with the shared vocabulary label, character for character', async () => {
    // StatusBadge is used by LogsPage rows, ClientJourneyPage and the
    // Overview recent-logs list, so it puts a status name in front of more
    // operators than either dashboard. It used to derive its own text
    // (`status.replace(/_/g,' ')` + CSS `capitalize`), which agreed with
    // logStatusLabel() only because every label happens to be the
    // title-case of its own snake_case value — and already disagreed in
    // the DOM. Nothing pinned that, so #117 was reproducible on a third
    // surface. `.text()` returns the DOM text, before any CSS transform,
    // which is precisely what makes this assertion bite.
    for (const { value } of LOG_STATUSES) {
      const w = mount(StatusBadge, { props: { status: value } })
      expect(
        w.text().trim(),
        `StatusBadge renders its own display text for "${value}" instead of the shared label`,
      ).toBe(logStatusLabel(value))
    }
  })
})

// ── 3. Overview campaign-performance table ───────────────────────────────

describe('Campaign performance roll-up column', () => {
  it('is labelled as a roll-up, not as the single "skipped" status', async () => {
    const w = await mountOverview()
    const th = w.get('[data-test="perf-col-suppressed"]')
    expect(th.text()).toContain(SUPPRESSED_ROLLUP_LABEL)
    // Normalised: "Skipped " must not buy a pass that "Skipped" would not.
    expect(
      th.text().trim().toLowerCase(),
      'the roll-up column is still named after a single LogStatus',
    ).not.toBe(logStatusLabel('skipped').trim().toLowerCase())
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

    // Normalised on both sides: two labels a reader would call the same
    // word must collide here regardless of case or stray whitespace.
    // Comparing raw strings would let "Skipped " through.
    const norm = (s: string) => s.trim().toLowerCase()

    const channelLabels = channels
      .findAll('[data-test="channel-stat-label"]')
      .map((n) => norm(n.text()))
    // Non-vacuity: if the Channels page stopped rendering labels entirely,
    // the disjointness check below would pass for the wrong reason.
    expect(channelLabels.length).toBe(CHANNEL_BREAKDOWN_STATUSES.length)

    const rollupHeader = overview.get('[data-test="perf-col-suppressed"]').text().trim()

    expect(
      channelLabels,
      `"${rollupHeader}" labels a ${SUPPRESSED_STATUSES.length}-status roll-up on the campaign-performance table, ` +
        'but the Channels page uses that same word for a single status over the same rows',
    ).not.toContain(norm(rollupHeader))
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
