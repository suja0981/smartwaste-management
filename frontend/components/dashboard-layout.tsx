"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"
import { getBins, type Bin } from "@/lib/api-client"
import {
  LayoutDashboard,
  Trash2,
  Brain,
  Users,
  Navigation,
  BarChart3,
  Map,
  LogOut,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Bell,
  Settings,
  ChevronLeft,
  Sun,
  Moon,
  Monitor,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/",            label: "Overview",    adminOnly: false, icon: LayoutDashboard },
  { href: "/bins",        label: "Bins",        adminOnly: false, icon: Trash2 },
  { href: "/map",         label: "Live Map",    adminOnly: false, icon: Map },
  { href: "/predictions", label: "Predictions", adminOnly: false, icon: Brain },
  { href: "/crew",        label: "Crews",       adminOnly: true,  icon: Users },
  { href: "/routes",      label: "Routes",      adminOnly: true,  icon: Navigation },
  { href: "/reports",     label: "Reports",     adminOnly: true,  icon: BarChart3 },
  { href: "/settings",    label: "Settings",    adminOnly: false, icon: Settings },
]

function NavLink({
  href, label, active, icon: Icon, onClick, collapsed,
}: {
  href: string
  label: string
  active: boolean
  icon: React.ElementType
  onClick?: () => void
  collapsed?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        collapsed && "justify-center px-2",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-150", !active && "group-hover:scale-110")} />
      {!collapsed && <span>{label}</span>}
      {!collapsed && active && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
    </Link>
  )
}

function SidebarContent({
  visibleNav,
  pathname,
  onNavClick,
  collapsed,
  onToggleCollapse,
}: {
  visibleNav: typeof NAV_ITEMS
  pathname: string
  onNavClick?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex h-14 items-center border-b px-4 shrink-0", collapsed && "justify-center px-2")}>
        {collapsed ? (
          <button
            onClick={onToggleCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:opacity-90 transition-opacity"
          >
            W
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <Link href="/" onClick={onNavClick} className="flex items-center gap-2.5 font-semibold text-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
                W
              </span>
              <span>Smart Waste</span>
            </Link>
            {onToggleCollapse && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-50 hover:opacity-100" onClick={onToggleCollapse}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto px-3 py-4 space-y-0.5", collapsed && "px-2")}>
        {visibleNav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href}
            onClick={onNavClick}
            collapsed={collapsed}
          />
        ))}
      </nav>

    </div>
  )
}


// ─── Custom portal-free header dropdown ─────────────────────────────────────
// Avoids Radix UI portal issues caused by the header's sticky + backdrop-blur
// stacking context. Uses position:absolute within the header (z-30) which is
// naturally above the main content area (no explicit z-index).
function HeaderDropdown({
  trigger,
  children,
  width = "w-56",
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onOutside)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onOutside)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1 z-50",
            "bg-popover text-popover-foreground border rounded-md shadow-md p-1 min-w-[8rem]",
            width
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function DDLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5">{children}</div>
  )
}

function DDSep() {
  return <div className="my-1 border-t border-border" />
}

