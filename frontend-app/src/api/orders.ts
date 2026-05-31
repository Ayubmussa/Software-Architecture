import axios from 'axios'
import type { CartItem } from '../hooks/useCart'
import type { PaginatedResult } from './products'

const API_BASE = 'http://localhost:4000'

function totalCountHeader(headerValue: unknown, fallback: number): number {
  if (typeof headerValue === 'string' && headerValue.trim()) {
    const parsed = Number(headerValue)
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed
  }
  return fallback
}

export interface OrderItemResponse {
  id: number
  productId: number
  quantity: number
  unitPrice: number
  category?: string | null
}

export interface OrderResponse {
  id: number
  userId: number
  totalAmount: number
  discountAmount?: number
  couponCode?: string | null
  paymentStatus?: 'NOT_REQUIRED' | 'REQUIRES_PAYMENT' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
  paymentReference?: string | null
  paidAt?: string | null
  shippingAddress?: string | null
  shipmentTrackingId?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
  status: string
  createdAt: string
  items: OrderItemResponse[]
}

export interface PaymentIntentResponse {
  paymentReference: string
  clientSecret: string
  paymentStatus: 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REQUIRES_PAYMENT' | 'NOT_REQUIRED'
}

export async function createOrder(
  userId: number,
  items: CartItem[],
  token?: string | null,
  couponCode?: string | null,
  shippingAddress?: string | null
): Promise<OrderResponse> {
  const payload = {
    userId,
    items: items.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.product.price,
      category: i.product.category ?? null,
    })),
    ...(couponCode?.trim() ? { couponCode: couponCode.trim() } : {}),
    ...(shippingAddress?.trim() ? { shippingAddress: shippingAddress.trim() } : {}),
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await axios.post(`${API_BASE}/api/orders`, payload, { headers })
  const o = res.data as any
  return {
    ...o,
    totalAmount: typeof o.totalAmount === 'number' ? o.totalAmount : Number(o.totalAmount),
    discountAmount: typeof o.discountAmount === 'number' ? o.discountAmount : Number(o.discountAmount || 0),
    items: (o.items || []).map((it: any) => ({
      ...it,
      unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : Number(it.unitPrice),
    })),
  }
}

export async function getOrdersForUser(userId: number, token?: string | null): Promise<OrderResponse[]> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await axios.get<OrderResponse[]>(`${API_BASE}/api/orders/user/${userId}`, { headers })
  const raw = res.data as any[]
  return raw.map((o) => ({
    ...o,
    totalAmount: typeof o.totalAmount === 'number' ? o.totalAmount : Number(o.totalAmount),
    discountAmount: typeof o.discountAmount === 'number' ? o.discountAmount : Number(o.discountAmount || 0),
    items: (o.items || []).map((it: any) => ({
      ...it,
      unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : Number(it.unitPrice),
    })),
  }))
}

function normalizeOrder(o: any): OrderResponse {
  return {
    ...o,
    totalAmount: typeof o.totalAmount === 'number' ? o.totalAmount : Number(o.totalAmount),
    discountAmount: typeof o.discountAmount === 'number' ? o.discountAmount : Number(o.discountAmount || 0),
    items: (o.items || []).map((it: any) => ({
      ...it,
      unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : Number(it.unitPrice),
    })),
  }
}

export async function getAllOrders(
  token: string | null,
  params?: { skip?: number; limit?: number }
): Promise<PaginatedResult<OrderResponse>> {
  if (!token) throw new Error('Auth required')
  const query: Record<string, number> = {}
  if (params?.skip != null) query.skip = params.skip
  if (params?.limit != null) query.limit = params.limit
  const res = await axios.get<OrderResponse[]>(`${API_BASE}/api/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    params: query,
  })
  const raw = res.data as any[]
  const items = raw.map(normalizeOrder)
  return { items, total: totalCountHeader(res.headers?.['x-total-count'], items.length) }
}

export async function createPaymentIntent(orderId: number, token: string | null): Promise<PaymentIntentResponse> {
  if (!token) throw new Error('Auth required')
  const res = await axios.post<PaymentIntentResponse>(
    `${API_BASE}/api/orders/${orderId}/payment-intent`,
    undefined,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return res.data
}

export async function confirmPayment(
  orderId: number,
  paymentReference: string,
  token: string | null
): Promise<OrderResponse> {
  if (!token) throw new Error('Auth required')
  const res = await axios.post<OrderResponse>(
    `${API_BASE}/api/orders/${orderId}/payment-webhook`,
    { paymentReference, status: 'succeeded' },
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  )
  const o = res.data as any
  return {
    ...o,
    totalAmount: typeof o.totalAmount === 'number' ? o.totalAmount : Number(o.totalAmount),
    discountAmount: typeof o.discountAmount === 'number' ? o.discountAmount : Number(o.discountAmount || 0),
    items: (o.items || []).map((it: any) => ({
      ...it,
      unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : Number(it.unitPrice),
    })),
  }
}

export async function updateOrderStatus(
  orderId: number,
  status: string,
  token: string | null
): Promise<OrderResponse> {
  if (!token) throw new Error('Auth required')
  const res = await axios.patch<OrderResponse>(
    `${API_BASE}/api/orders/${orderId}`,
    { status },
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  )
  const o = res.data as any
  return {
    ...o,
    totalAmount: typeof o.totalAmount === 'number' ? o.totalAmount : Number(o.totalAmount),
    discountAmount: typeof o.discountAmount === 'number' ? o.discountAmount : Number(o.discountAmount || 0),
    items: (o.items || []).map((it: any) => ({
      ...it,
      unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : Number(it.unitPrice),
    })),
  }
}

