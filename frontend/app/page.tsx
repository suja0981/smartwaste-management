//Home dashboard page. Renders stats, bin status, and AI alerts sections.

import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardStats, BinStatusSection, AIAlertsSection } from "@/components/dashboard-widgets"

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Smart Waste Management Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor your waste collection system with AI-powered insights and real-time data.
          </p>
        </div>

        <DashboardStats />

        <div className="grid gap-6 lg:grid-cols-2">
          <BinStatusSection />
          <AIAlertsSection />
        </div>
      </div>
    </DashboardLayout>
  )
}