function DDItem({
  children,
  onClick,
  asChild,
  href,
  destructive,
  disabled,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  asChild?: boolean
  href?: string
  destructive?: boolean
  disabled?: boolean
  className?: string
}) {
  const base = cn(
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer transition-colors",
    "hover:bg-accent hover:text-accent-foreground",
    destructive && "text-destructive hover:text-destructive",
    disabled && "pointer-events-none opacity-50",
    className
  )
  if (href) {
    return (
      <Link href={href} className={base} onClick={onClick}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={base} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function relativeTime(iso?: string | null): string {
  if (!iso) return ""
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diff < 1) return "just now"
  if (diff < 60) return `${diff}m ago`
  return `${Math.round(diff / 60)}h ago`
}

function NotificationButton() {
  const { data: bins = [], isLoading } = useQuery<Bin[]>({
    queryKey: ["notifications-bins"],
    queryFn: () => getBins(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const critical = bins
    .filter((b) => b.status === "full" || b.status === "warning")
    .sort((a, b) => b.fill_level_percent - a.fill_level_percent)
    .slice(0, 6)

  const unreadCount = critical.length

  return (
    <HeaderDropdown
      width="w-80"
      trigger={
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white pointer-events-none">
              {unreadCount}
            </span>
          )}
        </Button>
      }
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs font-semibold">Notifications</span>
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Updating…" : `${unreadCount} critical`}
        </span>
      </div>
      <DDSep />
      {isLoading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
      ) : critical.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">All bins are operating normally</div>
      ) : (
        critical.map((b) => (
          <div key={b.id} className="flex flex-col gap-0.5 rounded px-2 py-2 hover:bg-accent transition-colors">
            <div className="flex items-start gap-2 w-full">
              <span
                className={cn(
                  "mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                  b.status === "full" ? "bg-red-500" : "bg-yellow-500"
                )}
              />
              <span className="text-xs leading-snug">
                <span className="font-medium">{b.id}</span> at {b.location} —{" "}
                {b.fill_level_percent}% full
              </span>
            </div>
            {b.last_telemetry && (
              <span className="text-[10px] text-muted-foreground ml-3.5">
                {relativeTime(b.last_telemetry)}
              </span>
            )}
          </div>
        ))
      )}
      <DDSep />
      <DDItem href="/bins" className="justify-center text-xs text-primary">
        View all bins
      </DDItem>
    </HeaderDropdown>
  )
}

function HeaderThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return <Button variant="ghost" size="sm" className="h-8 w-8 p-0 invisible" aria-hidden><Sun className="h-4 w-4" /></Button>
  }

  return (
    <HeaderDropdown
      width="w-36"
      trigger={
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" aria-label="Toggle theme">
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      }
    >
      <DDItem onClick={() => setTheme("light")} className={theme === "light" ? "bg-accent" : ""}>
        <Sun className="h-3.5 w-3.5" /> Light
      </DDItem>
      <DDItem onClick={() => setTheme("dark")} className={theme === "dark" ? "bg-accent" : ""}>
        <Moon className="h-3.5 w-3.5" /> Dark
      </DDItem>
      <DDItem onClick={() => setTheme("system")} className={theme === "system" ? "bg-accent" : ""}>
        <Monitor className="h-3.5 w-3.5" /> System
      </DDItem>
    </HeaderDropdown>
  )
}

// User email button in header (desktop top-right)
function HeaderUserButton() {
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

  if (isLoading || !user) return null

  const initials = (user.full_name || user.email)
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <HeaderDropdown
      trigger={
        <Button variant="ghost" size="sm" className="gap-2 h-8 px-2 hover:bg-accent">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
            {initials}
          </span>
          <span className="hidden sm:block text-xs text-muted-foreground max-w-[140px] truncate">
            {user.email}
          </span>
          <ChevronDown className="hidden sm:block h-3 w-3 text-muted-foreground shrink-0 opacity-60" />
        </Button>
      }
    >
      <DDLabel>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{user.full_name || "User"}</span>
          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          {isAdmin && (
            <span className="mt-1.5 w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary">
              Admin
            </span>
          )}
        </div>
      </DDLabel>
      <DDSep />
      <DDItem href="/settings">
        <Settings className="h-3.5 w-3.5" />
        Settings
      </DDItem>
      <DDSep />
      <DDItem destructive disabled={isLoggingOut} onClick={handleLogout}>
        <LogOut className="h-3.5 w-3.5" />
        {isLoggingOut ? "Signing out…" : "Sign out"}
      </DDItem>
    </HeaderDropdown>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isAdmin } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [sidebarOpen])

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col border-r bg-sidebar shrink-0 transition-all duration-300",
          sidebarCollapsed ? "md:w-14" : "md:w-56"
        )}
      >
        <SidebarContent
          visibleNav={visibleNav}
          pathname={pathname}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        />
      </aside>

      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300",
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 w-64 bg-sidebar border-r md:hidden",
          "transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute top-3 right-3">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <SidebarContent
          visibleNav={visibleNav}
          pathname={pathname}
          onNavClick={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top header bar — desktop & mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 backdrop-blur-sm px-4 shrink-0">
          {/* Left: hamburger (mobile) or collapse toggle + page title */}
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            {/* Desktop expand button when collapsed */}
            {sidebarCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hidden md:flex"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            {/* Brand on mobile */}
            <Link href="/" className="flex items-center gap-2 font-semibold text-sm md:hidden">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">W</span>
              Smart Waste
            </Link>
          </div>

          {/* Right: notifications + theme toggle + user */}
          <div className="flex items-center gap-1">
            <NotificationButton />
            <HeaderThemeToggle />
            <div className="hidden md:block">
              <HeaderUserButton />
            </div>
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