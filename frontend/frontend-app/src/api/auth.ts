import axios from 'axios'

const API_BASE = 'http://localhost:4000'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  orderUserId?: number
  wishlistProductIds?: number[]
}

export async function registerRequest(data: { name: string; email: string; password: string }) {
  await axios.post(`${API_BASE}/api/auth/register`, data, {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function loginRequest(data: { email: string; password: string }) {
  const res = await axios.post(`${API_BASE}/api/auth/login`, data, {
    headers: { 'Content-Type': 'application/json' },
  })
  return res.data as { token: string; user: AuthUser }
}

export async function fetchMeRequest(token: string) {
  const res = await axios.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data as AuthUser
}

export async function updateProfileRequest(
  token: string,
  data: { name?: string; email?: string }
): Promise<AuthUser> {
  const res = await axios.patch(`${API_BASE}/api/auth/me`, data, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  return res.data as AuthUser
}

