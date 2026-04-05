import api from './client'
import type { PaginatedResponse, PushAudienceEntry, PushSendRequest, PushSendResponse } from './types'

export async function fetchPushAudience(params: {
  platform?: string
  environment?: string
  active?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<PaginatedResponse<PushAudienceEntry>> {
  const { data } = await api.get('/api/push/audience', { params })
  return data
}

export async function sendPushToAudience(req: PushSendRequest): Promise<PushSendResponse> {
  const { data } = await api.post('/api/push/send', req)
  return data
}
