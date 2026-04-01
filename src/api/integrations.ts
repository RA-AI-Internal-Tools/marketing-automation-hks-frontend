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
