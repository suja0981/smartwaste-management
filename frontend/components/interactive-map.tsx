"use client"

/**
 * components/interactive-map.tsx
 *
 * Wrapper that loads MapClient with next/dynamic ssr:false.
 * This is mandatory for Leaflet — it uses window/document on import.
 */

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

const MapClient = dynamic(
  () => import("./map-client").then(mod => ({ default: mod.MapClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center" style={{ height: "600px" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      </div>
    ),
  }
)

export function InteractiveMap() {
  return (
    <div className="w-full">
      <MapClient />
    </div>
  )
}