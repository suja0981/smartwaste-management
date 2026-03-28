'use client'

/**
 * app/page.tsx — Dashboard homepage
 *
 * Design changes:
 *  1. Removed the giant text-5xl gradient hero — it pushed KPI cards below the fold.
 *     Replaced with a slim 2-line page header showing the current date + system status.
 *  2. Stats grid is now the first visible element.
 *  3. Quick action cards kept but toned down (less scale animation).
 *  4. ML widgets stay at the bottom where they belong.
 *  5. Admin users see a "Route Optimization" quick action; regular users do not.
 */

import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import {
  BinDataProvider,
  ModernDashboardStats,
  ModernBinStatus,
} from "@/components/modern-dashboard-widgets"
import { MLPredictionsCard, PredictedAlertsCard, MLStatsCard } from "@/components/ml-prediction-widgets"
import { useAuth } from "@/contexts/auth-context"

function QuickActionCard({
  href,
  title,
  description,
  from,
  to,
}: {
  href: string
  title: string
  description: string
  from: string
  to: string
}) {
  return (
    <a
      href={href}
      className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${from} ${to} p-5 text-white shadow-md transition-shadow duration-200 hover:shadow-lg`}
    >
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm opacity-75">{description}</p>
      <span className="absolute bottom-4 right-4 text-white/50 text-lg group-hover:text-white/90 transition-colors">
        →
      </span>
    </a>
  )
}

function PageHeader() {
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Overview</h1>
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

  return (
    <div className="space-y-6 pb-8">
      <PageHeader />

      {/* KPI stats — first thing visible */}
      <ModernDashboardStats />

      {/* Bin status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ModernBinStatus />

        {/* Quick summary card */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Quick Actions
          </h2>
          <div className="grid gap-3">
            <QuickActionCard
              href="/bins"
              title="Manage Bins"
              description="Monitor and control all waste bins"
              from="from-emerald-500"
              to="to-teal-600"
            />
            {isAdmin && (
              <QuickActionCard
                href="/crew"
                title="Crew Management"
                description="Assign tasks and track teams"
                from="from-orange-500"
                to="to-amber-600"
              />
            )}
            {isAdmin && (
              <QuickActionCard
                href="/routes"
                title="Route Optimization"
                description="Plan efficient collection routes"
                from="from-blue-500"
                to="to-indigo-600"
              />
            )}
            <QuickActionCard
              href="/predictions"
              title="ML Predictions"
              description="AI-powered fill forecasting"
              from="from-violet-500"
              to="to-purple-600"
            />
            {isAdmin && (
              <QuickActionCard
                href="/reports"
                title="Export Reports"
                description="Download PDF or Excel reports"
                from="from-pink-500"
                to="to-rose-600"
              />
            )}
          </div>
        </div>
      </div>

      {/* ML widgets */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          AI Predictions
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <MLPredictionsCard />
          <PredictedAlertsCard />
          <MLStatsCard />
        </div>
      </div>
    </div>
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