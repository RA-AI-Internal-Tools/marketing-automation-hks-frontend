import api from './client'

export interface JourneyTouchpoint {
  type:      'campaign_step' | 'tracardi_event' | string
  timestamp: string
  details:   Record<string, unknown>
}

export interface ClientJourneyResponse {
  client_id: number
  count:     number
  touchpoints: JourneyTouchpoint[]
}

export async function fetchClientJourney(clientID: number, limit = 100) {
  const { data } = await api.get<ClientJourneyResponse>(
    `/api/clients/${clientID}/journey`,
    { params: { limit } },
  )
  return data
}
