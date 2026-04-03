'use client'

import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import {
  BinDataProvider,
  ModernDashboardStats,
  ModernBinStatus,
} from "@/components/modern-dashboard-widgets"
import { MLPredictionsCard } from "@/components/ml-prediction-widgets"
import { Badge } from "@/components/ui/badge"
import { Brain, CalendarDays } from "lucide-react"

function PageHeader() {
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return (
    <div className="rounded-2xl border bg-card/90 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge
            variant="secondary"
            className="w-fit rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.18em]"
          >
            OPERATIONS DASHBOARD
          </Badge>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Track live bin conditions, identify high-risk pickups, and keep the team focused on
              the bins that need attention first.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-3 sm:min-w-[260px]">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span>{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Brain className="h-4 w-4 text-violet-600" />
            <span>Prediction insights are refreshed from the live service feed.</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardContent() {
  return (
    <BinDataProvider>
      <div className="space-y-6 pb-8">
        <PageHeader />
        <ModernDashboardStats />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.95fr)]">
          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Live Bin Status</h2>
              <p className="text-sm text-muted-foreground">
                Highest fill-level bins are surfaced first so collection issues are easy to spot.
              </p>
            </div>
            <ModernBinStatus />
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Prediction Watch</h2>
              <p className="text-sm text-muted-foreground">
                One focused ML panel keeps the forecast readable without repeating the same data.
              </p>
            </div>
            <MLPredictionsCard />
          </section>
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
