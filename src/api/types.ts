export interface CampaignDefinition {
  id: number
  slug: string
  name: string
  trigger_event: string
  steps: Step[]
  segment_filter: string
  cancellation_event?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Step {
  delay_minutes: number
  channel: string
  template_key: string
  condition: string
  condition_params?: Record<string, any>
}

export interface CampaignEnrollment {
  id: number
  campaign_definition_id: number
  client_id: number
  company_id?: number
  current_step: number
  status: 'active' | 'completed' | 'cancelled' | 'expired'
  context?: Record<string, any>
  next_step_at?: string
  enrolled_at: string
  completed_at?: string
  created_at: string
  updated_at: string
  definition?: CampaignDefinition
}

export interface CampaignLog {
  id: number
  enrollment_id: number
  client_id: number
  campaign_slug: string
  step_index: number
  channel: string
  provider: string
  status: string
  error_message?: string
  sent_at?: string
  created_at: string
}

export interface ClientConsent {
  id: number
  client_id: number
  channel: string
  opted_in: boolean
  created_at: string
  updated_at: string
}

export interface OverviewStats {
  total_campaigns: number
  active_campaigns: number
  total_enrollments: number
  active_enrollments: number
  completed_enrollments: number
  cancelled_enrollments: number
}

export interface ChannelStats {
  channel: string
  sent: number
  failed: number
  skipped: number
  frequency_capped: number
  no_consent: number
}

export interface CampaignPerformance {
  campaign_slug: string
  total_sent: number
  total_failed: number
  total_skipped: number
  enrollments: number
  completions: number
}

export interface DailyVolume {
  date: string
  sent: number
  failed: number
}

export interface HealthCheck {
  status: string
  checks: {
    postgres: string
    redis: string
    nats: string
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
}

export interface MessageTemplate {
  id: number
  template_key: string
  channel: string
  name: string
  subject?: string
  body: string
  variables?: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TemplateRequest {
  template_key: string
  channel: string
  name: string
  subject?: string | null
  body: string
  variables?: string[]
  is_active: boolean
}

export interface CampaignRequest {
  name: string
  slug?: string
  trigger_event: string
  steps: Step[]
  segment_filter: string
  cancellation_event?: string | null
  is_active: boolean
}
