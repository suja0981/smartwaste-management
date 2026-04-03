"use client"

/**
 * store/auth-store.ts
 *
 * Zustand-based auth store — replaces the React Context auth system.
 * Same public interface as auth-context so existing consumers need minimal changes.
 *
 * Benefits over Context:
 *  - No re-render cascades: components only re-render when the slice they
 *    subscribe to changes (e.g. just `user`, not the whole context object).
 *  - No Provider wrapping needed — import and use anywhere.
 *  - Devtools-friendly: state is inspectable in Zustand devtools.
 */

import { create } from "zustand"
import {
  clearBrowserPushNotifications,
  onAuthStateChanged,
  firebaseSignOut,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  getFirebaseIdToken,
} from "@/lib/firebase"
import {
  login as apiLogin,
  loginWithFirebase as apiLoginWithFirebase,
  signup as apiSignup,
  logout as apiLogout,
  unregisterDeviceToken,
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

function getCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function cacheUser(user: AuthUser | null) {
  if (typeof window === "undefined") return
  if (user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } else {
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  // Derived — computed from user
  isAuthenticated: boolean
  isAdmin: boolean
  token: string | null
  // Actions
  _setUser: (user: AuthUser | null) => void
  _setLoading: (v: boolean) => void
  updateProfile: (updates: Partial<Pick<AuthUser, "full_name" | "email">>) => void
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithEmail: (email: string, password: string) => Promise<void>
  loginLocal: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  registerWithEmailPassword: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getCachedUser(),
  isLoading: true,
  get isAuthenticated() { return get().user !== null },
  get isAdmin() { return get().user?.role === "admin" },
  get token() { return get().user?.token ?? null },

  _setUser: (user) => {
    cacheUser(user)
    set({ user, isLoading: false })
  },

  _setLoading: (isLoading) => set({ isLoading }),

  updateProfile: (updates) => {
    const current = get().user
    if (!current) return
    const updated = { ...current, ...updates }
    cacheUser(updated)
    set({ user: updated })
  },

  login: async (email, password) => {
    const { clearAll } = _clearSession()
    clearAll()
    const resp = await apiLogin({ email, password })
    const user: AuthUser = {
      uid: String(resp.user.id ?? ""),
      email: resp.user.email,
      full_name: resp.user.full_name,
      role: resp.user.role as "admin" | "user",
      token: resp.access_token,
    }
    if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
    localStorage.setItem(TOKEN_KEY, resp.access_token)
    get()._setUser(user)
  },

  loginLocal: async (email, password) => {
    return get().login(email, password)
  },

  loginWithEmail: async (email, password) => {
    return get().login(email, password)
  },

  loginWithGoogle: async () => {
    const { clearAll } = _clearSession()
    clearAll()
    const fbCred = await signInWithGoogle()
    const idToken = await getFirebaseIdToken(fbCred.user)
    const resp = await apiLoginWithFirebase(idToken)
    const user: AuthUser = {
      uid: fbCred.user.uid,
      email: fbCred.user.email ?? resp.user.email,
      full_name: resp.user.full_name,
      role: resp.user.role as "admin" | "user",
      token: resp.access_token,
    }
    if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
    localStorage.setItem(TOKEN_KEY, resp.access_token)
    get()._setUser(user)
  },

  register: async (email, password, fullName) => {
    const { clearAll } = _clearSession()
    clearAll()
    await registerWithEmail(email, password)
    const fbCred = await signInWithEmail(email, password)
    const idToken = await getFirebaseIdToken(fbCred.user)
    const resp = await apiSignup({ email, password, full_name: fullName })
    const user: AuthUser = {
      uid: String(resp.user.id ?? ""),
      email: resp.user.email,
      full_name: resp.user.full_name,
      role: resp.user.role as "admin" | "user",
      token: resp.access_token,
    }
    if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
    localStorage.setItem(TOKEN_KEY, resp.access_token)
    get()._setUser(user)
  },

  registerWithEmailPassword: async (email, password, fullName) => {
    return get().register(email, password, fullName)
  },

  logout: async () => {
    try {
      const pushToken = localStorage.getItem("swm_push_token")
      if (pushToken) await unregisterDeviceToken(pushToken)
      await clearBrowserPushNotifications()
      await apiLogout()
    } catch {
      // Non-fatal — always clear local state
    }
    try { await firebaseSignOut() } catch { /* ignore */ }
    _clearSession().clearAll()
    get()._setUser(null)
  },
}))

function _clearSession() {
  return {
    clearAll: () => {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
    },
  }
}

/**
 * Initialise Firebase auth listener once at app startup.
 * Call this from a top-level client component (e.g. AuthProvider or layout).
 */
export function initAuthListener() {
  const store = useAuthStore.getState()
  store._setLoading(true)

  const unsub = onAuthStateChanged(async (fbUser) => {
    if (!fbUser) {
      // Firebase has no session — keep backend session if present
      store._setLoading(false)
      return
    }
    // Firebase session active — ensure our store user is in sync
    if (!store.user) {
      store._setLoading(false)
    } else {
      store._setLoading(false)
    }
  })

  return unsub
}
