import api from './client'

export interface RevenueAttributionRow {
  campaign_slug: string
  channel: string
  sends: number
  revenue: number
  unique_clients: number
}

export interface DailyRevenuePoint {
  date: string
  revenue: number
}

export interface RevenueAttributionOverview {
  window_days: number
  model: 'last_touch' | 'linear'
  total_revenue: number
  total_sends: number
  revenue_per_send: number
  daily_series: DailyRevenuePoint[]
}

export type AttributionModel = 'last_touch' | 'linear'

export async function fetchRevenueAttribution(days: number, model: AttributionModel) {
  const { data } = await api.get<{
    rows: RevenueAttributionRow[]
    window_days: number
    model: AttributionModel
  }>('/api/analytics/revenue-attribution', { params: { days, model } })
  return data
}

export async function fetchRevenueAttributionOverview(days: number, model: AttributionModel) {
  const { data } = await api.get<RevenueAttributionOverview>(
    '/api/analytics/revenue-attribution/overview',
    { params: { days, model } },
  )
  return data
}

export async function fetchCampaignAttribution(campaignID: number, days: number, model: AttributionModel) {
  const { data } = await api.get<{
    campaign_slug: string
    rows: RevenueAttributionRow[]
    window_days: number
    model: AttributionModel
  }>(`/api/campaigns/${campaignID}/attribution`, { params: { days, model } })
  return data
}
