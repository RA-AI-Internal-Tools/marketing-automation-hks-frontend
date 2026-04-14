import api from './client'

// Channel vocabulary is owned by the backend so new delivery surfaces
// (e.g. 'line', 'telegram') can be added without a frontend redeploy.
// Callers are expected to keep a hardcoded fallback for first paint /
// transient failures.
export async function getChannelVocabulary(): Promise<string[]> {
  const { data } = await api.get('/api/channels/vocabulary')
  return data.channels
}
