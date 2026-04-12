import api from './client'

export interface Broadcast {
  id: number
  name: string
  template_key: string
  channel: string
  segment_filter: string
  scheduled_at: string
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled' | 'failed'
  context?: Record<string, any> | null
  sent_count: number
  failed_count: number
  skipped_count: number
  total_clients: number
  created_by_email?: string
  created_at: string
  updated_at: string
  started_at?: string | null
  completed_at?: string | null
  error?: string
}

export interface BroadcastRequest {
  name: string
  template_key: string
  channel: string
  segment_filter?: string
  scheduled_at: string
  context?: Record<string, any>
}

export async function listBroadcasts(params: { status?: string; limit?: number; offset?: number } = {}) {
  const { data } = await api.get<{ data: Broadcast[]; total: number }>('/api/broadcasts', { params })
  return data
}

export async function getBroadcast(id: number) {
  const { data } = await api.get<Broadcast>(`/api/broadcasts/${id}`)
  return data
}

export async function createBroadcast(req: BroadcastRequest) {
  const { data } = await api.post<Broadcast>('/api/broadcasts', req)
  return data
}

export async function updateBroadcast(id: number, req: BroadcastRequest) {
  const { data } = await api.put<Broadcast>(`/api/broadcasts/${id}`, req)
  return data
}

export async function scheduleBroadcast(id: number) {
  const { data } = await api.post<Broadcast>(`/api/broadcasts/${id}/schedule`)
  return data
}

export async function cancelBroadcast(id: number) {
  const { data } = await api.post<Broadcast>(`/api/broadcasts/${id}/cancel`)
  return data
}

export async function deleteBroadcast(id: number) {
  await api.delete(`/api/broadcasts/${id}`)
}

// Server-side render a template (no send, no audit)
export async function previewTemplate(templateId: number, sample?: Record<string, any>) {
  const { data } = await api.post<{
    template_key: string
    channel: string
    rendered_subject: string
    rendered_body: string
    sample_used: Record<string, any>
  }>(`/api/templates/${templateId}/preview`, { sample })
  return data
}
