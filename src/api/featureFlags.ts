import api from './client'

// FeatureFlag mirrors FeatureFlagDTO in internal/api/routes_feature_flags.go.
// Kept hand-typed rather than generated because the backend registry is
// hand-curated and small; churn is manageable.
//
// editable/scope/source drive the inline edit controls in SettingsPage:
//   - editable=false → rendered read-only (no input)
//   - scope="boot"   → "Requires restart" amber chip next to the input
//   - source="override" → "Source: override" blue badge + Reset button
export interface FeatureFlag {
  key: string
  category: string
  value: string
  default: string
  description: string
  sensitive: boolean
  status: string
  editable: boolean
  scope: 'runtime' | 'boot' | 'immutable'
  source: 'override' | 'env' | 'default'
  allowed_values?: string[]
  overridden_at?: string
  overridden_by?: number
}

export interface FeatureFlagsResponse {
  flags: FeatureFlag[]
}

export interface SetFeatureFlagResponse {
  flag: FeatureFlag
  requires_restart: boolean
  note?: string
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const { data } = await api.get<FeatureFlagsResponse>('/api/admin/feature-flags')
  return data.flags
}

export async function setFeatureFlag(key: string, value: string): Promise<SetFeatureFlagResponse> {
  const { data } = await api.patch<SetFeatureFlagResponse>(
    `/api/admin/feature-flags/${encodeURIComponent(key)}`,
    { value },
  )
  return data
}

export async function resetFeatureFlag(key: string): Promise<SetFeatureFlagResponse> {
  const { data } = await api.delete<SetFeatureFlagResponse>(
    `/api/admin/feature-flags/${encodeURIComponent(key)}`,
  )
  return data
}
