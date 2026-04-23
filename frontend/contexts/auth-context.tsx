"use client"

/**
 * contexts/auth-context.tsx
 *
 * Thin compatibility shim — delegates everything to the Zustand auth store
 * (store/auth-store.ts) so all existing useAuth() consumers continue to work
 * without any changes.
 */

import { useEffect, useRef, type ReactNode } from "react"
import { useAuthStore, initAuthListener } from "@/store/auth-store"

export type { AuthUser } from "@/store/auth-store"

export function AuthProvider({ children }: { children: ReactNode }) {
  // BUG-19 fix removal: The previous useRef guard broke the app in React 18 Strict Mode.
  // Strict Mode unmounts and remounts components but PRESERVES state/refs.
  // The first effect call registered the listener, then the simulated unmount
  // called unsub(), but the simulated remount skipped registration because
  // the ref was already true. This left the app stuck on a loading spinner forever.
  useEffect(() => {
    const unsub = initAuthListener()
    return unsub
  }, [])

  return <>{children}</>
}

/** Drop-in replacement for the old useAuth() hook — reads from Zustand store. */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  const login = useAuthStore((s) => s.login)
  const loginLocal = useAuthStore((s) => s.loginLocal)
  const loginWithEmail = useAuthStore((s) => s.loginWithEmail)
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const register = useAuthStore((s) => s.register)
  const registerWithEmailPassword = useAuthStore((s) => s.registerWithEmailPassword)
  const logout = useAuthStore((s) => s.logout)
  const updateProfile = useAuthStore((s) => s.updateProfile)

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    isAdmin: user?.role === "admin",
    token: user?.token ?? null,
    updateProfile,
    login,
    loginLocal,
    loginWithEmail,
    loginWithGoogle,
    register,
    registerWithEmailPassword,
    logout,
  }
}