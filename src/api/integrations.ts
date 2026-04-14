import api from './client'
import type { Integration, IntegrationRequest } from './types'

export async function fetchIntegrations(): Promise<Integration[]> {
  const { data } = await api.get('/api/integrations')
  return data
}

export async function fetchIntegration(id: number): Promise<Integration> {
  const { data } = await api.get(`/api/integrations/${id}`)
  return data
}

export async function createIntegration(req: IntegrationRequest): Promise<Integration> {
  const { data } = await api.post('/api/integrations', req)
  return data
}

export async function updateIntegration(id: number, req: IntegrationRequest): Promise<Integration> {
  const { data } = await api.put(`/api/integrations/${id}`, req)
  return data
}

export async function deleteIntegration(id: number): Promise<void> {
  await api.delete(`/api/integrations/${id}`)
}

export async function testIntegrationConnection(id: number): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post(`/api/integrations/${id}/test`)
  return data
}

// --- Encrypted credential storage (admin only) -----------------------------
// Separate from the read-only /api/integrations catalog above. The backend
// never returns credential values — only metadata (provider/env/key_name +
// audit info). The UI must therefore render a form from a static key-name
// schema (see integrationKeys.ts) rather than from server data.

export type Environment = 'sandbox' | 'production'

export interface CredentialRow {
  provider: string
  environment: Environment
  key_name: string
  updated_at: string
  rotated_by: number | null
  /** Where the credential lives: db = DB-stored + encrypted; env = legacy marketing.env var. Both are "configured". */
  source?: 'db' | 'env'
  has_value?: boolean
}

export async function listCredentials(environment?: Environment): Promise<CredentialRow[]> {
  const url = environment
    ? `/api/integrations/credentials?environment=${encodeURIComponent(environment)}`
    : '/api/integrations/credentials'
  const { data } = await api.get(url)
  // Backend returns the array directly. Accept legacy { credentials: [] }
  // shape as well for forward-compat.
  if (Array.isArray(data)) return data
  return data?.credentials ?? []
}

export async function upsertCredential(req: {
  provider: string
  environment: Environment
  key_name: string
  value: string
}): Promise<void> {
  await api.post('/api/integrations/credentials', req)
}

export async function deleteCredential(req: {
  provider: string
  environment: Environment
  key_name: string
}): Promise<void> {
  await api.delete('/api/integrations/credentials', { data: req })
}

export async function testIntegration(
  provider: string,
  environment: Environment,
): Promise<{ status: string; detail: string }> {
  // NB: route is /credentials/:provider/test because the legacy
  // /integrations/:id/test endpoint (numeric id) occupies the sibling slot —
  // gin can't overload a path param at the same segment.
  const { data } = await api.post(`/api/integrations/credentials/${provider}/test`, { environment })
  return data
}
