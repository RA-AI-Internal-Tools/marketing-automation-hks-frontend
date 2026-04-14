/**
 * RFMPage — Kumar-Reinartz 11-segment dashboard spec.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const fetchRFMSegmentCounts = vi.fn()

vi.mock('@/api/rfm', () => ({
  fetchRFMSegmentCounts: (...a: any[]) => fetchRFMSegmentCounts(...a),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('vue-chartjs', () => ({
  Doughnut: { name: 'Doughnut', props: ['data', 'options'], template: '<div data-test="donut-chart"></div>' },
}))
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  ArcElement: {}, Tooltip: {}, Legend: {},
}))

import RFMPage from '../RFMPage.vue'

const stubs = {
  AnalyticsLayout: { template: '<section><slot /></section>' },
}

const fullCounts = {
  champions: 10, loyal: 8, potential_loyal: 7, recent: 6, promising: 5,
  need_attention: 4, about_to_sleep: 3, at_risk: 2, cant_lose: 1,
  hibernating: 3, lost: 2,
}

describe('RFMPage', () => {
  beforeEach(() => {
    fetchRFMSegmentCounts.mockReset().mockResolvedValue({
      counts: fullCounts,
      segments: Object.keys(fullCounts),
    })
  })

  it('renders 11 Kumar-Reinartz segment rows in the table', async () => {
    const w = mount(RFMPage, { global: { stubs } })
    await flushPromises()
    const rows = w.findAll('tbody tr')
    expect(rows.length).toBe(11)
    // Spot-check labels from the canonical vocabulary.
    const text = w.text()
    expect(text).toContain('Champions')
    expect(text).toContain("Can't lose")
    expect(text).toContain('Hibernating')
    expect(text).toContain('Lost')
  })

  it('renders the donut chart once scored population is non-zero', async () => {
    const w = mount(RFMPage, { global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="donut-chart"]').exists()).toBe(true)
  })

  it('hides the donut and shows the placeholder when nothing is scored', async () => {
    fetchRFMSegmentCounts.mockResolvedValue({ counts: {}, segments: [] })
    const w = mount(RFMPage, { global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="donut-chart"]').exists()).toBe(false)
    expect(w.text()).toContain("Nightly job hasn't computed scores yet")
  })
})
