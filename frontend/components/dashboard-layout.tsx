"use client"

import type React from "react"
import { useState } from "react"
import { Bell, Menu, Settings, User, Trash2, BarChart3, Users, AlertTriangle, MapPin, Home, Sparkles, LogOut, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ModeToggle } from "@/components/mode-toggle"
import { cn } from "@/lib/utils"
import { usePathname, useRouter } from "next/navigation"
import { Route } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"


const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Bins", href: "/bins", icon: Trash2 },
  { name: "AI Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Routes", href: "/routes", icon: Route },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Crew", href: "/crew", icon: Users },
  { name: "Map", href: "/map", icon: MapPin },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isAdmin } = useAuth()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const getInitials = (fullName: string | undefined) => {
    if (!fullName) return "U"
    return fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 bg-[url('/grid.svg')] opacity-[0.02] pointer-events-none"></div>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 border-0">
          <div className="flex h-full flex-col bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
            <div className="flex h-16 items-center px-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
                  <Trash2 className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  SmartWaste
                </span>
              </div>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className={cn(
                    pathname === item.href
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200"
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="flex h-16 items-center px-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
                <Trash2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                SmartWaste
              </span>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={cn(
                  pathname === item.href
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg scale-[1.02]"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                  "group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
                {pathname === item.href && item.name === "AI Alerts" && (
                  <Badge className="ml-auto bg-white/20 text-white border-0">Live</Badge>
                )}
              </a>
            ))}
          </nav>

          {/* Bottom section */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            {isAdmin && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 mb-3">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-purple-900 dark:text-purple-100">Admin Access</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">Full permissions</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100">System Status</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">All systems operational</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navigation */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              <h1 className="text-xl font-semibold text-foreground">
                {navigation.find((item) => item.href === pathname)?.name || "Dashboard"}
              </h1>
            </div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <ModeToggle />

              {/* Notifications */}
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs bg-gradient-to-r from-orange-500 to-pink-600 border-0">
                  3
                </Badge>
              </Button>

              {/* Profile dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9 border-2 border-gradient-to-r from-cyan-500 to-blue-600">
                      <AvatarImage src="/avatars/01.png" alt={user?.full_name} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-semibold">
                        {getInitials(user?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex flex-col space-y-1 p-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.full_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                    {isAdmin && (
                      <Badge variant="secondary" className="w-fit mt-1">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-8 relative z-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}