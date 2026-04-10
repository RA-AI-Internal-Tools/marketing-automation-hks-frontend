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
  Segment,
  SegmentRequest,
  SegmentMember,
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

// Campaign funnel & variants
export async function fetchCampaignFunnel(slug: string): Promise<import('./types').CampaignFunnelStats> {
  const { data } = await api.get(`/api/campaigns/slug/${slug}/funnel`)
  return data
}

export async function fetchVariantPerformance(slug: string, step?: number): Promise<import('./types').VariantPerformance[]> {
  const { data } = await api.get(`/api/campaigns/slug/${slug}/variants`, { params: { step } })
  return data
}

// Audit logs
export async function fetchAuditLogs(params: Record<string, any> = {}): Promise<import('./types').PaginatedResponse<import('./types').AuditLog>> {
  const { data } = await api.get('/api/audit-logs', { params })
  return data
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

// Clone campaign
export async function cloneCampaign(id: number): Promise<CampaignDefinition> {
  const { data } = await api.post(`/api/campaigns/${id}/clone`)
  return data
}

// Campaign graph
export async function fetchCampaignGraph(id: number): Promise<any> {
  const { data } = await api.get(`/api/campaigns/${id}/graph`)
  return data
}

// Client journey
export async function fetchClientJourney(clientId: number): Promise<any> {
  const { data } = await api.get(`/api/clients/${clientId}/journey`)
  return data
}

// Cache flush
export async function flushCache(): Promise<any> {
  const { data } = await api.post('/api/cache/flush')
  return data
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

// Segments
export async function fetchSegments(): Promise<Segment[]> {
  const { data } = await api.get('/api/segments')
  return data
}

export async function fetchSegment(slug: string): Promise<Segment> {
  const { data } = await api.get(`/api/segments/${slug}`)
  return data
}

export async function createSegment(req: SegmentRequest): Promise<Segment> {
  const { data } = await api.post('/api/segments', req)
  return data
}

export async function updateSegment(slug: string, req: SegmentRequest): Promise<Segment> {
  const { data } = await api.put(`/api/segments/${slug}`, req)
  return data
}

export async function deleteSegment(slug: string): Promise<void> {
  await api.delete(`/api/segments/${slug}`)
}

export async function fetchSegmentMembers(slug: string): Promise<SegmentMember[]> {
  const { data } = await api.get(`/api/segments/${slug}/members`)
  return data
}

export async function evaluateSegment(slug: string): Promise<{ evaluated: number }> {
  const { data } = await api.post(`/api/segments/${slug}/evaluate`)
  return data
}

export async function evaluateAllSegments(): Promise<any> {
  const { data } = await api.post('/api/segments/evaluate-all')
  return data
}
