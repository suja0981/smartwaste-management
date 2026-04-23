'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'

function FullScreenLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <span className="text-lg font-bold text-primary">W</span>
        </span>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !redirecting) {
      setRedirecting(true)
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router, redirecting])

  // Show loader while: still loading auth state, OR redirect is in-flight, OR not yet authenticated
  if (isLoading || redirecting || !isAuthenticated) {
    return <FullScreenLoader />
  }

  return <>{children}</>
}

export function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !redirecting) {
      setRedirecting(true)
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router, redirecting])

  // BUG-09 fix: auto-redirect authenticated non-admin users to home.
  // Previously they were shown a static Access Denied screen with no automatic
  // navigation — they could sit on an admin URL indefinitely.
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin && !redirecting) {
      setRedirecting(true)
      router.replace('/')
    }
  }, [isAdmin, isAuthenticated, isLoading, router, redirecting])

  if (isLoading || redirecting) return <FullScreenLoader />
  if (!isAuthenticated) return <FullScreenLoader />

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-sm p-8 rounded-xl border bg-card shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-destructive font-bold text-xl">!</span>
          </div>
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground text-sm">Admin access is required to view this page.</p>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}