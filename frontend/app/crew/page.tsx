//Crew management page. Renders CrewManagement.

import { DashboardLayout } from "@/components/dashboard-layout"
import { CrewManagement } from "@/components/crew-management"
import { ProtectedRoute } from "@/components/protected-route"

export default function CrewPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <CrewManagement />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
