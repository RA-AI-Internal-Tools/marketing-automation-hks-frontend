/**
 * Error-vs-empty rendering for the data-driven list pages.
 *
 * The defect these pin: when a load failed, each of these pages fell through
 * to its *empty* branch — "No campaigns yet.", "No segments yet.", "No
 * templates match these filters." — telling an operator the data is absent
 * when it is in fact unreachable. That is the worst failure mode available:
 * it looks like a true, actionable answer.
 *
 * Every test here asserts BOTH halves of the distinction:
 *   1. the error surface (role="alert" / ErrorState) is rendered, and
 *   2. the empty-state copy is NOT rendered.
 * Asserting only (1) would still pass if a page rendered both at once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// ── Mocks ────────────────────────────────────────────────────────────────

const fetchCampaigns = vi.fn()
const fetchTemplates = vi.fn()
const fetchSegments = vi.fn()
const fetchSegment = vi.fn()
const fetchSegmentMembers = vi.fn()

vi.mock('@/api/dashboard', () => ({
  fetchCampaigns: (...a: any[]) => fetchCampaigns(...a),
  fetchCampaign: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  toggleCampaign: vi.fn(),
  cloneCampaign: vi.fn(),
  fetchTemplates: (...a: any[]) => fetchTemplates(...a),
  fetchTemplate: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  cloneTemplateAsVariant: vi.fn(),
  fetchSegments: (...a: any[]) => fetchSegments(...a),
  createSegment: vi.fn(),
  updateSegment: vi.fn(),
  deleteSegment: vi.fn(),
  evaluateSegment: vi.fn(),
  evaluateAllSegments: vi.fn(),
  fetchSegment: (...a: any[]) => fetchSegment(...a),
  fetchSegmentMembers: (...a: any[]) => fetchSegmentMembers(...a),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: { slug: 'vip' }, query: {} }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

import ErrorState from '@/components/ErrorState.vue'
import CampaignsPage from '../CampaignsPage.vue'
import TemplatesPage from '../TemplatesPage.vue'
import SegmentsPage from '../SegmentsPage.vue'
import SegmentDetailPage from '../SegmentDetailPage.vue'

const stubs = {
  PageHeader: { template: '<div><slot /></div>' },
  BlueprintPickerModal: true,
  ConfirmDialog: true,
  CloneVariantDialog: true,
  TestSendModal: true,
  ModalWrapper: true,
  RouterLink: { template: '<a><slot /></a>' },
}

const mountOpts = { global: { stubs } }

describe('list pages distinguish a failed load from an empty result', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    fetchCampaigns.mockReset()
    fetchTemplates.mockReset()
    fetchSegments.mockReset()
    fetchSegment.mockReset()
    fetchSegmentMembers.mockReset()
  })

  // ── CampaignsPage ──────────────────────────────────────────────────────

  it('CampaignsPage renders ErrorState (not "No campaigns yet") when load fails', async () => {
    fetchCampaigns.mockRejectedValue({ response: { data: { error: 'campaigns api down' } } })
    const w = mount(CampaignsPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.text()).toContain('campaigns api down')
    expect(w.text()).not.toContain('No campaigns yet')
  })

  it('CampaignsPage still renders the empty state on a genuinely empty list', async () => {
    fetchCampaigns.mockResolvedValue([])
    const w = mount(CampaignsPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(false)
    expect(w.text()).toContain('No campaigns yet')
  })

  // ── TemplatesPage ──────────────────────────────────────────────────────

  it('TemplatesPage renders ErrorState (not the filter-empty copy) when load fails', async () => {
    fetchTemplates.mockRejectedValue(new Error('templates unreachable'))
    const w = mount(TemplatesPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.text()).toContain('templates unreachable')
    expect(w.text()).not.toContain('No templates match these filters')
  })

  it('TemplatesPage still renders the empty copy on a genuinely empty catalogue', async () => {
    fetchTemplates.mockResolvedValue([])
    const w = mount(TemplatesPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(false)
    expect(w.text()).toContain('No templates match these filters')
  })

  // ── SegmentsPage ───────────────────────────────────────────────────────

  it('SegmentsPage renders ErrorState (not "No segments yet") when load fails', async () => {
    fetchSegments.mockRejectedValue({ response: { data: { error: 'segments api down' } } })
    const w = mount(SegmentsPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.text()).toContain('segments api down')
    expect(w.text()).not.toContain('No segments yet')
  })

  it('SegmentsPage still renders the empty state on a genuinely empty list', async () => {
    fetchSegments.mockResolvedValue([])
    const w = mount(SegmentsPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(false)
    expect(w.text()).toContain('No segments yet')
  })

  // ── SegmentDetailPage ──────────────────────────────────────────────────

  it('SegmentDetailPage renders ErrorState (not "Segment not found") on a non-404 failure', async () => {
    fetchSegment.mockRejectedValue({ response: { status: 500, data: { error: 'segment detail exploded' } } })
    fetchSegmentMembers.mockRejectedValue({ response: { status: 500 } })
    const w = mount(SegmentDetailPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.text()).toContain('segment detail exploded')
    expect(w.text()).not.toContain('Segment not found')
  })

  it('SegmentDetailPage keeps "Segment not found" for a real 404', async () => {
    // A 404 is a true, actionable answer — the slug does not exist. Only
    // non-404 failures are the lie this fix targets.
    fetchSegment.mockRejectedValue({ response: { status: 404 } })
    fetchSegmentMembers.mockRejectedValue({ response: { status: 404 } })
    const w = mount(SegmentDetailPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(false)
    expect(w.text()).toContain('Segment not found')
  })
})
