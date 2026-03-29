'use client'

import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import {
  BinDataProvider,
  ModernDashboardStats,
  ModernBinStatus,
} from "@/components/modern-dashboard-widgets"
import { MLPredictionsCard, PredictedAlertsCard, MLStatsCard } from "@/components/ml-prediction-widgets"
import { useAuth } from "@/contexts/auth-context"
import {
  Trash2, Users, Navigation, Brain, BarChart3, Map, ArrowRight,
} from "lucide-react"

// NOTE: Tasks page (/tasks) removed — Tasks are now managed inside /crew (Kanban tab).
// Live Map (/map) added as it was missing from the sidebar + no page existed.
const QUICK_ACTIONS = [
  {
    href: "/bins",
    title: "Manage Bins",
    description: "Monitor and control all waste bins",
    gradient: "from-emerald-500 to-teal-600",
    icon: Trash2,
    adminOnly: false,
  },
  {
    href: "/map",
    title: "Live Map",
    description: "Real-time bin and crew locations",
    gradient: "from-sky-500 to-blue-600",
    icon: Map,
    adminOnly: false,
  },
  {
    href: "/predictions",
    title: "ML Predictions",
    description: "AI-powered fill forecasting",
    gradient: "from-violet-500 to-purple-600",
    icon: Brain,
    adminOnly: false,
  },
  {
    href: "/crew",
    title: "Crew & Tasks",
    description: "Assign tasks and track teams",
    gradient: "from-orange-500 to-amber-600",
    icon: Users,
    adminOnly: true,
  },
  {
    href: "/routes",
    title: "Route Optimization",
    description: "Plan efficient collection routes",
    gradient: "from-blue-500 to-indigo-600",
    icon: Navigation,
    adminOnly: true,
  },
  {
    href: "/reports",
    title: "Export Reports",
    description: "Download PDF or Excel reports",
    gradient: "from-pink-500 to-rose-600",
    icon: BarChart3,
    adminOnly: true,
  },
]

function QuickActionCard({
  href, title, description, gradient, icon: Icon,
}: {
  href: string
  title: string
  description: string
  gradient: string
  icon: React.ElementType
}) {
  return (
    <a
      href={href}
      className={`group flex items-center gap-3 rounded-xl bg-gradient-to-br ${gradient} p-4 text-white shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs opacity-75 truncate">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
    </a>
  )
}

function PageHeader() {
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{dateStr}</p>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Live</span>
      </div>
    </div>
  )
}

function DashboardContent() {
  const { isAdmin } = useAuth()
  const visibleActions = QUICK_ACTIONS.filter((a) => !a.adminOnly || isAdmin)

  return (
    <BinDataProvider>
      <div className="space-y-6 pb-8">
        <PageHeader />
        <ModernDashboardStats />

        <div className="grid gap-6 lg:grid-cols-2">
          <ModernBinStatus />
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </h2>
            <div className="grid gap-2.5">
              {visibleActions.map((a) => (
                <QuickActionCard key={a.href} {...a} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            AI Predictions
          </h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <MLPredictionsCard />
            <PredictedAlertsCard />
            <MLStatsCard />
          </div>
        </div>
      </div>
    </BinDataProvider>
  )
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
    </ProtectedRoute>
  )
}