"use client"

/**
 * contexts/auth-context.tsx
 *
 * Fixes:
 * 1. Added loginWithEmail, loginLocal, registerWithEmailPassword exports
 *    (login/signup pages call these names specifically)
 * 2. loginLocal uses backend-only auth (no Firebase) for legacy admin accounts
 * 3. registerWithEmailPassword is an alias for register
 * 4. All methods clear previous session before starting
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import {
  onAuthStateChanged,
  firebaseSignOut,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  getFirebaseIdToken,
  type User,
} from "@/lib/firebase"
import {
  login as apiLogin,
  signup as apiSignup,
  logout as apiLogout,
} from "@/lib/api-client"

const SESSION_KEY = "swm_session_user"
const TOKEN_KEY = "swm_token"
const REFRESH_KEY = "swm_refresh_token"

export interface AuthUser {
  uid: string
  email: string
  full_name: string
  role: "admin" | "user"
  token: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  token: string | null
  // Core methods
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithEmail: (email: string, password: string) => Promise<void>
  loginLocal: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  registerWithEmailPassword: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getCachedUser)
  const [isLoading, setIsLoading] = useState(true)

  const persist = useCallback((u: AuthUser | null) => {
    setUser(u)
    if (typeof window === "undefined") return
    if (u) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
      localStorage.setItem(TOKEN_KEY, u.token)
    } else {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem("swm_user")
    }
  }, [])

  // Sync with Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(async (firebaseUser: User | null) => {
      if (!firebaseUser) {
        // Only clear if we don't have a local-login session already
        const cached = getCachedUser()
        if (!cached) {
          persist(null)
        }
        setIsLoading(false)
        return
      }
      try {
        const token = await getFirebaseIdToken(firebaseUser, false)
        const idTokenResult = await firebaseUser.getIdTokenResult()
        const role = (idTokenResult.claims.role as "admin" | "user") ?? "user"
        persist({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? "",
          full_name: firebaseUser.displayName ?? firebaseUser.email ?? "",
          role,
          token,
        })
      } catch {
        persist(null)
      } finally {
        setIsLoading(false)
      }
    })
    return unsub
  }, [persist])

  /** Standard backend + Firebase login */
  const login = useCallback(async (email: string, password: string) => {
    await firebaseSignOut().catch(() => {})
    persist(null)
    try {
      const resp = await apiLogin({ email, password })
      await signInWithEmail(email, password).catch(() => {
        // Firebase sign-in optional — backend JWT is the source of truth
      })
      if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
      persist({
        uid: String(resp.user.id),
        email: resp.user.email,
        full_name: resp.user.full_name,
        role: resp.user.role,
        token: resp.access_token,
      })
    } catch (err) {
      await firebaseSignOut().catch(() => {})
      persist(null)
      throw err
    }
  }, [persist])

  /** Alias — login page calls loginWithEmail */
  const loginWithEmail = login

  /** Legacy local login — backend only, no Firebase */
  const loginLocal = useCallback(async (email: string, password: string) => {
    await firebaseSignOut().catch(() => {})
    persist(null)
    try {
      const resp = await apiLogin({ email, password })
      if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
      persist({
        uid: String(resp.user.id),
        email: resp.user.email,
        full_name: resp.user.full_name,
        role: resp.user.role,
        token: resp.access_token,
      })
    } catch (err) {
      persist(null)
      throw err
    }
  }, [persist])

  const loginWithGoogle = useCallback(async () => {
    await firebaseSignOut().catch(() => {})
    persist(null)
    const result = await signInWithGoogle()
    const token = await getFirebaseIdToken(result.user, true)
    const claims = (await result.user.getIdTokenResult()).claims
    persist({
      uid: result.user.uid,
      email: result.user.email ?? "",
      full_name: result.user.displayName ?? result.user.email ?? "",
      role: (claims.role as "admin" | "user") ?? "user",
      token,
    })
  }, [persist])

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    await firebaseSignOut().catch(() => {})
    persist(null)
    const resp = await apiSignup({ email, password, full_name: fullName })
    await registerWithEmail(email, password).catch(() => {})
    if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
    persist({
      uid: String(resp.user.id),
      email: resp.user.email,
      full_name: resp.user.full_name,
      role: resp.user.role,
      token: resp.access_token,
    })
  }, [persist])

  /** Alias — signup page calls registerWithEmailPassword */
  const registerWithEmailPassword = register

  const logout = useCallback(async () => {
    await apiLogout().catch(() => {})
    await firebaseSignOut().catch(() => {})
    persist(null)
  }, [persist])

  const token = user?.token ?? null

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin",
      token,
      login,
      loginWithEmail,
      loginLocal,
      loginWithGoogle,
      register,
      registerWithEmailPassword,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}