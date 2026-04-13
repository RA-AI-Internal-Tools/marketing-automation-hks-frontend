import api from './client'

export interface SubjectLineRequest {
  campaign_name?: string
  audience?: string
  tone?: string
  product_context?: string
  brand_voice?: string
}
export interface SubjectLineResponse {
  variants: string[]
  cached?: boolean
}

export interface JourneySuggestRequest {
  goal: string
  audience?: string
}
export interface SuggestedStep {
  delay_minutes: number
  channel: string
  template_key: string
  condition: string
  rationale: string
}
export interface JourneySuggestResponse {
  steps: SuggestedStep[]
  notes?: string[]
  cached?: boolean
}

// Status probe — cheap introspection so the UI can hide the AI buttons
// before the user clicks and gets a 503.
export async function fetchAIStatus(): Promise<{ enabled: boolean }> {
  const { data } = await api.get<{ enabled: boolean }>('/api/ai/status')
  return data
}

export async function generateSubjectLines(req: SubjectLineRequest): Promise<SubjectLineResponse> {
  const { data } = await api.post<SubjectLineResponse>('/api/ai/subject-lines', req)
  return data
}

export async function suggestJourney(req: JourneySuggestRequest): Promise<JourneySuggestResponse> {
  const { data } = await api.post<JourneySuggestResponse>('/api/ai/journey-suggest', req)
  return data
}
