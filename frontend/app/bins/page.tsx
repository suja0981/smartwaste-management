//Bins management page. Renders BinManagement.

import { DashboardLayout } from "@/components/dashboard-layout"
import { BinManagementIntegrated } from "@/components/bin-management"
import { ProtectedRoute } from "@/components/protected-route"

export default function BinsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <BinManagementIntegrated />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
