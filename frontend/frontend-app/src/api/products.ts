import axios from 'axios'

const API_BASE = 'http://localhost:4000'

export interface Product {
  id: number
  name: string
  description?: string | null
  category?: string | null
  price: number
  stock: number
  image_url?: string | null
  rating_avg?: number | null
  rating_count?: number
}

export interface ProductFilters {
  q?: string
  category?: string
  min_price?: number
  max_price?: number
  in_stock_only?: boolean
  skip?: number
  limit?: number
  ids?: number[]
}

export interface RecommendationFilters {
  product_id?: number
  wishlist_ids?: number[]
  limit?: number
}

export interface ProductReview {
  id: number
  product_id: number
  author_name: string
  rating: number
  comment?: string | null
  verified_purchase?: boolean
  helpful_votes?: number
  has_voted?: boolean
  created_at: string
}

function getReviewVoterKey(): string {
  if (typeof window === 'undefined') return 'server'
  const existing = window.localStorage.getItem('multishop.reviewVoterKey')
  if (existing && existing.trim()) return existing
  const generated = `voter-${Date.now()}-${Math.random().toString(16).slice(2)}`
  window.localStorage.setItem('multishop.reviewVoterKey', generated)
  return generated
}

export async function fetchCategories(): Promise<string[]> {
  const res = await axios.get<string[]>(`${API_BASE}/api/products/categories`)
  return Array.isArray(res.data) ? res.data : []
}

function normalizeProduct(p: any): Product {
  return {
    ...p,
    price: typeof p.price === 'number' ? p.price : Number(p.price),
    rating_avg: p.rating_avg != null ? Number(p.rating_avg) : null,
    rating_count: p.rating_count != null ? Number(p.rating_count) : 0,
  } as Product
}

export async function fetchProducts(params?: ProductFilters) {
  const query: Record<string, string | number | boolean | undefined> = {}
  if (params?.skip != null) query.skip = params.skip
  if (params?.limit != null) query.limit = params.limit
  if (params?.q?.trim()) query.q = params.q.trim()
  if (params?.category?.trim()) query.category = params.category.trim()
  if (params?.min_price != null) query.min_price = params.min_price
  if (params?.max_price != null) query.max_price = params.max_price
  if (params?.in_stock_only) query.in_stock_only = 'true'
  if (params?.ids?.length) query.ids = params.ids.join(',')
  const res = await axios.get(`${API_BASE}/api/products`, { params: query })
  const raw = res.data as any[]
  return raw.map(normalizeProduct)
}

export async function fetchProduct(id: number): Promise<Product> {
  const res = await axios.get(`${API_BASE}/api/products/${id}`)
  return normalizeProduct(res.data)
}

export async function fetchRecommendations(params?: RecommendationFilters): Promise<Product[]> {
  const query: Record<string, string | number | undefined> = {}
  if (params?.product_id != null) query.product_id = params.product_id
  if (params?.wishlist_ids?.length) query.wishlist_ids = params.wishlist_ids.join(',')
  if (params?.limit != null) query.limit = params.limit
  const res = await axios.get(`${API_BASE}/api/products/recommendations`, { params: query })
  const raw = res.data as any[]
  return raw.map(normalizeProduct)
}

export interface ProductCreatePayload {
  name: string
  description?: string | null
  category?: string | null
  price: number
  stock: number
  image_url?: string | null
}

export interface ProductUpdatePayload {
  name?: string
  description?: string | null
  category?: string | null
  price?: number
  stock?: number
  image_url?: string | null
}

export async function createProduct(payload: ProductCreatePayload, token?: string | null): Promise<Product> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await axios.post(`${API_BASE}/api/products`, payload, { headers })
  return normalizeProduct(res.data)
}

export async function updateProduct(id: number, payload: ProductUpdatePayload, token?: string | null): Promise<Product> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await axios.put(`${API_BASE}/api/products/${id}`, payload, { headers })
  return normalizeProduct(res.data)
}

export async function deleteProduct(id: number, token?: string | null): Promise<void> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  await axios.delete(`${API_BASE}/api/products/${id}`, { headers })
}

export async function fetchProductReviews(
  productId: number,
  params?: { skip?: number; limit?: number; sort?: 'newest' | 'highest' | 'lowest' | 'helpful' }
): Promise<ProductReview[]> {
  const query: Record<string, string | number | undefined> = {}
  if (params?.skip != null) query.skip = params.skip
  if (params?.limit != null) query.limit = params.limit
  if (params?.sort) query.sort = params.sort
  const res = await axios.get(`${API_BASE}/api/products/${productId}/reviews`, {
    params: query,
    headers: { 'x-voter-key': getReviewVoterKey() },
  })
  return Array.isArray(res.data) ? res.data : []
}

export async function fetchProductReviewsMeta(productId: number): Promise<{ totalCount: number }> {
  const res = await axios.get(`${API_BASE}/api/products/${productId}/reviews/meta`)
  return { totalCount: Number((res.data as any)?.totalCount || 0) }
}

export async function createProductReview(
  productId: number,
  payload: { author_name: string; rating: number; comment?: string | null; verified_purchase?: boolean }
): Promise<ProductReview> {
  const res = await axios.post(`${API_BASE}/api/products/${productId}/reviews`, payload, {
    headers: { 'Content-Type': 'application/json' },
  })
  return res.data as ProductReview
}

export async function updateProductReview(
  productId: number,
  reviewId: number,
  payload: { author_name: string; rating: number; comment?: string | null }
): Promise<ProductReview> {
  const res = await axios.put(`${API_BASE}/api/products/${productId}/reviews/${reviewId}`, payload, {
    headers: { 'Content-Type': 'application/json' },
  })
  return res.data as ProductReview
}

export async function deleteProductReview(
  productId: number,
  reviewId: number,
  authorName: string
): Promise<void> {
  await axios.delete(`${API_BASE}/api/products/${productId}/reviews/${reviewId}`, {
    params: { author_name: authorName },
  })
}

export async function markReviewHelpful(productId: number, reviewId: number): Promise<ProductReview> {
  const res = await axios.post(
    `${API_BASE}/api/products/${productId}/reviews/${reviewId}/helpful`,
    undefined,
    { headers: { 'x-voter-key': getReviewVoterKey() } }
  )
  return res.data as ProductReview
}


