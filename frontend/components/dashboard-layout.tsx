"use client"

/**
 * components/dashboard-layout.tsx
 *
 * Sidebar + topbar shell for all dashboard pages.
 *
 * The logout button was not visible because:
 *   - isLoading stayed true while Firebase was initializing, so the
 *     user menu was conditionally hidden during that window.
 *   - In some builds, the user object was null during SSR hydration,
 *     causing the button to be skipped entirely.
 *
 * Fix: the user menu is always rendered once isLoading is false.
 * It shows a skeleton while loading, the user name + logout when
 * authenticated, and a login link if somehow unauthenticated.
 */

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/",            label: "Overview",     adminOnly: false },
  { href: "/bins",        label: "Bins",         adminOnly: false },
  { href: "/predictions", label: "Predictions",  adminOnly: false },
  { href: "/crew",        label: "Crews",        adminOnly: true  },
  { href: "/tasks",       label: "Tasks",        adminOnly: true  },
  { href: "/routes",      label: "Routes",       adminOnly: true  },
  { href: "/reports",     label: "Reports",      adminOnly: true  },
]

// ─── Sidebar nav link ─────────────────────────────────────────────────────────

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {label}
    </Link>
  )
}

// ─── User menu (the logout button lives here) ─────────────────────────────────

function UserMenu() {
  const { user, isLoading, isAdmin, logout } = useAuth()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      router.push("/login")
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Show a placeholder while Firebase is initializing.
  // This is the key fix — previously this returned null which made the
  // button disappear entirely if isLoading was still true.
  if (isLoading) {
    return (
      <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
    )
  }

  // Unauthenticated — shouldn't reach here via ProtectedRoute, but safe fallback
  if (!user) {
    return (
      <Link href="/login">
        <Button variant="outline" size="sm">Sign in</Button>
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 max-w-[200px]">
          {/* Avatar initial */}
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {user.full_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
          </span>
          <span className="truncate text-sm">{user.full_name || user.email}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{user.full_name}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            {isAdmin && (
              <span className="mt-1 w-fit rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                Admin
              </span>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/profile">Profile settings</Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* THE LOGOUT BUTTON */}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          disabled={isLoggingOut}
          onSelect={(e) => {
            e.preventDefault()
            handleLogout()
          }}
        >
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Main layout ─────────────────────────────────────────────────────────────

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isAdmin } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar (desktop) ───────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r bg-card">
        {/* Logo */}
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
              W
            </span>
            Smart Waste
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={pathname === item.href}
            />
          ))}
        </nav>

        {/* User menu at bottom of sidebar */}
        <div className="border-t p-3">
          <UserMenu />
        </div>
      </aside>

      {/* ── Mobile header ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/80 backdrop-blur px-4 md:hidden">
          <Link href="/" className="font-semibold text-sm">Smart Waste</Link>
          <div className="flex items-center gap-2">
            <UserMenu />
            <button
              className="rounded-md p-1.5 hover:bg-accent"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Mobile nav drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="absolute inset-0 bg-black/50" />
            <nav
              className="absolute left-0 top-0 bottom-0 w-64 bg-card p-4 space-y-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 font-semibold text-sm">Smart Waste</div>
              {visibleNav.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={pathname === item.href}
                />
              ))}
            </nav>
          </div>
        )}

        {/* ── Page content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}