/**
 * Segment evaluation — a PARTIAL failure must not report success.
 *
 * POST /segments/:slug/evaluate counts membership writes that errored into
 * `failed` (routes_segments.go:320-323). Two distinct outcomes:
 *
 *   - every write failed  → HTTP 500 + `error` key (routes_segments.go:329-334).
 *     Already surfaced: it rejects, and the catch shows an error toast.
 *   - some writes failed  → HTTP 200, body otherwise identical to a clean run.
 *     This was invisible: the page read only `evaluated` and reported the
 *     green "Evaluation complete" over a run that half-failed.
 *
 * Both halves are asserted: a partial run warns, and a clean run keeps the
 * success toast (a test that only checked the warning would pass for a page
 * that warned unconditionally).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const fetchSegments = vi.fn()
const evaluateSegment = vi.fn()
const showToast = vi.fn()

vi.mock('@/api/dashboard', () => ({
  fetchSegments: (...a: any[]) => fetchSegments(...a),
  createSegment: vi.fn(),
  updateSegment: vi.fn(),
  deleteSegment: vi.fn(),
  evaluateSegment: (...a: any[]) => evaluateSegment(...a),
  evaluateAllSegments: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast }),
}))

import SegmentsPage from '../SegmentsPage.vue'

const stubs = {
  PageHeader: { template: '<div><slot /></div>' },
  ConfirmDialog: true,
  ModalWrapper: true,
  RouterLink: { template: '<a><slot /></a>' },
}

const segment = {
  id: 1,
  name: 'VIP',
  slug: 'vip',
  rule_type: 'order_count',
  operator: 'gte',
  threshold_min: 5,
  entry_events: ['order-completed'],
  is_built_in: false,
  is_active: true,
  member_count: 3,
  sync_to_tracardi: false,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
}

/** Click the per-row "Evaluate now" button and let the handler settle. */
async function clickEvaluate(w: ReturnType<typeof mount>) {
  const btn = w.findAll('button').find((b) => b.attributes('title') === 'Evaluate now')
  expect(btn, 'evaluate button should be rendered').toBeTruthy()
  await btn!.trigger('click')
  await flushPromises()
}

describe('SegmentsPage distinguishes a partial evaluation from a clean one', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    fetchSegments.mockResolvedValue([segment])
  })

  it('warns, and names the failure count, when some membership writes failed', async () => {
    evaluateSegment.mockResolvedValue({ evaluated: 100, entered: 4, exited: 1, failed: 7 })
    const w = mount(SegmentsPage, { global: { stubs } })
    await flushPromises()
    await clickEvaluate(w)

    expect(showToast).toHaveBeenCalled()
    const [message, type] = showToast.mock.calls.at(-1)!
    expect(type).toBe('warning')
    expect(message).toContain('7')
    expect(message).not.toContain('Evaluation complete')
  })

  it('pluralises a single failed membership change', async () => {
    evaluateSegment.mockResolvedValue({ evaluated: 100, entered: 1, exited: 0, failed: 1 })
    const w = mount(SegmentsPage, { global: { stubs } })
    await flushPromises()
    await clickEvaluate(w)

    const [message] = showToast.mock.calls.at(-1)!
    expect(message).toContain('1 membership change could not be saved')
  })

  it('keeps the success toast when failed is 0', async () => {
    evaluateSegment.mockResolvedValue({ evaluated: 100, entered: 4, exited: 1, failed: 0 })
    const w = mount(SegmentsPage, { global: { stubs } })
    await flushPromises()
    await clickEvaluate(w)

    const [message, type] = showToast.mock.calls.at(-1)!
    expect(type).toBe('success')
    expect(message).toContain('Evaluation complete')
  })

  it('keeps the success toast when the backend omits `failed` entirely', async () => {
    // Older backend, or the evaluate-all shape. Absent must read as "none
    // failed", not as a failure.
    evaluateSegment.mockResolvedValue({ evaluated: 100 })
    const w = mount(SegmentsPage, { global: { stubs } })
    await flushPromises()
    await clickEvaluate(w)

    const [, type] = showToast.mock.calls.at(-1)!
    expect(type).toBe('success')
  })

  it('still shows the 500 total-failure error, which rejects', async () => {
    evaluateSegment.mockRejectedValue({
      response: { status: 500, data: { error: 'segment evaluation failed: no membership change could be persisted' } },
    })
    const w = mount(SegmentsPage, { global: { stubs } })
    await flushPromises()
    await clickEvaluate(w)

    const [message, type] = showToast.mock.calls.at(-1)!
    expect(type).toBe('error')
    expect(message).toContain('no membership change could be persisted')
  })
})
