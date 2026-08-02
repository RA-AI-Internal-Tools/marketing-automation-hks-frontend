import api from './client'
import type {
  ExecutiveOverview,
  AcquisitionData,
  FunnelData,
  UsersData,
  ProductsData,
  PaymentsData,
  OrdersData,
  RetentionData,
  DataHealthData,
} from './types'

function params(since?: string, until?: string) {
  return { params: { since, until } }
}

export async function fetchExecutiveOverview(since?: string, until?: string): Promise<ExecutiveOverview> {
  const { data } = await api.get('/api/analytics/executive', params(since, until))
  return data
}

export async function fetchAcquisition(since?: string, until?: string): Promise<AcquisitionData> {
  const { data } = await api.get('/api/analytics/acquisition', params(since, until))
  return data
}

export async function fetchFunnel(since?: string, until?: string): Promise<FunnelData> {
  const { data } = await api.get('/api/analytics/funnel', params(since, until))
  return data
}

// Canonical path is /api/analytics/clients. `/api/analytics/users` was a
// legacy alias the backend scheduled for removal after 2026-07-12; it is only
// still answering because that cleanup hasn't shipped yet. Both paths bind to
// the same Go handler (handleAnalyticsUsers — see routes_analytics.go:52-53
// and the delegation at :75), so the response shape is identical and this is a
// pure path swap with no behavioural change.
export async function fetchUsers(since?: string, until?: string): Promise<UsersData> {
  const { data } = await api.get('/api/analytics/clients', params(since, until))
  return data
}

export async function fetchProducts(since?: string, until?: string): Promise<ProductsData> {
  const { data } = await api.get('/api/analytics/products', params(since, until))
  return data
}

export async function fetchPayments(since?: string, until?: string): Promise<PaymentsData> {
  const { data } = await api.get('/api/analytics/payments', params(since, until))
  return data
}

export async function fetchOrders(since?: string, until?: string): Promise<OrdersData> {
  const { data } = await api.get('/api/analytics/orders', params(since, until))
  return data
}

export async function fetchRetention(since?: string, until?: string): Promise<RetentionData> {
  const { data } = await api.get('/api/analytics/retention', params(since, until))
  return data
}

export async function fetchDataHealth(): Promise<DataHealthData> {
  const { data } = await api.get('/api/analytics/data-health')
  return data
}

export async function fetchAttribution(since?: string, until?: string): Promise<any> {
  const { data } = await api.get('/api/analytics/attribution', params(since, until))
  return data
}

export async function fetchChurn(): Promise<any> {
  const { data } = await api.get('/api/analytics/churn')
  return data
}

export async function fetchCohort(since?: string, until?: string): Promise<any> {
  const { data } = await api.get('/api/analytics/cohort', params(since, until))
  return data
}

export async function fetchLTV(since?: string, until?: string): Promise<any> {
  const { data } = await api.get('/api/analytics/ltv', params(since, until))
  return data
}
