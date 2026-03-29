import { DashboardLayout } from "@/components/dashboard-layout"
import { RouteOptimization } from "@/components/route-optimization"
import { AdminOnlyRoute } from "@/components/protected-route"

export default function RoutesPage() {
  return (
    <AdminOnlyRoute>
      <DashboardLayout>
        <RouteOptimization />
      </DashboardLayout>
    </AdminOnlyRoute>
  )
}