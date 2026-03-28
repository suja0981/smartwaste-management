//Analytics/reports page. Renders AnalyticsReports.

import { DashboardLayout } from "@/components/dashboard-layout"
import { AnalyticsReports } from "@/components/analytics-reports"
import { ProtectedRoute } from "@/components/protected-route"

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <AnalyticsReports />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
