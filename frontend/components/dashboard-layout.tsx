"use client"

/**
 * components/dashboard-layout.tsx
 *
 * Changes:
 *  1. Navigation is role-filtered — regular users don't see admin-only pages.
 *  2. Sidebar items are grouped (Operations / Analytics / other).
 *  3. Removed the /alerts route from nav (dead page → now redirects to /).
 *  4. Header title is cleaner (smaller, no giant gradient hero — that's the page's job).
 *  5. Notification bell opens a real panel (stub for Phase 3 alertQueue integration).
 *  6. Profile dropdown shows role badge, links Profile/Settings/Logout.
 *  7. ThemeProvider already sets attribute="class" so ModeToggle works correctly.
 */

import type React from "react"
import { useState, memo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell, Menu, Settings, User, Trash2, BarChart3, Users,
  MapPin, Home, Brain, Route, LogOut, Shield, ChevronDown,
  X, Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ModeToggle } from "@/components/mode-toggle"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"

// ─── Navigation config ────────────────────────────────────────────────────────

type NavItem = { name: string; href: string; icon: React.ElementType; adminOnly?: boolean }

const NAV_OPERATIONS: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Bins", href: "/bins", icon: Trash2 },
  { name: "Crew", href: "/crew", icon: Users, adminOnly: true },
  { name: "Routes", href: "/routes", icon: Route, adminOnly: true },
]

const NAV_ANALYTICS: NavItem[] = [
  { name: "Predictions", href: "/predictions", icon: Brain },
  { name: "Reports", href: "/reports", icon: BarChart3, adminOnly: true },
  { name: "Map", href: "/map", icon: MapPin },
]

// ─── Sidebar link ─────────────────────────────────────────────────────────────

const NavLink = memo(function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem
  pathname: string
  onClick?: () => void
}) {
  const active = pathname === item.href
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.name}
    </Link>
  )
})

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  pathname,
  isAdmin,
  onNavClick,
}: {
  pathname: string
  isAdmin: boolean
  onNavClick?: () => void
}) {
  const filterItems = (items: NavItem[]) =>
    items.filter((i) => !i.adminOnly || isAdmin)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 h-16 px-4 border-b border-border/50">
        <div className="p-1.5 bg-primary rounded-lg">
          <Trash2 className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-base font-bold text-foreground">SmartWaste</span>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <div>
          <p className="px-3 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Operations
          </p>
          <div className="space-y-0.5">
            {filterItems(NAV_OPERATIONS).map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavClick} />
            ))}
          </div>
        </div>

        <div>
          <p className="px-3 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Analytics
          </p>
          <div className="space-y-0.5">
            {filterItems(NAV_ANALYTICS).map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavClick} />
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom status */}
      <div className="px-3 py-3 border-t border-border/50 space-y-2">
        {isAdmin && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-purple-900 dark:text-purple-100">Admin</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">Full access</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">System</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Operational</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isAdmin } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }

  const currentPageName =
    [...NAV_OPERATIONS, ...NAV_ANALYTICS].find((i) => i.href === pathname)?.name ??
    "Dashboard"

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 border-0">
          <div className="h-full bg-card">
            <SidebarContent
              pathname={pathname}
              isAdmin={isAdmin}
              onNavClick={() => setSidebarOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col">
        <div className="h-full bg-card border-r border-border/50">
          <SidebarContent pathname={pathname} isAdmin={isAdmin} />
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-40 h-14 flex items-center gap-3 border-b border-border/50 bg-card/80 backdrop-blur-sm px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Page title */}
          <h1 className="text-sm font-semibold text-foreground flex-1">
            {currentPageName}
          </h1>

          <div className="flex items-center gap-1">
            <ModeToggle />

            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative"
                onClick={() => setNotifOpen((o) => !o)}
              >
                <Bell className="h-4 w-4" />
                {/* Badge count — wire to alertQueue from useRealtimeBins */}
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
              </Button>

              {notifOpen && (
                <div className="absolute right-0 top-10 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-sm font-semibold">Notifications</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNotifOpen(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="p-4 text-sm text-muted-foreground text-center py-8">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Connect WebSocket to see live bin alerts.</p>
                    <p className="text-xs mt-1">
                      Wire <code className="bg-muted px-1 rounded">useRealtimeBins</code> here.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 gap-2 px-2 rounded-lg">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="/avatars/01.png" alt={user?.full_name} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials(user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-xs font-medium max-w-[100px] truncate">
                    {user?.full_name ?? "User"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52" align="end">
                <div className="px-3 py-2 space-y-0.5">
                  <p className="text-sm font-medium truncate">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  {isAdmin && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}