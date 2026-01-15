//Bins management page. Renders BinManagement.

import { DashboardLayout } from "@/components/dashboard-layout"
import { BinManagementIntegrated } from "@/components/bin-management"

export default function BinsPage() {
  return (
    <DashboardLayout>
      <BinManagementIntegrated />
    </DashboardLayout>
  )
}