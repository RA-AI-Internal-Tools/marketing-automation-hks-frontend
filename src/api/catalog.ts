import api from './client'

export interface Product {
  id: number
  external_id: string
  name: string
  description?: string
  image_url?: string
  price: number
  currency: string
  category?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductListResponse {
  products: Product[]
  total: number
}

export interface ProductListParams {
  q?: string
  category?: string
  active?: boolean
  limit?: number
  offset?: number
}

export async function listProducts(params: ProductListParams = {}) {
  const { active, ...rest } = params
  const q: Record<string, string | number> = { ...rest }
  if (active !== undefined) q.active = active ? 'true' : 'false'
  const { data } = await api.get<ProductListResponse>('/api/catalog/products', { params: q })
  return data
}

export async function getProduct(id: number) {
  const { data } = await api.get<Product>(`/api/catalog/products/${id}`)
  return data
}

export interface ProductUpsertRequest {
  external_id: string
  name: string
  description?: string
  image_url?: string
  price?: number
  currency?: string
  category?: string
}

export async function upsertProduct(req: ProductUpsertRequest) {
  const { data } = await api.post<Product>('/api/catalog/products', req)
  return data
}

export async function deactivateProduct(id: number) {
  await api.delete(`/api/catalog/products/${id}`)
}

// Recommendations — the existing endpoint (engine.GetRecommendations).
export interface ProductRecommendation {
  product_id: number
  name: string
  image_url?: string
  price: number
  score?: number
}

// --- Cart abandonment feed (backed by /api/cart-activity/*) ---

export interface AbandonedCart {
  client_id: number
  session_id?: string
  cart_total: number
  cart_items?: string  // raw jsonb text; parse on demand
  started_at: string
}

export interface AbandonedCartsResponse {
  within_minutes: number
  abandoned: AbandonedCart[]
  aggregate: { total_count: number; total_value: number; avg_value: number }
}

export async function fetchAbandonedCarts(params: { within_minutes?: number; limit?: number } = {}) {
  const { data } = await api.get<AbandonedCartsResponse>('/api/cart-activity/abandoned', { params })
  return data
}

export interface TopAbandonedProduct {
  product_id: number
  name: string
  image_url?: string
  price: number
  abandon_count: number
}

export async function fetchTopAbandonedProducts(withinHours = 24) {
  const { data } = await api.get<{ within_hours: number; products: TopAbandonedProduct[] }>(
    '/api/cart-activity/top-abandoned-products',
    { params: { within_hours: withinHours } },
  )
  return data
}

export async function fetchRecommendations(clientID: number, limit = 5) {
  const { data } = await api.get<{ client_id: number; recommendations: ProductRecommendation[]; count: number }>(
    `/api/recommendations/${clientID}`,
    { params: { limit } },
  )
  return data
}
