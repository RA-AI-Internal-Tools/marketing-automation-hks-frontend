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
import {
  backendCandidates,
  SKIP_BACKEND_SYNC,
  warnBackendSyncDisabled,
} from '@/api/__tests__/backendRepo'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StatusBadge from '@/components/StatusBadge.vue'
import type { ChannelStats, CampaignPerformance } from '@/api/types'
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
// A vi.fn() like its two siblings, rather than a fixed arrow, so a single
// test can supply real rows without changing what every other test sees.
const fetchDailyVolume = vi.fn()

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
  fetchDailyVolume: (...a: any[]) => fetchDailyVolume(...a),
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
// The Line stub declares `data` as a prop so a test can read the datasets
// the page actually built. Without the prop declaration Vue puts it in
// attrs and `props('data')` returns undefined, which would make the chart
// assertions below silently vacuous rather than failing.
vi.mock('vue-chartjs', () => ({
  Bar: { name: 'Bar', template: '<div class="chart-stub" />' },
  Line: {
    name: 'Line',
    props: ['data', 'options'],
    template: '<div class="chart-stub" />',
  },
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
  gate_unavailable: 13,
}

// Typed as CampaignPerformance for the same reason CHANNEL_ROW is typed as
// ChannelStats: so the fixture cannot drift from the DTO the page consumes.
// It was previously an untyped object literal, and that gap had teeth — when
// total_gate_unavailable was added as a required field, `vue-tsc --build`
// stayed green here while OverviewPage threw
// "Cannot read properties of undefined (reading 'toLocaleString')" on mount,
// taking three unrelated assertions down with it. A type error at the
// fixture is the cheap version of that failure.
const PERF_ROW: CampaignPerformance = {
  campaign_slug: 'welcome',
  total_sent: 7,
  total_failed: 3,
  total_skipped: 9022,
  total_gate_unavailable: 17,
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
  // Empty by default — every existing assertion in this file is about labels
  // and columns, not the volume chart.
  fetchDailyVolume.mockResolvedValue([])
})

// ── 0. Backend vocabulary sync ───────────────────────────────────────────

// Backend location, the opt-out flag and its stderr announcement all live in
// src/api/__tests__/backendRepo.ts, shared with the DTO-drift guard. They were
// duplicated here first; a second hand-written copy of "where is the backend"
// is precisely the drift these guards exist to catch, so there is now one.
const BACKEND_CANDIDATES = backendCandidates('internal', 'model', 'campaign.go')

if (SKIP_BACKEND_SYNC) {
  warnBackendSyncDisabled(
    'logStatusVocabulary',
    'LOG_STATUSES <-> internal/model/campaign.go',
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
  const values = [...block.matchAll(/^\s*LogStatus\w+(?:\s+\w+)?\s*=\s*"([^"]+)"/gm)].map((m) => {
    const value = m[1]
    // Capture group 1 is not optional in the pattern above, so a match
    // always carries it. Throw rather than `.filter(Boolean)`: a future
    // edit that makes the group optional would otherwise silently SHRINK
    // `values`, which would quietly weaken both the >8 non-vacuity floor
    // and the whole-file count cross-check below — the exact class of
    // silent-degradation failure this whole guard exists to prevent.
    if (value === undefined) {
      throw new Error(
        `LogStatus declaration matched in ${file} but capture group 1 was empty — ` +
          `the extraction regex in this spec has been edited and no longer captures the value`,
      )
    }
    return value
  })

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
  // later `const (...)` group, or a standalone `const LogStatusFoo = "..."`
  // declaration outside any block — and would otherwise be silently
  // invisible to the backend/frontend comparison below.
  //
  // `(?:const\s+)?` is required for the standalone-declaration case: a
  // lone top-level `const LogStatusLone = "lone_thing"` starts with
  // `const `, so the bare `^\s*LogStatus\w+` anchor (identifier must be
  // the first token on the line) matches neither this regex nor the
  // in-block one above, and the guard misses a brand-new backend value
  // entirely — proven by mutation: a temp copy of campaign.go with
  // exactly that line appended ran this spec green, 11/11, before this
  // fix was added.
  //
  // Residual gaps, left as known limitations rather than silently assumed
  // away:
  //  - Non-string-literal assignments are invisible to both this regex and
  //    the in-block value extractor above, since both require `=\s*"`
  //    immediately after the identifier. `LogStatusAlias = LogStatusSent`
  //    (aliasing an existing value) is harmless to miss. `LogStatusCombo =
  //    statusPrefix + "combo"` is NOT harmless — it introduces a genuinely
  //    new backend value while this guard reports all-clear — reproduced
  //    green. Widening this cross-check alone to count non-quoted
  //    assignments would not fix that: it would just create a NEW
  //    mismatch against the (necessarily string-only) in-block extractor
  //    for the harmless alias case, trading a silent miss for a false red
  //    on legitimate code. A regex could likely be refined to separate the
  //    two cases (e.g. widen to any RHS, then exclude a bare-identifier
  //    RHS to keep the alias case quiet) but is deliberately left
  //    unhandled: that refinement is fragile against a trailing comment on
  //    the alias line, `iota`, or a multi-line RHS, and a false red here on
  //    legitimate backend code is exactly the kind of failure that gets a
  //    guard like this one disabled rather than fixed.
  //  - A backtick raw string whose CONTENTS happen to contain a line
  //    starting `LogStatusExample = "..."` (e.g. a doc comment reproduced
  //    as a code sample) will false-RED this guard: the whole-file scan
  //    below counts it as an extra declaration, producing the same "found
  //    N ... but only M inside the block" count-mismatch message a real
  //    undetected constant would produce, without naming any specific
  //    constant. Not handled — low probability in this file today, but if
  //    this guard ever fails with that count-mismatch message and
  //    campaign.go does not obviously contain an extra LogStatus constant,
  //    check for a raw string reproducing this shape before assuming the
  //    drift is real.
  const wholeFileCount = [...src.matchAll(/^\s*(?:const\s+)?LogStatus\w+.*=\s*"/gm)].length
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

  // Without this, the gate_unavailable column could be deleted from
  // OverviewPage.vue and the whole suite would stay green: nothing else
  // reaches into that table by name. CHANNEL_BREAKDOWN_STATUSES covers the
  // Channels page only.
  // The daily-volume chart is the third place the backend serves
  // gate_unavailable (internal/store/dashboard.go:262, counted at :274) and
  // the third place nothing plotted it. Over time is the shape that matters
  // for an infra fault: a spike is an incident with a date on it, which
  // neither the Channels row nor the per-campaign column can show.
  it('plots gate_unavailable as its own series on the volume chart', async () => {
    fetchDailyVolume.mockResolvedValue([
      { date: '2026-08-08', sent: 5, failed: 1, gate_unavailable: 41 },
      { date: '2026-08-09', sent: 6, failed: 2, gate_unavailable: 43 },
    ])
    const w = await mountOverview()

    const chart = w.findComponent({ name: 'Line' })
    expect(chart.exists(), 'the volume chart did not mount').toBe(true)

    const datasets = (chart.props('data') as any).datasets
    // Non-vacuity: if `data` ever stops reaching the stub this reads
    // undefined, and every assertion below would pass on an empty find.
    expect(Array.isArray(datasets), 'chart data.datasets is not an array').toBe(true)

    const series = datasets.find(
      (d: any) => d.label === logStatusLabel('gate_unavailable'),
    )
    expect(series, 'no gate_unavailable series on the volume chart').toBeTruthy()
    // Values come from the DTO, in order, not from a placeholder.
    expect(series.data).toEqual([41, 43])
    // Not an area fill: the healthy value is a flat zero, and a filled band
    // along the axis reads as "some baseline amount of this is normal".
    expect(series.fill, 'the fault series is filled like a volume series').toBe(false)
  })

  it('shows gate_unavailable as its OWN column, separate from the roll-up', async () => {
    const w = await mountOverview()

    const th = w.get('[data-test="perf-col-gate-unavailable"]')
    expect(th.text()).toContain(logStatusLabel('gate_unavailable'))

    // The value is rendered from the DTO, not fabricated: PERF_ROW carries a
    // distinctive 17 that appears nowhere else in the fixture.
    const cell = w.get('[data-test="perf-cell-gate-unavailable"]')
    expect(cell.text()).toBe('17')

    // And it is genuinely NOT inside the roll-up. total_skipped is 9022 in
    // the fixture; if someone folded gate_unavailable back in, the roll-up
    // cell would move and this would catch it.
    expect(
      th.text().trim().toLowerCase(),
      'the infra-fault column is being labelled as the suppression roll-up',
    ).not.toBe(SUPPRESSED_ROLLUP_LABEL.trim().toLowerCase())
    expect(
      SUPPRESSED_STATUSES,
      'gate_unavailable must never join the suppression roll-up — it is not a decision',
    ).not.toContain('gate_unavailable')
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
