import api from './client'

export type RFMSegment =
  | 'champions' | 'loyal' | 'potential_loyal' | 'recent' | 'promising'
  | 'need_attention' | 'about_to_sleep' | 'at_risk' | 'cant_lose'
  | 'hibernating' | 'lost'

export interface RFMSegmentCountsResponse {
  counts: Record<RFMSegment, number>
  segments: RFMSegment[]
}

export async function fetchRFMSegmentCounts() {
  const { data } = await api.get<RFMSegmentCountsResponse>('/api/rfm/segments')
  return data
}

export interface RFMAudienceRow {
  client_id: number
  total_orders: number
  total_revenue: number
}

export async function fetchRFMAudience(segment: RFMSegment) {
  const { data } = await api.get<{ segment: RFMSegment; sample: RFMAudienceRow[] }>(
    `/api/rfm/segment/${encodeURIComponent(segment)}`,
  )
  return data
}

export interface ClientRFMScore {
  client_id: number
  recency_score: number
  frequency_score: number
  monetary_score: number
  rfm_segment: RFMSegment
  total_orders?: number
  total_revenue?: number
  last_order_at?: string
  computed_at: string
}

export async function fetchClientRFM(clientID: number) {
  const { data } = await api.get<ClientRFMScore>(`/api/rfm/client/${clientID}`)
  return data
}
