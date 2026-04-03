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

export interface StepVariant {
  id: string
  template_key: string
  channel?: string
  weight: number
}

export interface Step {
  delay_minutes: number
  channel: string
  template_key: string
  condition: string
  condition_params?: Record<string, any>
  variants?: StepVariant[]
  true_next?: number | null
  false_next?: number | null
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
  checks: Record<string, string>
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

export interface EmailTemplateRequest extends TemplateRequest {
  preheader?: string | null
  html_body?: string | null
  text_body?: string | null
  from_name?: string | null
  from_email?: string | null
  reply_to?: string | null
  category?: string | null
  language?: string | null
  tags?: string[]
  sample_payload?: Record<string, any> | null
  editor_mode?: 'code' | 'visual'
}

export interface TemplateVariable {
  name: string
  label: string
  token: string
  description: string
  sampleValue: string
  category: string
  required: boolean
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

// Analytics types

export interface ExecutiveOverview {
  revenue: number
  revenue_delta: number
  traffic: number
  traffic_delta: number
  conversion_rate: number
  conversion_rate_delta: number
  active_users: number
  active_users_delta: number
  total_orders: number
  total_orders_delta: number
  total_campaigns_active: number
  daily_revenue: { date: string; revenue: number }[]
  daily_traffic: { date: string; count: number }[]
}

export interface AcquisitionData {
  sources: { source: string; count: number; percentage: number }[]
  utm_campaigns: { campaign: string; count: number; conversions: number }[]
  new_users: number
  returning_users: number
  signup_rate: number
  daily_signups: { date: string; count: number }[]
}

export interface FunnelStage {
  name: string
  event_type: string
  count: number
  conversion_rate: number
  drop_off_rate: number
}

export interface FunnelData {
  stages: FunnelStage[]
  overall_conversion: number
}

export interface UsersData {
  dau: number
  wau: number
  mau: number
  top_events: { event_type: string; count: number }[]
  geo_distribution: { country: string; count: number }[]
  language_distribution: { language: string; count: number }[]
}

export interface ProductsData {
  products: {
    product_id: string
    name: string
    views: number
    add_to_cart: number
    purchases: number
    cart_rate: number
    conversion_rate: number
    revenue?: number
  }[]
}

export interface PaymentsData {
  methods: { method: string; count: number; percentage: number }[]
  approval_rate: number
  decline_rate: number
  failure_reasons: { reason: string; count: number }[]
  daily_approvals: { date: string; approved: number; declined: number }[]
}

export interface OrdersData {
  aov: number
  aov_delta: number
  total_revenue: number
  total_revenue_delta: number
  total_orders: number
  total_orders_delta: number
  revenue_trend: { date: string; revenue: number }[]
  order_status: { status: string; count: number }[]
}

export interface RetentionData {
  cohorts: {
    cohort: string
    total: number
    periods: number[]
  }[]
  campaign_conversions: {
    campaign_slug: string
    enrollments: number
    conversions: number
    conversion_rate: number
  }[]
  consent_stats: {
    channel: string
    opted_in: number
    opted_out: number
    rate: number
  }[]
}

export interface DataHealthData {
  services: { name: string; status: string }[]
  event_freshness: { event_type: string; last_seen: string; count_24h: number; avg_7d?: number }[]
  volume_anomalies: { event_type: string; current: number; average: number; deviation: number }[]
  table_stats: { table: string; row_count: number }[]
}

// User management types

export interface User {
  id: number
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  is_active: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface UserRequest {
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  password?: string
  is_active: boolean
}

// Campaign Funnel & A/B Variant types

export interface CampaignFunnelStats {
  campaign_slug: string
  enrolled: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  completed: number
  cancelled: number
}

export interface VariantPerformance {
  variant_id: string
  sent: number
  delivered: number
  opened: number
  clicked: number
}

export interface AuditLog {
  id: number
  user_id: number
  user_email: string
  action: string
  resource: string
  resource_id?: number
  detail?: Record<string, any>
  ip_address?: string
  created_at: string
}

// Integration types

export type ProviderType = 'email' | 'sms' | 'push' | 'webhook' | 'crm' | 'analytics' | 'infrastructure'
export type IntegrationStatus = 'connected' | 'degraded' | 'not_configured' | 'error' | 'disabled'

export interface Integration {
  id: number
  name: string
  provider_type: ProviderType
  environment: 'sandbox' | 'production'
  status: IntegrationStatus
  config: Record<string, any>
  endpoint_url?: string
  api_key_configured: boolean
  last_tested_at?: string
  last_test_success?: boolean
  updated_at: string
  created_at: string
}

export interface IntegrationRequest {
  name: string
  provider_type: ProviderType
  endpoint_url?: string
  api_key?: string
  config?: Record<string, any>
  status?: IntegrationStatus
}

// Report types

export interface ReportSchedule {
  id: number
  name: string
  schedule: 'daily' | 'weekly' | 'monthly'
  modules: string[]
  recipients: string[]
  format: 'email' | 'pdf'
  is_active: boolean
  last_run_at?: string
  next_run_at?: string
  created_at: string
  updated_at: string
}
