import { createContext, useContext, useEffect, useState } from 'react'
import type { AuthUser } from '../api/auth'
import { fetchMeRequest, loginRequest, registerRequest, updateProfileRequest } from '../api/auth'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'))
  const [loading, setLoading] = useState<boolean>(!!token)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMeRequest(token)
        if (!cancelled) {
          setUser(me)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setToken(null)
          localStorage.removeItem('auth_token')
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  async function login(email: string, password: string) {
    setError(null)
    const { token: t, user: u } = await loginRequest({ email, password })
    setToken(t)
    localStorage.setItem('auth_token', t)
    setUser(u)
  }

  async function register(name: string, email: string, password: string) {
    setError(null)
    await registerRequest({ name, email, password })
    await login(email, password)
  }

  async function updateProfile(data: { name?: string; email?: string }) {
    if (!token) return
    const updated = await updateProfileRequest(token, data)
    setUser(updated)
  }

  function logout() {
    setUser(null)
    setToken(null)
    localStorage.removeItem('auth_token')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

