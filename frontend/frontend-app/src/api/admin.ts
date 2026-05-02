import axios from 'axios'
import type { ProductReview } from './products'
import type { OrderResponse } from './orders'

const API_BASE = 'http://localhost:4000'

export interface AdminUser {
  _id: string
  email: string
  name: string
  role: 'customer' | 'admin'
  isActive: boolean
  orderUserId?: number
  createdAt?: string
}

export interface PromotionRule {
  code: string
  percentOff: number
  minBasketAmount: number
  maxUses?: number | null
  usedCount: number
  active: boolean
  expiresAt?: string | null
}

export interface AdminAuditLog {
  id: string
  createdAt: string
  actor?: { id: string; email?: string; role?: string } | null
  action: string
  target: string
  details?: any
}

function authHeader(token: string | null): Record<string, string> {
  if (!token) throw new Error('Auth required')
  return { Authorization: `Bearer ${token}` }
}

export async function adminListUsers(
  token: string | null,
  params?: { q?: string; skip?: number; limit?: number }
): Promise<AdminUser[]> {
  const query: Record<string, string | number | undefined> = {}
  if (params?.q?.trim()) query.q = params.q.trim()
  if (params?.skip != null) query.skip = params.skip
  if (params?.limit != null) query.limit = params.limit
  const res = await axios.get(`${API_BASE}/api/auth/admin/users`, { headers: authHeader(token), params: query })
  return Array.isArray(res.data) ? res.data : []
}

export async function adminUpdateUser(
  userId: string,
  payload: Partial<Pick<AdminUser, 'role' | 'isActive' | 'name' | 'email'>>,
  token: string | null
): Promise<AdminUser> {
  const res = await axios.patch(`${API_BASE}/api/auth/admin/users/${userId}`, payload, {
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
  })
  return res.data as AdminUser
}

export async function adminDeleteUser(userId: string, token: string | null): Promise<void> {
  await axios.delete(`${API_BASE}/api/auth/admin/users/${userId}`, { headers: authHeader(token) })
}

export async function adminListReviews(
  token: string | null,
  params?: { q?: string; skip?: number; limit?: number }
): Promise<ProductReview[]> {
  const query: Record<string, string | number | undefined> = {}
  if (params?.q?.trim()) query.q = params.q.trim()
  if (params?.skip != null) query.skip = params.skip
  if (params?.limit != null) query.limit = params.limit
  const res = await axios.get(`${API_BASE}/api/products/reviews`, { headers: authHeader(token), params: query })
  return Array.isArray(res.data) ? res.data : []
}

export async function adminDeleteReview(reviewId: number, token: string | null): Promise<void> {
  await axios.delete(`${API_BASE}/api/products/reviews/${reviewId}`, { headers: authHeader(token) })
}

export async function adminUpdateReview(
  productId: number,
  reviewId: number,
  payload: { author_name: string; rating: number; comment?: string | null },
  token: string | null
): Promise<ProductReview> {
  const res = await axios.put(`${API_BASE}/api/products/${productId}/reviews/${reviewId}/admin`, payload, {
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
  })
  return res.data as ProductReview
}

export async function adminListPromotions(token: string | null): Promise<PromotionRule[]> {
  const res = await axios.get(`${API_BASE}/api/orders/promotions`, { headers: authHeader(token) })
  const raw = Array.isArray(res.data) ? res.data : []
  return raw.map((r: any) => ({
    ...r,
    percentOff: Number(r.percentOff || 0),
    minBasketAmount: Number(r.minBasketAmount || 0),
    usedCount: Number(r.usedCount || 0),
  }))
}

export async function adminCreatePromotion(
  payload: {
    code: string
    percentOff: number
    minBasketAmount?: number
    maxUses?: number | null
    active?: boolean
    expiresAt?: string | null
  },
  token: string | null
): Promise<PromotionRule> {
  const res = await axios.post(`${API_BASE}/api/orders/promotions`, payload, {
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
  })
  return res.data as PromotionRule
}

export async function adminTogglePromotion(code: string, token: string | null): Promise<PromotionRule> {
  const res = await axios.patch(`${API_BASE}/api/orders/promotions/${encodeURIComponent(code)}/toggle`, undefined, {
    headers: authHeader(token),
  })
  return res.data as PromotionRule
}

export async function adminDeletePromotion(code: string, token: string | null): Promise<void> {
  await axios.delete(`${API_BASE}/api/orders/promotions/${encodeURIComponent(code)}`, {
    headers: authHeader(token),
  })
}

export async function adminUpdateShipment(
  orderId: number,
  payload: { trackingId: string; status: 'SHIPPED' | 'DELIVERED' },
  token: string | null
): Promise<OrderResponse> {
  const res = await axios.post(`${API_BASE}/api/orders/${orderId}/shipment`, payload, {
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
  })
  return res.data as OrderResponse
}

export async function adminOpsOverview(token: string | null): Promise<any> {
  const res = await axios.get(`${API_BASE}/api/admin/ops/overview`, { headers: authHeader(token) })
  return res.data
}

export async function adminAuditLogs(
  token: string | null,
  params?: { q?: string; skip?: number; limit?: number }
): Promise<AdminAuditLog[]> {
  const query: Record<string, string | number | undefined> = {}
  if (params?.q?.trim()) query.q = params.q.trim()
  if (params?.skip != null) query.skip = params.skip
  if (params?.limit != null) query.limit = params.limit
  const res = await axios.get(`${API_BASE}/api/auth/admin/audit-logs`, {
    headers: authHeader(token),
    params: query,
  })
  return Array.isArray(res.data) ? res.data : []
}
