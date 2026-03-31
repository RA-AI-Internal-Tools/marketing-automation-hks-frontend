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
    revenue: number
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
  event_freshness: { event_type: string; last_seen: string; count_24h: number }[]
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
  sent_rate: number
  delivery_rate: number
  open_rate: number
  click_rate: number
}

export interface VariantPerformance {
  variant_id: string
  template_key: string
  total_sent: number
  delivered: number
  opened: number
  clicked: number
  delivery_rate: number
  open_rate: number
  click_rate: number
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
