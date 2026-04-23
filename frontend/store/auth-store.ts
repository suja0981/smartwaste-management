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
 *
 * BUG-06 fix: clearAll() is now called AFTER the API call succeeds. Previously
 *   it ran before the await, destroying an existing valid session on any failed
 *   login attempt (wrong password, network error, etc.).
 *
 * BUG-07 fix: initAuthListener now checks localStorage for a JWT when Firebase
 *   reports no session for a local-auth user. If the token is gone (e.g. cleared
 *   by another tab or expired cleanup), user state is properly cleared.
 *
 * BUG-12 fix: logout() now reads the push token key from the exported constant
 *   in firebase.ts instead of a duplicated magic string.
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
  updateFirebaseProfile,
  PUSH_TOKEN_STORAGE_KEY,
} from "@/lib/firebase"
import {
  login as apiLogin,
  loginWithFirebase as apiLoginWithFirebase,
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
  auth_provider: "firebase" | "local"
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
  isAuthenticated: getCachedUser() !== null,
  isAdmin: getCachedUser()?.role === "admin",
  token: getCachedUser()?.token ?? null,

  _setUser: (user) => {
    cacheUser(user)
    set({
      user,
      isLoading: false,
      isAuthenticated: user !== null,
      isAdmin: user?.role === "admin",
      token: user?.token ?? null,
    })
  },

  _setLoading: (isLoading) => set({ isLoading }),

  updateProfile: (updates) => {
    const current = get().user
    if (!current) return
    const updated = { ...current, ...updates }
    cacheUser(updated)
    set({ user: updated })
  },

  // BUG-06 fix: clearAll() moved after the await so a failed login attempt
  // (wrong password, network error) does NOT wipe an existing valid session.
  login: async (email, password) => {
    const resp = await apiLogin({ email, password })
    _clearSession().clearAll()
    const user: AuthUser = {
      uid: String(resp.user.id ?? ""),
      email: resp.user.email,
      full_name: resp.user.full_name,
      role: resp.user.role as "admin" | "user",
      token: resp.access_token,
      auth_provider: "local",
    }
    if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
    localStorage.setItem(TOKEN_KEY, resp.access_token)
    get()._setUser(user)
  },

  loginLocal: async (email, password) => {
    return get().login(email, password)
  },

  // loginWithEmail: Firebase email+password → exchange ID token for backend JWT.
  // This is the primary sign-in path for users created via register().
  loginWithEmail: async (email, password) => {
    const fbCred = await signInWithEmail(email, password)
    const idToken = await getFirebaseIdToken(fbCred.user)
    const resp = await apiLoginWithFirebase(idToken)
    _clearSession().clearAll()
    const user: AuthUser = {
      uid: fbCred.user.uid,
      email: fbCred.user.email ?? resp.user.email,
      full_name: resp.user.full_name,
      role: resp.user.role as "admin" | "user",
      token: resp.access_token,
      auth_provider: "firebase",
    }
    if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
    localStorage.setItem(TOKEN_KEY, resp.access_token)
    get()._setUser(user)
  },

  loginWithGoogle: async () => {
    const fbCred = await signInWithGoogle()
    const idToken = await getFirebaseIdToken(fbCred.user)
    const resp = await apiLoginWithFirebase(idToken)
    _clearSession().clearAll()
    const user: AuthUser = {
      uid: fbCred.user.uid,
      email: fbCred.user.email ?? resp.user.email,
      full_name: resp.user.full_name,
      role: resp.user.role as "admin" | "user",
      token: resp.access_token,
      auth_provider: "firebase",
    }
    if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
    localStorage.setItem(TOKEN_KEY, resp.access_token)
    get()._setUser(user)
  },

  register: async (email, password, fullName) => {
    const fbCred = await registerWithEmail(email, password)
    await updateFirebaseProfile(fbCred.user, fullName)
    const idToken = await getFirebaseIdToken(fbCred.user, true)
    const resp = await apiLoginWithFirebase(idToken)
    _clearSession().clearAll()
    const user: AuthUser = {
      uid: fbCred.user.uid,
      email: fbCred.user.email ?? resp.user.email,
      full_name: resp.user.full_name,
      role: resp.user.role as "admin" | "user",
      token: resp.access_token,
      auth_provider: "firebase",
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
      // Issue 3 fix: clearBrowserPushNotifications() handles FCM deleteToken
      // and localStorage removal, and returns the token string so we can then
      // notify the backend. This serialises the two operations correctly.
      const pushToken = await clearBrowserPushNotifications()
      if (pushToken) await unregisterDeviceToken(pushToken)
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
  // Issue 4 fix: if Firebase env vars are missing, skip the listener entirely
  // so the app falls back to local-auth-only mode instead of hanging on the
  // isLoading spinner (Firebase's onAuthStateChanged never fires on bad config).
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    console.warn(
      "[auth] NEXT_PUBLIC_FIREBASE_API_KEY is not set — Firebase auth disabled. " +
      "Add it to .env.local to enable Google / email sign-in."
    )
    useAuthStore.getState()._setLoading(false)
    return () => {}
  }

  useAuthStore.getState()._setLoading(true)

  const unsub = onAuthStateChanged(async (fbUser) => {
    const store = useAuthStore.getState()
    if (!fbUser) {
      // Firebase has no session. If the current user authenticated via Firebase
      // (e.g. token revoked in Firebase Console or signed out on another device),
      // clear frontend state so protected routes redirect to login.
      // Local-login users have no Firebase session by design — leave them untouched.
      if (store.user?.auth_provider === "firebase") {
        _clearSession().clearAll()
        store._setUser(null)
      } else {
        // BUG-07 fix: verify the local JWT still exists in storage; clear user
        // state if it has been removed (e.g. expired cleanup, other tab logout).
        const token = localStorage.getItem(TOKEN_KEY)
        if (!token) {
          _clearSession().clearAll()
          store._setUser(null)
        } else {
          store._setLoading(false)
        }
      }
      return
    }
    // Firebase session active — re-authenticate with backend if store has no user
    if (!store.user) {
      try {
        const idToken = await getFirebaseIdToken(fbUser)
        const resp = await apiLoginWithFirebase(idToken)
        const user: AuthUser = {
          uid: fbUser.uid,
          email: fbUser.email ?? resp.user.email,
          full_name: resp.user.full_name,
          role: resp.user.role as "admin" | "user",
          token: resp.access_token,
          auth_provider: "firebase",
        }
        if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
        localStorage.setItem(TOKEN_KEY, resp.access_token)
        store._setUser(user)
      } catch {
        // Firebase session present but backend re-auth failed — clear loading
        store._setLoading(false)
      }
    } else {
      // Issue 2 fix: Firebase session active and store already has a user
      // (e.g. page reload). Silently refresh the backend JWT in the background
      // so the in-memory token stays current without blocking the UI.
      // Uses forceRefresh=false so Firebase serves a cached token (no network
      // round-trip unless the Firebase token itself is near expiry).
      store._setLoading(false)
      getFirebaseIdToken(fbUser, false)
        .then((idToken) => apiLoginWithFirebase(idToken))
        .then((resp) => {
          localStorage.setItem(TOKEN_KEY, resp.access_token)
          if (resp.refresh_token) localStorage.setItem(REFRESH_KEY, resp.refresh_token)
          // Update the in-memory user's token field so components reading
          // useAuth().token get a fresh value without a full re-render.
          store.updateProfile({})  // triggers re-cache of session with updated token
          // Directly patch token in localStorage — updateProfile doesn't accept token
          const current = useAuthStore.getState().user
          if (current) {
            const updated = { ...current, token: resp.access_token }
            cacheUser(updated)
            useAuthStore.setState({ user: updated, token: resp.access_token })
          }
        })
        .catch(() => { /* non-fatal: fetchAPI handles 401 reactively */ })
    }
  })

  return unsub
}
