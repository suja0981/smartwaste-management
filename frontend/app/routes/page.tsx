import { DashboardLayout } from "@/components/dashboard-layout"
import { RouteOptimization } from "@/components/route-optimization"
import { ProtectedRoute } from "@/components/protected-route"

// FIX: was missing ProtectedRoute — any unauthenticated visitor could access
// route optimization and save routes to the database.
export default function RoutesPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <RouteOptimization />
      </DashboardLayout>
    </ProtectedRoute>
  )
}