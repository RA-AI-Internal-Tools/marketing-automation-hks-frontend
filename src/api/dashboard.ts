import api from './client'
import type {
  CampaignDefinition,
  CampaignEnrollment,
  CampaignLog,
  ClientConsent,
  OverviewStats,
  ChannelStats,
  CampaignPerformance,
  DailyVolume,
  HealthCheck,
  PaginatedResponse,
} from './types'

export async function fetchOverviewStats(): Promise<OverviewStats> {
  const { data } = await api.get('/api/dashboard/overview')
  return data
}

export async function fetchChannelStats(since?: string): Promise<ChannelStats[]> {
  const { data } = await api.get('/api/dashboard/channels', { params: { since } })
  return data
}

export async function fetchCampaignPerformance(since?: string): Promise<CampaignPerformance[]> {
  const { data } = await api.get('/api/dashboard/campaigns', { params: { since } })
  return data
}

export async function fetchDailyVolume(days = 30): Promise<DailyVolume[]> {
  const { data } = await api.get('/api/dashboard/volume', { params: { days } })
  return data
}

export async function fetchCampaigns(): Promise<CampaignDefinition[]> {
  const { data } = await api.get('/api/campaigns')
  return data
}

export async function fetchEnrollments(params: Record<string, any> = {}): Promise<PaginatedResponse<CampaignEnrollment>> {
  const { data } = await api.get('/api/enrollments', { params })
  return data
}

export async function fetchLogs(params: Record<string, any> = {}): Promise<PaginatedResponse<CampaignLog>> {
  const { data } = await api.get('/api/logs', { params })
  return data
}

export async function fetchConsents(clientId: number): Promise<ClientConsent[]> {
  const { data } = await api.get(`/api/consents/${clientId}`)
  return data
}

export async function optOut(clientId: number, channel: string): Promise<void> {
  await api.post('/api/consents/opt-out', { client_id: clientId, channel })
}

export async function optIn(clientId: number, channel: string): Promise<void> {
  await api.post('/api/consents/opt-in', { client_id: clientId, channel })
}

export async function fetchHealth(): Promise<HealthCheck> {
  const { data } = await api.get('/healthz')
  return data
}

export async function triggerEvent(eventType: string, clientId: number, context?: Record<string, any>): Promise<void> {
  await api.post('/api/events/trigger', { event_type: eventType, client_id: clientId, context })
}

export async function cancelEvent(event: string, clientId: number): Promise<void> {
  await api.post('/api/events/cancel', { event, client_id: clientId })
}
