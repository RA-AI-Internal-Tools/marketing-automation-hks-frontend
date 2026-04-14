import api from './client'

/**
 * Hardcoded fallback — mirrors EnrollmentStatus* constants in
 * internal/model/campaign.go. Used when the backend vocabulary
 * endpoint is unavailable (e.g. older API, 404, network failure)
 * so the filter dropdown still renders sensibly.
 */
export const DEFAULT_ENROLLMENT_STATUSES: string[] = [
  'active',
  'waiting',
  'completed',
  'cancelled',
  'expired',
]

/**
 * Fetches the enrollment status vocabulary from the backend so the
 * UI stays in sync when new statuses (e.g. 'paused') are added.
 * Falls back to DEFAULT_ENROLLMENT_STATUSES on any error.
 *
 * TODO(backend): expose GET /api/enrollments/statuses returning
 * { statuses: string[] } — until then this always falls back.
 */
export async function getEnrollmentStatusVocabulary(): Promise<string[]> {
  try {
    const { data } = await api.get('/api/enrollments/statuses')
    if (Array.isArray(data)) return data as string[]
    if (data && Array.isArray(data.statuses)) return data.statuses as string[]
    return DEFAULT_ENROLLMENT_STATUSES
  } catch {
    return DEFAULT_ENROLLMENT_STATUSES
  }
}
