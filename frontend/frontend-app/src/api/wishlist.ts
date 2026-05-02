import axios from 'axios'

const API_BASE = 'http://localhost:4000'

export async function getWishlist(token: string): Promise<number[]> {
  const res = await axios.get<{ wishlistProductIds: number[] }>(`${API_BASE}/api/auth/wishlist`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return Array.isArray(res.data?.wishlistProductIds) ? res.data.wishlistProductIds : []
}

export async function addWishlistItem(token: string, productId: number): Promise<number[]> {
  const res = await axios.post<{ wishlistProductIds: number[] }>(
    `${API_BASE}/api/auth/wishlist/${productId}`,
    undefined,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return Array.isArray(res.data?.wishlistProductIds) ? res.data.wishlistProductIds : []
}

export async function removeWishlistItem(token: string, productId: number): Promise<number[]> {
  const res = await axios.delete<{ wishlistProductIds: number[] }>(`${API_BASE}/api/auth/wishlist/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return Array.isArray(res.data?.wishlistProductIds) ? res.data.wishlistProductIds : []
}

