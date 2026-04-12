import api from './client'

export interface OutboundWebhook {
  id: number
  name: string
  url: string
  event_types: string[]
  active: boolean
  description?: string
  last_delivery_at?: string | null
  last_delivery_success?: boolean | null
  created_by_email?: string
  created_at: string
  updated_at: string
}

export interface WebhookDelivery {
  id: number
  webhook_id: number
  event_type: string
  payload: string
  status: 'pending' | 'in_flight' | 'retrying' | 'delivered' | 'failed'
  attempts: number
  next_attempt_at?: string | null
  http_status?: number
  response_body?: string
  error_message?: string
  created_at: string
  delivered_at?: string | null
  updated_at: string
}

export interface OutboundWebhookRequest {
  name: string
  url: string
  event_types: string[]
  active?: boolean
  description?: string
  secret?: string // optional — server generates if empty
}

export async function listOutboundWebhooks() {
  const { data } = await api.get<{ webhooks: OutboundWebhook[]; event_types: string[] }>(
    '/api/outbound-webhooks',
  )
  return data
}

export async function getOutboundWebhook(id: number) {
  const { data } = await api.get<OutboundWebhook>(`/api/outbound-webhooks/${id}`)
  return data
}

// On creation, the server returns the generated secret ONCE in the top-level
// `secret` field — show it to the user and never round-trip it again.
export async function createOutboundWebhook(req: OutboundWebhookRequest) {
  const { data } = await api.post<{ webhook: OutboundWebhook; secret: string }>(
    '/api/outbound-webhooks',
    req,
  )
  return data
}

export async function updateOutboundWebhook(id: number, req: OutboundWebhookRequest) {
  const { data } = await api.put<OutboundWebhook>(`/api/outbound-webhooks/${id}`, req)
  return data
}

export async function deleteOutboundWebhook(id: number) {
  await api.delete(`/api/outbound-webhooks/${id}`)
}

export async function fireTestWebhook(id: number) {
  const { data } = await api.post<{ status: string; event_type: string }>(
    `/api/outbound-webhooks/${id}/test`,
  )
  return data
}

export interface DeliveryStats {
  window_hours: number
  delivered: number
  failed: number
  retrying: number
  pending: number
  in_flight: number
}

export async function getDeliveryStats(hours = 24) {
  const { data } = await api.get<DeliveryStats>('/api/outbound-webhooks/deliveries/stats', {
    params: { hours },
  })
  return data
}

export async function retryDelivery(deliveryID: number) {
  const { data } = await api.post<{ status: string }>(
    `/api/outbound-webhooks/deliveries/${deliveryID}/retry`,
  )
  return data
}

export async function listWebhookDeliveries(params: {
  webhook_id?: number
  status?: string
  event_type?: string
  limit?: number
  offset?: number
} = {}) {
  const { data } = await api.get<{ deliveries: WebhookDelivery[]; total: number }>(
    '/api/outbound-webhooks/deliveries',
    { params },
  )
  return data
}
