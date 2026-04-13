import api from './client'
import type { MessageTemplate } from './types'

export async function listLibraryTemplates(channel = '') {
  const params: Record<string, string> = { library: 'true' }
  if (channel) params.channel = channel
  const { data } = await api.get<MessageTemplate[]>('/api/templates', { params })
  return data
}

// Clones a library template into an editable user-owned copy.
// Server returns the new MessageTemplate with a freshly-derived key.
export async function cloneFromLibrary(libraryTemplateID: number) {
  const { data } = await api.post<MessageTemplate>(`/api/templates/${libraryTemplateID}/clone-from-library`)
  return data
}
