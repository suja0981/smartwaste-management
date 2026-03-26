// AI alerts management page removed.

import { DashboardLayout } from "@/components/dashboard-layout"

export default function AlertsPage() {
  return (
    <DashboardLayout>
      <div className="p-12">
        <h1 className="text-3xl font-bold">AI Alerts Management Removed</h1>
        <p className="mt-4 text-muted-foreground">
          The AI alert management feature is no longer available. Use the dashboard and predictions pages for insights.
        </p>
      </div>
    </DashboardLayout>
  )
}