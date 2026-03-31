import api from './client'
import type {
  CampaignDefinition,
  CampaignEnrollment,
  CampaignLog,
  CampaignRequest,
  ClientConsent,
  MessageTemplate,
  TemplateRequest,
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

export async function fetchCampaign(id: number): Promise<CampaignDefinition> {
  const { data } = await api.get(`/api/campaigns/${id}`)
  return data
}

export async function createCampaign(req: CampaignRequest): Promise<CampaignDefinition> {
  const { data } = await api.post('/api/campaigns', req)
  return data
}

export async function updateCampaign(id: number, req: CampaignRequest): Promise<CampaignDefinition> {
  const { data } = await api.put(`/api/campaigns/${id}`, req)
  return data
}

export async function deleteCampaign(id: number): Promise<void> {
  await api.delete(`/api/campaigns/${id}`)
}

export async function toggleCampaign(id: number): Promise<{ is_active: boolean }> {
  const { data } = await api.patch(`/api/campaigns/${id}/toggle`)
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

// Export (Axios blob download — includes auth header)
export async function exportLogs(params: Record<string, any> = {}): Promise<void> {
  const { data, headers } = await api.get('/api/export/logs', { params, responseType: 'blob' })
  downloadBlob(data, headers['content-disposition'] || 'logs.csv')
}

export async function exportEnrollments(params: Record<string, any> = {}): Promise<void> {
  const { data, headers } = await api.get('/api/export/enrollments', { params, responseType: 'blob' })
  downloadBlob(data, headers['content-disposition'] || 'enrollments.csv')
}

function downloadBlob(blob: Blob, disposition: string) {
  const match = disposition.match(/filename=(.+)/)
  const filename = match?.[1] ?? 'export.csv'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Test send
export async function testSend(req: { channel: string; template_key: string; client_id: number; params?: Record<string, any> }): Promise<any> {
  const { data } = await api.post('/api/test-send', req)
  return data
}

// Templates
export async function fetchTemplates(channel?: string): Promise<MessageTemplate[]> {
  const { data } = await api.get('/api/templates', { params: { channel } })
  return data
}

export async function fetchTemplate(id: number): Promise<MessageTemplate> {
  const { data } = await api.get(`/api/templates/${id}`)
  return data
}

export async function createTemplate(req: TemplateRequest): Promise<MessageTemplate> {
  const { data } = await api.post('/api/templates', req)
  return data
}

export async function updateTemplate(id: number, req: TemplateRequest): Promise<MessageTemplate> {
  const { data } = await api.put(`/api/templates/${id}`, req)
  return data
}

export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/api/templates/${id}`)
}

// Settings
export async function fetchSettings(): Promise<any> {
  const { data } = await api.get('/api/settings')
  return data
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/api/settings/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}
