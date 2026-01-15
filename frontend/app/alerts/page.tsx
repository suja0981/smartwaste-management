//AI alerts management page. Renders AIAlertsManagement.

import { DashboardLayout } from "@/components/dashboard-layout"
import { AIAlertsManagementIntegrated } from "@/components/ai-alerts-management"

export default function AlertsPage() {
  return (
    <DashboardLayout>
      <AIAlertsManagementIntegrated />
    </DashboardLayout>
  )
}