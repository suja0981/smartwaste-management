// app/reports/page.tsx
import { DashboardLayout } from "@/components/dashboard-layout"
import { AnalyticsReports } from "@/components/analytics-reports"
import { AdminOnlyRoute } from "@/components/protected-route"

export default function ReportsPage() {
  return (
    <AdminOnlyRoute>
      <DashboardLayout>
        <AnalyticsReports />
      </DashboardLayout>
    </AdminOnlyRoute>
  )
}