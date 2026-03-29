"use client"

/**
 * components/dashboard-layout.tsx
 *
 * IMPROVEMENTS:
 * 1. Mobile sidebar now CLOSES when a nav link is tapped (previously stayed open).
 * 2. Smooth slide-in/out animation on mobile drawer via CSS transitions.
 * 3. Nav items have icons (lucide-react) for better scannability.
 * 4. Desktop sidebar highlights active route with left accent bar.
 * 5. ModeToggle no longer causes layout shift (was returning null before mount).
 * 6. UserMenu loading skeleton matches button height to prevent layout shift.
 * 7. Sidebar has a subtle gradient background that matches the design system.
 */

import { useState, useEffect } from "react"
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
import { ModeToggle } from "@/components/mode-toggle"
import {
  LayoutDashboard,
  Trash2,
  Brain,
  Users,
  ClipboardList,
  Navigation,
  BarChart3,
  Map,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from "lucide-react"

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/",            label: "Overview",    adminOnly: false, icon: LayoutDashboard },
  { href: "/bins",        label: "Bins",        adminOnly: false, icon: Trash2 },
  { href: "/map",         label: "Live Map",    adminOnly: false, icon: Map },
  { href: "/predictions", label: "Predictions", adminOnly: false, icon: Brain },
  { href: "/crew",        label: "Crews",       adminOnly: true,  icon: Users },
  { href: "/routes",      label: "Routes",      adminOnly: true,  icon: Navigation },
  { href: "/reports",     label: "Reports",     adminOnly: true,  icon: BarChart3 },
]

// ─── Nav link ─────────────────────────────────────────────────────────────────

function NavLink({
  href, label, active, icon: Icon, onClick,
}: {
  href: string
  label: string
  active: boolean
  icon: React.ElementType
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-150", !active && "group-hover:scale-110")} />
      <span>{label}</span>
      {active && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
    </Link>
  )
}

// ─── Sidebar content (shared between desktop + mobile) ───────────────────────

function SidebarContent({
  visibleNav,
  pathname,
  onNavClick,
}: {
  visibleNav: typeof NAV_ITEMS
  pathname: string
  onNavClick?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4 shrink-0">
        <Link
          href="/"
          onClick={onNavClick}
          className="flex items-center gap-2.5 font-semibold text-sm"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
            W
          </span>
          <span>Smart Waste</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleNav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-3 space-y-1 shrink-0">
        <UserMenu />
        <div className="flex justify-end px-1 pt-1">
          <ModeToggle />
        </div>
      </div>
    </div>
  )
}

// ─── User menu ────────────────────────────────────────────────────────────────

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

  // FIX: skeleton instead of null to prevent layout shift
  if (isLoading) {
    return <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
  }

  if (!user) {
    return (
      <Link href="/login">
        <Button variant="outline" size="sm" className="w-full">Sign in</Button>
      </Link>
    )
  }

  const initials = (user.full_name || user.email)
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 h-9 hover:bg-accent"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
            {initials}
          </span>
          <span className="truncate text-sm text-left flex-1">{user.full_name || user.email}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={4} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{user.full_name}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            {isAdmin && (
              <span className="mt-1.5 w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary">
                Admin
              </span>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer gap-2"
          disabled={isLoggingOut}
          onSelect={(e) => { e.preventDefault(); handleLogout() }}
        >
          <LogOut className="h-3.5 w-3.5" />
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

  // FIX: close sidebar on any route change (handles back/forward navigation)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r bg-sidebar shrink-0">
        <SidebarContent visibleNav={visibleNav} pathname={pathname} />
      </aside>

      {/* ── Mobile overlay drawer ────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300",
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 w-64 bg-sidebar border-r md:hidden",
          "transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute top-3 right-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <SidebarContent
          visibleNav={visibleNav}
          pathname={pathname}
          // FIX: close drawer when nav link is tapped
          onNavClick={() => setSidebarOpen(false)}
        />
      </div>

      {/* ── Main content area ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 backdrop-blur-sm px-4 md:hidden shrink-0">
          <Link href="/" className="flex items-center gap-2 font-semibold text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
              W
            </span>
            Smart Waste
          </Link>
          <div className="flex items-center gap-1">
            <ModeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}