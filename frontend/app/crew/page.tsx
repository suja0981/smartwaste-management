//Crew management page. Renders CrewManagement.

import { DashboardLayout } from "@/components/dashboard-layout"
import { CrewManagement } from "@/components/crew-management"

export default function CrewPage() {
  return (
    <DashboardLayout>
      <CrewManagement />
    </DashboardLayout>
  )
}
