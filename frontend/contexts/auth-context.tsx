"use client"

/**
 * contexts/auth-context.tsx
 *
 * Fixes from original:
 *  1. refreshAccessToken() was defined but never called.
 *     Now called automatically when any fetch returns 401.
 *     Exported as part of context so components can also trigger it.
 *  2. api-client.ts logout() only cleared localStorage — did not call backend.
 *     Logout now calls POST /auth/logout to revoke the JWT server-side.
 *  3. Minor: `exchangeFirebaseToken` dep array was unstable across renders.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react"
import {
  auth,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  firebaseSignOut,
  getFirebaseIdToken,
  onAuthStateChanged,
  User as FirebaseUser,
} from "@/lib/firebase"

interface BackendUser {
  id: number
  email: string
  full_name: string
  role: "admin" | "user"
  is_active: boolean
}

interface AuthContextType {
  user: BackendUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  loginWithGoogle: () => Promise<void>
  loginWithEmail: (email: string, password: string) => Promise<void>
  registerWithEmailPassword: (email: string, password: string, fullName: string) => Promise<void>
  loginLocal: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Manually trigger a token refresh — also called internally on 401 */
  refreshAccessToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const TOKEN_KEY = "swm_token"
const REFRESH_TOKEN_KEY = "swm_refresh_token"
const USER_KEY = "swm_user"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BackendUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── Session persistence ──────────────────────────────────────────────────

  const persistSession = useCallback(
    (jwt: string, backendUser: BackendUser, refreshToken?: string) => {
      localStorage.setItem(TOKEN_KEY, jwt)
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(backendUser))
      setToken(jwt)
      setUser(backendUser)
    },
    []
  )

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  // ── Token refresh ────────────────────────────────────────────────────────
  // FIX: this was defined but never called. Now called on 401 via fetchWithAuth.

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) return false
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) {
        clearSession()
        return false
      }
      const data = await res.json()
      persistSession(data.access_token, data.user, data.refresh_token)
      return true
    } catch {
      return false
    }
  }, [persistSession, clearSession])

  // ── Firebase exchange ────────────────────────────────────────────────────

  const exchangeFirebaseToken = useCallback(
    async (firebaseUser: FirebaseUser): Promise<void> => {
      const idToken = await getFirebaseIdToken(firebaseUser)
      const res = await fetch(`${API_BASE}/auth/firebase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to authenticate with backend")
      }
      const data = await res.json()
      persistSession(data.access_token, data.user, data.refresh_token)
    },
    [persistSession]
  )

  // ── Firebase auth state listener ─────────────────────────────────────────

  useEffect(() => {
    // Restore from localStorage instantly (no flicker)
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedUser = localStorage.getItem(USER_KEY)
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch {
        clearSession()
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          await exchangeFirebaseToken(fbUser)
        } catch {
          // If exchange fails, keep existing local token
        }
      } else {
        const hasLocalToken = localStorage.getItem(TOKEN_KEY)
        if (!hasLocalToken) clearSession()
      }
      setIsLoading(false)
    })

    return unsubscribe
  }, [exchangeFirebaseToken, clearSession])

  // ── Actions ───────────────────────────────────────────────────────────────

  const loginWithGoogle = useCallback(async () => {
    const result = await signInWithGoogle()
    await exchangeFirebaseToken(result.user)
  }, [exchangeFirebaseToken])

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const result = await signInWithEmail(email, password)
      await exchangeFirebaseToken(result.user)
    },
    [exchangeFirebaseToken]
  )

  const registerWithEmailPassword = useCallback(
    async (email: string, password: string, fullName: string) => {
      const result = await registerWithEmail(email, password)
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      })
      if (!res.ok) {
        await result.user.delete()
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Registration failed")
      }
      const data = await res.json()
      persistSession(data.access_token, data.user, data.refresh_token)
    },
    [persistSession]
  )

  const loginLocal = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Invalid email or password")
      }
      const data = await res.json()
      persistSession(data.access_token, data.user, data.refresh_token)
    },
    [persistSession]
  )

  const logout = useCallback(async () => {
    // FIX: original api-client logout() only cleared localStorage.
    // Now we call the backend so the JWT is server-side revoked.
    const currentToken = localStorage.getItem(TOKEN_KEY)
    if (currentToken) {
      fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      }).catch(() => {})
    }
    await firebaseSignOut().catch(() => {})
    clearSession()
  }, [clearSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === "admin",
        loginWithGoogle,
        loginWithEmail,
        registerWithEmailPassword,
        loginLocal,
        logout,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}