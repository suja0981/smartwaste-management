// app/crew/page.tsx
import { DashboardLayout } from "@/components/dashboard-layout"
import { CrewManagement } from "@/components/crew-management"
import { AdminOnlyRoute } from "@/components/protected-route"

export default function CrewPage() {
  return (
    <AdminOnlyRoute>
      <DashboardLayout>
        <CrewManagement />
      </DashboardLayout>
    </AdminOnlyRoute>
  )
}