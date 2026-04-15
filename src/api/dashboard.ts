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

export interface CampaignGraphNode {
  id: number
  label: string
  channel: string
  condition: string
  type: 'action' | 'condition' | 'webhook' | 'wait'
  data?: Record<string, any>
}
export interface CampaignGraphEdge {
  source: number
  target: number
  label?: 'true' | 'false' | 'next' | ''
}
export interface CampaignGraph {
  campaign_id: number
  slug: string
  name: string
  nodes: CampaignGraphNode[]
  edges: CampaignGraphEdge[]
}
export async function fetchCampaignGraph(id: number): Promise<CampaignGraph> {
  const { data } = await api.get<CampaignGraph>(`/api/campaigns/${id}/graph`)
  return data
}

// Shape of a Step the PUT endpoint expects. Mirrors internal/model Step —
// only fields the builder actually writes are required here; unknown fields
// are dropped by the backend JSON unmarshal as usual.
export interface CampaignStepPayload {
  delay_minutes: number
  channel: string
  template_key: string
  condition: string
  condition_params?: Record<string, unknown>
  true_next?: number | null
  false_next?: number | null
  wait_for_event?: string
  wait_for_event_timeout?: number
  webhook_url?: string
  webhook_method?: string
  webhook_headers?: Record<string, string>
  // Builder-only metadata — preserved by the backend in the steps JSON
  // column but ignored at runtime. Omit for auto-layout.
  position_x?: number
  position_y?: number
}

export async function replaceCampaignSteps(id: number, steps: CampaignStepPayload[]) {
  const { data } = await api.put(`/api/campaigns/${id}/steps`, { steps })
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

export async function optOut(clientId: number, channel: string, purpose?: string): Promise<void> {
  // `purpose` defaults to 'marketing' server-side when omitted. Pass it
  // explicitly when the caller knows (e.g. flipping a personalization
  // consent row) so the backend doesn't mutate the wrong record.
  const body: Record<string, unknown> = { client_id: clientId, channel }
  if (purpose) body.purpose = purpose
  await api.post('/api/consents/opt-out', body)
}

export async function optIn(clientId: number, channel: string, purpose?: string): Promise<void> {
  const body: Record<string, unknown> = { client_id: clientId, channel }
  if (purpose) body.purpose = purpose
  await api.post('/api/consents/opt-in', body)
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

// CSV export — server streams text/csv; we ask axios for a blob so the
// browser download flow can hand it to URL.createObjectURL without us
// having to re-encode UTF-8 by hand.
export async function exportAuditLogs(params: Record<string, any> = {}): Promise<Blob> {
  const { data } = await api.get('/api/audit-logs/export', { params, responseType: 'blob' })
  return data as Blob
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

// Clone a template into an inactive locale-variant draft. Variant key is
// derived server-side: `<base>.<locale>` (e.g. "welcome_email.ar-iq").
export async function cloneTemplateAsVariant(id: number, locale: string): Promise<MessageTemplate> {
  const { data } = await api.post(`/api/templates/${id}/clone-variant`, { locale })
  return data
}

// Clone campaign
export async function cloneCampaign(id: number): Promise<CampaignDefinition> {
  const { data } = await api.post(`/api/campaigns/${id}/clone`)
  return data
}

// Campaign graph — typed fetcher is defined earlier in this file (line 71).
// The old `any`-typed version used to live here; keeping the comment so
// nobody re-adds it from a stale reference.

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
  // Backend returns { segment, member_count } — unwrap so callers get a flat
  // Segment matching the type. The member_count is folded into the row so
  // the detail page's audience tile reads it without a second API call.
  const { data } = await api.get(`/api/segments/${slug}`)
  if (data && typeof data === 'object' && 'segment' in data) {
    return { ...data.segment, member_count: data.member_count }
  }
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
  // Backend returns { members, total, limit, offset } — unwrap to the array
  // so callers can iterate directly. Pagination metadata is dropped here
  // because the detail page doesn't paginate (it shows up to the default
  // page size). If a caller needs total, it should hit the endpoint
  // directly.
  const { data } = await api.get(`/api/segments/${slug}/members`)
  if (data && typeof data === 'object' && 'members' in data) {
    return data.members ?? []
  }
  return Array.isArray(data) ? data : []
}

export async function evaluateSegment(slug: string): Promise<{ evaluated: number }> {
  const { data } = await api.post(`/api/segments/${slug}/evaluate`)
  return data
}

export async function evaluateAllSegments(): Promise<any> {
  const { data } = await api.post('/api/segments/evaluate-all')
  return data
}
