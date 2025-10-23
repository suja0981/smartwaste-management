//AI alerts management page. Renders AIAlertsManagement.

import { DashboardLayout } from "@/components/dashboard-layout"
import { AIAlertsManagement } from "@/components/ai-alerts-management"

export default function AlertsPage() {
  return (
    <DashboardLayout>
      <AIAlertsManagement />
    </DashboardLayout>
  )
}
