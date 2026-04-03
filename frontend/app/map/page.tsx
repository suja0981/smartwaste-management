//Interactive map page. Renders InteractiveMap.

import "leaflet/dist/leaflet.css"
import { DashboardLayout } from "@/components/dashboard-layout"
import { InteractiveMap } from "@/components/interactive-map"
import { ProtectedRoute } from "@/components/protected-route"

export default function MapPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <InteractiveMap />
      </DashboardLayout>
    </ProtectedRoute>
  )
}