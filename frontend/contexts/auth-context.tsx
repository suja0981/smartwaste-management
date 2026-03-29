"use client"

/**
 * contexts/auth-context.tsx
 *
 * Works with the updated lib/firebase.ts which uses lazy initialization
 * to avoid server-side crashes (firebase/auth is browser-only).
 *
 * Key changes from previous version:
 *  - No longer imports `auth` directly from firebase.ts (that was the
 *    exported module-level getAuth() call that crashed SSR).
 *  - onAuthStateChanged is now imported from firebase.ts as a plain
 *    function wrapper that uses require() internally, keeping it out of
 *    the server's static import graph.
 *  - hasBackendSession ref prevents Firebase from silently re-logging
 *    the user in on every page load when a local session already exists.
 *  - 3-second safety timeout prevents the UI from being blocked forever
 *    if Firebase is misconfigured or slow to respond.
 *  - clearSession() is called synchronously at the top of logout() so
 *    the UI updates immediately — before any async calls complete.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react"
import {
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
  refreshAccessToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const TOKEN_KEY = "swm_token"
const REFRESH_TOKEN_KEY = "swm_refresh_token"
const USER_KEY = "swm_user"

const FIREBASE_TIMEOUT_MS = 3000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BackendUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Tracks whether a valid backend session is already in localStorage.
  // Prevents Firebase from silently re-establishing a session on every page load.
  const hasBackendSession = useRef(false)

  // ── Session helpers ──────────────────────────────────────────────────────

  const persistSession = useCallback(
    (jwt: string, backendUser: BackendUser, refreshToken?: string) => {
      localStorage.setItem(TOKEN_KEY, jwt)
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(backendUser))
      setToken(jwt)
      setUser(backendUser)
      hasBackendSession.current = true
    },
    []
  )

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    hasBackendSession.current = false
  }, [])

  // ── Token refresh ────────────────────────────────────────────────────────

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

  // ── Firebase token → backend session exchange ────────────────────────────

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
    // Restore backend session from localStorage immediately (no loading flicker)
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedUser = localStorage.getItem(USER_KEY)
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
        hasBackendSession.current = true
      } catch {
        clearSession()
      }
    }

    // Safety valve: if Firebase doesn't respond within 3 seconds, unblock UI
    const loadingTimeout = setTimeout(() => setIsLoading(false), FIREBASE_TIMEOUT_MS)

    // onAuthStateChanged from firebase.ts uses require() internally so it
    // never runs during SSR — safe to call here inside useEffect (browser only)
    const unsubscribe = onAuthStateChanged(async (fbUser: FirebaseUser | null) => {
      clearTimeout(loadingTimeout)

      if (fbUser) {
        // Only exchange if there is no existing backend session.
        // Without this check, Firebase re-logs the user in on EVERY page load.
        if (!hasBackendSession.current) {
          try {
            await exchangeFirebaseToken(fbUser)
          } catch {
            // Exchange failed — don't force a session; let the user log in manually
          }
        }
      } else {
        // Firebase says signed out — clear everything
        clearSession()
      }

      setIsLoading(false)
    })

    return () => {
      clearTimeout(loadingTimeout)
      unsubscribe()
    }
  }, [exchangeFirebaseToken, clearSession])

  // ── Public auth actions ───────────────────────────────────────────────────

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
    // Clear local state synchronously first — UI responds immediately on click
    const currentToken = localStorage.getItem(TOKEN_KEY)
    clearSession()

    // Revoke backend JWT server-side (fire-and-forget)
    if (currentToken) {
      fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      }).catch(() => {})
    }

    // Sign Firebase out so onAuthStateChanged fires with null,
    // preventing it from re-establishing the session on the next render
    await firebaseSignOut().catch(() => {})
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