/**
 * AttributionPage — revenue attribution dashboard spec.
 *
 * Charts are stubbed so we can run under happy-dom without a real canvas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const fetchRevenueAttributionOverview = vi.fn()
const fetchRevenueAttribution = vi.fn()

vi.mock('@/api/revenue_attribution', () => ({
  fetchRevenueAttributionOverview: (...a: any[]) => fetchRevenueAttributionOverview(...a),
  fetchRevenueAttribution: (...a: any[]) => fetchRevenueAttribution(...a),
}))

vi.mock('vue-chartjs', () => ({
  Line: { name: 'Line', props: ['data', 'options'], template: '<div data-test="line-chart" :data-points="(data?.datasets?.[0]?.data || []).length" />' },
  Bar:  { name: 'Bar',  props: ['data', 'options'], template: '<div data-test="bar-chart"  :data-points="(data?.datasets?.[0]?.data || []).length" />' },
}))
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {}, LinearScale: {}, PointElement: {}, LineElement: {},
  BarElement: {}, Title: {}, Tooltip: {}, Legend: {}, Filler: {},
}))

import AttributionPage from '../AttributionPage.vue'

const stubs = {
  AnalyticsLayout: { template: '<section><slot /></section>' },
}

const overview = {
  window_days: 30,
  total_revenue: 12345,
  total_sends: 100,
  revenue_per_send: 123,
  daily_series: [
    { date: '2026-04-01', revenue: 100 },
    { date: '2026-04-02', revenue: 200 },
    { date: '2026-04-03', revenue: 300 },
  ],
}
const rows = {
  rows: [
    { campaign_slug: 'welcome', channel: 'email', sends: 10, revenue: 500, unique_clients: 5 },
    { campaign_slug: 'reengage', channel: 'sms', sends: 4, revenue: 120, unique_clients: 4 },
  ],
}

describe('AttributionPage', () => {
  beforeEach(() => {
    fetchRevenueAttributionOverview.mockReset().mockResolvedValue(overview)
    fetchRevenueAttribution.mockReset().mockResolvedValue(rows)
  })

  it('renders the chart with expected data points from mocked API', async () => {
    const w = mount(AttributionPage, { global: { stubs } })
    await flushPromises()
    const line = w.find('[data-test="line-chart"]')
    expect(line.exists()).toBe(true)
    expect(line.attributes('data-points')).toBe('3')
    expect(w.text()).toContain('Attributed revenue')
  })

  it('switching attribution model refetches with the new model', async () => {
    const w = mount(AttributionPage, { global: { stubs } })
    await flushPromises()
    expect(fetchRevenueAttributionOverview).toHaveBeenLastCalledWith(30, 'last_touch')

    const buttons = w.findAll('button').filter(b => b.text() === 'Linear')
    expect(buttons.length).toBeGreaterThan(0)
    await buttons[0]!.trigger('click')
    await flushPromises()

    expect(fetchRevenueAttributionOverview).toHaveBeenLastCalledWith(30, 'linear')
    expect(fetchRevenueAttribution).toHaveBeenLastCalledWith(30, 'linear')
  })

  it('renders empty-state message when API returns no attribution rows', async () => {
    fetchRevenueAttribution.mockResolvedValue({ rows: [] })
    fetchRevenueAttributionOverview.mockResolvedValue({ ...overview, daily_series: [] })
    const w = mount(AttributionPage, { global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain('No attribution events in this window yet.')
  })
})
