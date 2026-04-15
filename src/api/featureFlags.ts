import api from './client'

// FeatureFlag mirrors FeatureFlagDTO in internal/api/routes_feature_flags.go.
// Kept hand-typed rather than generated because the backend registry is
// hand-curated and small; churn is manageable.
export interface FeatureFlag {
  key: string
  category: string
  value: string
  default: string
  description: string
  sensitive: boolean
  status: string
}

export interface FeatureFlagsResponse {
  flags: FeatureFlag[]
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const { data } = await api.get<FeatureFlagsResponse>('/api/admin/feature-flags')
  return data.flags
}
