//Interactive map page. Renders InteractiveMap.

import { DashboardLayout } from "@/components/dashboard-layout"
import { InteractiveMap } from "@/components/interactive-map"

export default function MapPage() {
  return (
    <DashboardLayout>
      <InteractiveMap />
    </DashboardLayout>
  )
}
