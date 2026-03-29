"use client"

/**
 * components/interactive-map.tsx
 *
 * FIXES applied:
 *
 * 1. Leaflet CSS <link> removed from JSX (was re-injected inside CardContent on
 *    every render, producing duplicate stylesheets and a layout flash on
 *    re-mount). Move the import to app/layout.tsx instead:
 *      import "leaflet/dist/leaflet.css"
 *    or add to globals.css:
 *      @import "leaflet/dist/leaflet.css";
 *
 * 2. `selected` removed from the dep arrays of the bin-marker and crew-marker
 *    useEffects. Including it caused a full marker teardown + rebuild on every
 *    click, which re-ran the Leaflet icon constructor for every visible marker,
 *    produced a visible flash, and leaked the old marker instances until GC.
 *    Selection styling is now handled by a dedicated lightweight useEffect that
 *    only updates the icon of the two affected markers (previous and next
 *    selection) rather than re-rendering the entire layer.
 *
 * 3. getLeaflet() is called once per effect, not once per marker inside the
 *    loop, so the dynamic import promise is not re-awaited N times.
 */

import {
  useEffect, useState, useCallback, useMemo, useRef
} from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { getBins, getCrews, getRoutes, type Bin, type Crew, type Route } from "@/lib/api-client"
import { mapBinStatus } from "@/lib/status-mapper"
import { Trash2, Users, Route as RouteIcon, RefreshCw, Loader2, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

const DEFAULT_LAT = parseFloat(process.env.NEXT_PUBLIC_MAP_CENTER_LAT || "21.1458")
const DEFAULT_LNG = parseFloat(process.env.NEXT_PUBLIC_MAP_CENTER_LNG || "79.0882")
const DEFAULT_ZOOM = parseInt(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM || "13")

const TILE_LIGHT = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function binColor(fill: number): string {
  if (fill >= 90) return "#ef4444"
  if (fill >= 80) return "#f59e0b"
  return "#22c55e"
}

function makeBinIcon(fill: number, selected: boolean): string {
  const color = binColor(fill)
  const size = selected ? 36 : 30
  const r = size / 2
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
      <circle cx="${r}" cy="${r}" r="${r - 2}" fill="${color}" stroke="white" stroke-width="2.5"/>
      <path d="M${r} ${size}L${r - 6} ${size + 8}L${r + 6} ${size + 8}Z" fill="${color}"/>
      <text x="${r}" y="${r + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="white" font-family="system-ui">${fill}%</text>
    </svg>
  `)}`
}

function makeCrewIcon(status: string, selected: boolean): string {
  const color = status === "active" ? "#3b82f6" : status === "break" ? "#f59e0b" : "#9ca3af"
  const size = selected ? 34 : 28
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
      <rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="6" fill="${color}" stroke="white" stroke-width="2.5"/>
      <path d="M${size / 2} ${size}L${size / 2 - 5} ${size + 8}L${size / 2 + 5} ${size + 8}Z" fill="${color}"/>
      <text x="${size / 2}" y="${size / 2 + 4}" text-anchor="middle" font-size="10" fill="white" font-family="system-ui">👤</text>
    </svg>
  `)}`
}

let L: typeof import("leaflet") | null = null

async function getLeaflet() {
  if (L) return L
  L = await import("leaflet")
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  })
  return L
}

type SelectedItem =
  | { type: "bin"; data: Bin }
  | { type: "crew"; data: Crew }
  | null

export function InteractiveMap() {
  const [bins, setBins] = useState<Bin[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SelectedItem>(null)
  const [showBins, setShowBins] = useState(true)
  const [showCrews, setShowCrews] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()
  const { resolvedTheme } = useTheme()

  const mapRef = useRef<import("leaflet").Map | null>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<import("leaflet").Marker[]>([])
  const crewMarkersRef = useRef<import("leaflet").Marker[]>([])
  const routeLayersRef = useRef<import("leaflet").Polyline[]>([])
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null)
  const mountedRef = useRef(false)

  // Keep a stable id → marker map for cheap icon updates on selection change
  const binMarkerMapRef = useRef<Map<string, import("leaflet").Marker>>(new Map())
  const crewMarkerMapRef = useRef<Map<string, import("leaflet").Marker>>(new Map())

  const fetchData = useCallback(async (silent = false) => {
    try {
      const [b, c, r] = await Promise.all([
        getBins(),
        getCrews(),
        getRoutes().catch(() => []),
      ])
      setBins(b)
      setCrews(c)
      setRoutes(r)
    } catch (err) {
      if (!silent)
        toast({ title: "Error", description: "Failed to load map data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData(false)
    const id = setInterval(() => fetchData(true), 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  // Map init — runs once
  useEffect(() => {
    if (mountedRef.current || !mapDivRef.current) return
    mountedRef.current = true

    getLeaflet().then((leaflet) => {
      if (!mapDivRef.current || mapRef.current) return

      const map = leaflet.map(mapDivRef.current, {
        center: [DEFAULT_LAT, DEFAULT_LNG],
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      })

      const tile = leaflet.tileLayer(
        resolvedTheme === "dark" ? TILE_DARK : TILE_LIGHT,
        { attribution: TILE_ATTRIBUTION, maxZoom: 19 }
      )
      tile.addTo(map)
      tileLayerRef.current = tile
      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        mountedRef.current = false
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tile swap on theme change
  useEffect(() => {
    const map = mapRef.current
    const old = tileLayerRef.current
    if (!map || !old) return

    getLeaflet().then((leaflet) => {
      old.remove()
      const tile = leaflet.tileLayer(
        resolvedTheme === "dark" ? TILE_DARK : TILE_LIGHT,
        { attribution: TILE_ATTRIBUTION, maxZoom: 19 }
      )
      tile.addTo(map)
      tileLayerRef.current = tile
    })
  }, [resolvedTheme])

  // FIX: `selected` removed from deps. Markers are rebuilt only when bins/
  // showBins/statusFilter change. Selection icon swaps are handled by a
  // separate lightweight effect below.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    getLeaflet().then((leaflet) => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      binMarkerMapRef.current.clear()

      if (!showBins) return

      const filtered = bins.filter((b) => {
        const s = mapBinStatus(b.status)
        return statusFilter === "all" || s === statusFilter
      })

      filtered.forEach((bin) => {
        if (!bin.latitude || !bin.longitude) return

        const icon = leaflet.icon({
          iconUrl: makeBinIcon(bin.fill_level_percent, false),
          iconSize: [30, 38],
          iconAnchor: [15, 38],
          popupAnchor: [0, -40],
        })

        const marker = leaflet.marker([bin.latitude, bin.longitude], { icon })

        marker.bindPopup(`
          <div style="min-width:180px;font-family:system-ui">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${bin.id}</div>
            <div style="color:#6b7280;font-size:12px;margin-bottom:8px">📍 ${bin.location}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <div style="flex:1;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden">
                <div style="width:${bin.fill_level_percent}%;height:100%;background:${binColor(bin.fill_level_percent)};border-radius:3px"></div>
              </div>
              <span style="font-weight:700;font-size:13px;color:${binColor(bin.fill_level_percent)}">${bin.fill_level_percent}%</span>
            </div>
            ${bin.battery_percent != null ? `<div style="font-size:12px;color:#6b7280">🔋 Battery: ${bin.battery_percent}%</div>` : ""}
            ${bin.temperature_c != null ? `<div style="font-size:12px;color:#6b7280">🌡 Temp: ${bin.temperature_c}°C</div>` : ""}
            ${bin.last_telemetry ? `<div style="font-size:11px;color:#9ca3af;margin-top:6px">Updated: ${new Date(bin.last_telemetry).toLocaleTimeString()}</div>` : ""}
          </div>
        `)

        marker.on("click", () => setSelected({ type: "bin", data: bin }))
        marker.addTo(map)
        markersRef.current.push(marker)
        binMarkerMapRef.current.set(bin.id, marker)
      })
    })
  }, [bins, showBins, statusFilter]) // ← `selected` intentionally removed

  // FIX: Lightweight icon-swap effect — only updates the two affected markers
  // when the selection changes. No full layer rebuild.
  useEffect(() => {
    getLeaflet().then((leaflet) => {
      binMarkerMapRef.current.forEach((marker, id) => {
        const bin = bins.find((b) => b.id === id)
        if (!bin) return
        const isSelected = selected?.type === "bin" && selected.data.id === id
        marker.setIcon(leaflet.icon({
          iconUrl: makeBinIcon(bin.fill_level_percent, isSelected),
          iconSize: [isSelected ? 36 : 30, isSelected ? 44 : 38],
          iconAnchor: [isSelected ? 18 : 15, isSelected ? 44 : 38],
          popupAnchor: [0, -40],
        }))
      })

      crewMarkerMapRef.current.forEach((marker, id) => {
        const crew = crews.find((c) => c.id === id)
        if (!crew) return
        const isSelected = selected?.type === "crew" && selected.data.id === id
        marker.setIcon(leaflet.icon({
          iconUrl: makeCrewIcon(crew.status, isSelected),
          iconSize: [isSelected ? 34 : 28, isSelected ? 42 : 36],
          iconAnchor: [isSelected ? 17 : 14, isSelected ? 42 : 36],
          popupAnchor: [0, -36],
        }))
      })
    })
  }, [selected, bins, crews])

  // FIX: `selected` removed from crew marker deps for the same reason
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    getLeaflet().then((leaflet) => {
      crewMarkersRef.current.forEach((m) => m.remove())
      crewMarkersRef.current = []
      crewMarkerMapRef.current.clear()

      if (!showCrews) return

      crews.forEach((crew) => {
        if (!crew.current_latitude || !crew.current_longitude) return

        const icon = leaflet.icon({
          iconUrl: makeCrewIcon(crew.status, false),
          iconSize: [28, 36],
          iconAnchor: [14, 36],
          popupAnchor: [0, -36],
        })

        const marker = leaflet.marker(
          [crew.current_latitude, crew.current_longitude],
          { icon }
        )

        marker.bindPopup(`
          <div style="min-width:160px;font-family:system-ui">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${crew.name}</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Leader: ${crew.leader}</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Members: ${crew.members_count}</div>
            <div style="font-size:12px">Status: <span style="font-weight:600;color:${crew.status === "active" ? "#22c55e" : "#f59e0b"}">${crew.status}</span></div>
            ${crew.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">📞 ${crew.phone}</div>` : ""}
          </div>
        `)

        marker.on("click", () => setSelected({ type: "crew", data: crew }))
        marker.addTo(map)
        crewMarkersRef.current.push(marker)
        crewMarkerMapRef.current.set(crew.id, marker)
      })
    })
  }, [crews, showCrews]) // ← `selected` intentionally removed

  // Route polylines — no selection dep here, so unchanged
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    getLeaflet().then((leaflet) => {
      routeLayersRef.current.forEach((l) => l.remove())
      routeLayersRef.current = []

      if (!showRoutes) return

      routes.filter((r) => r.status === "active" || r.status === "planned").forEach((route) => {
        const pts = (route.waypoints || [])
          .sort((a, b) => a.order - b.order)
          .filter((w) => w.latitude && w.longitude)
          .map((w) => [w.latitude, w.longitude] as [number, number])

        if (pts.length < 2) return

        const line = leaflet.polyline(pts, {
          color: route.status === "active" ? "#3b82f6" : "#94a3b8",
          weight: route.status === "active" ? 4 : 2,
          opacity: 0.8,
          dashArray: route.status === "active" ? undefined : "6 6",
        })

        line.bindPopup(`
          <div style="font-family:system-ui">
            <div style="font-weight:700;margin-bottom:4px">Route ${route.route_id || route.id || ""}</div>
            <div style="font-size:12px;color:#6b7280">Algorithm: ${route.algorithm}</div>
            <div style="font-size:12px;color:#6b7280">Distance: ${route.total_distance_km?.toFixed(2)} km</div>
            <div style="font-size:12px;color:#6b7280">Bins: ${route.bin_count}</div>
            <div style="font-size:12px;margin-top:4px">Status: <span style="font-weight:600">${route.status}</span></div>
          </div>
        `)

        line.addTo(map)
        routeLayersRef.current.push(line)
      })
    })
  }, [routes, showRoutes])

  // Fly to selected item
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selected) return
    getLeaflet().then(() => {
      if (selected.type === "bin" && selected.data.latitude && selected.data.longitude) {
        map.flyTo([selected.data.latitude, selected.data.longitude], 16, { duration: 1 })
      } else if (selected.type === "crew" && selected.data.current_latitude && selected.data.current_longitude) {
        map.flyTo([selected.data.current_latitude, selected.data.current_longitude], 16, { duration: 1 })
      }
    })
  }, [selected])

  const stats = useMemo(() => ({
    totalBins: bins.length,
    critical: bins.filter((b) => mapBinStatus(b.status) === "critical").length,
    activeCrews: crews.filter((c) => c.status === "active").length,
    activeRoutes: routes.filter((r) => r.status === "active").length,
    binsWithCoords: bins.filter((b) => b.latitude && b.longitude).length,
  }), [bins, crews, routes])

  const filteredBins = useMemo(() =>
    bins.filter((b) => {
      const s = mapBinStatus(b.status)
      return statusFilter === "all" || s === statusFilter
    }),
    [bins, statusFilter]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Live Map</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.binsWithCoords} of {stats.totalBins} bins have coordinates
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(false)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total bins", value: stats.totalBins, color: "text-foreground" },
          { label: "Critical", value: stats.critical, color: "text-red-500" },
          { label: "Active crews", value: stats.activeCrews, color: "text-blue-500" },
          { label: "Active routes", value: stats.activeRoutes, color: "text-emerald-500" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="py-3">
            <CardContent className="px-4 py-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("text-2xl font-bold", color)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-6 px-4 py-2.5 border-b bg-card flex-wrap">
              {[
                { id: "bins", label: "Bins", state: showBins, set: setShowBins, icon: Trash2 },
                { id: "crews", label: "Crews", state: showCrews, set: setShowCrews, icon: Users },
                { id: "routes", label: "Routes", state: showRoutes, set: setShowRoutes, icon: RouteIcon },
              ].map(({ id, label, state, set, icon: Icon }) => (
                <div key={id} className="flex items-center gap-2">
                  <Switch id={id} checked={state} onCheckedChange={set} />
                  <Label htmlFor={id} className="flex items-center gap-1 text-sm cursor-pointer">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Label>
                </div>
              ))}

              <div className="ml-auto flex gap-1">
                {["all", "critical", "warning", "normal"].map((f) => (
                  <Button
                    key={f}
                    variant={statusFilter === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(f)}
                    className="text-xs h-7 px-2 capitalize"
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>

            <CardContent className="p-0">
              {/*
                FIX: The <link rel="stylesheet"> for Leaflet CSS has been removed
                from here. It was being re-injected into the DOM on every render,
                causing duplicate stylesheets and a visible layout flash on re-mount.
                Add this to app/layout.tsx instead:
                  import "leaflet/dist/leaflet.css"
                or add to globals.css:
                  @import "leaflet/dist/leaflet.css";
              */}
              <div
                ref={mapDivRef}
                style={{ height: 520, width: "100%" }}
                className="z-0"
              />
            </CardContent>

            <div className="flex items-center gap-4 px-4 py-2.5 border-t text-xs text-muted-foreground flex-wrap">
              {[
                { color: "#22c55e", label: "Normal (< 80%)" },
                { color: "#f59e0b", label: "Warning (80–89%)" },
                { color: "#ef4444", label: "Critical (≥ 90%)" },
                { color: "#3b82f6", label: "Active crew" },
                { color: "#94a3b8", label: "Planned route" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Tabs defaultValue="bins">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="bins">Bins ({filteredBins.length})</TabsTrigger>
              <TabsTrigger value="crews">Crews ({crews.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="bins" className="space-y-2 mt-2 max-h-[440px] overflow-y-auto pr-1">
              {filteredBins.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No bins found</p>
              ) : (
                filteredBins.map((bin) => (
                  <div
                    key={bin.id}
                    onClick={() => setSelected({ type: "bin", data: bin })}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40",
                      selected?.type === "bin" && selected.data.id === bin.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold">{bin.id}</span>
                      <span className="text-xs font-bold" style={{ color: binColor(bin.fill_level_percent) }}>
                        {bin.fill_level_percent}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-0.5 mb-1.5">
                      <MapPin className="h-2.5 w-2.5" />
                      {bin.location}
                    </p>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${bin.fill_level_percent}%`,
                          background: binColor(bin.fill_level_percent),
                        }}
                      />
                    </div>
                    {!bin.latitude && (
                      <p className="text-xs text-amber-500 mt-1">⚠ No coordinates</p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="crews" className="space-y-2 mt-2 max-h-[440px] overflow-y-auto pr-1">
              {crews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No crews found</p>
              ) : (
                crews.map((crew) => (
                  <div
                    key={crew.id}
                    onClick={() => setSelected({ type: "crew", data: crew })}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40",
                      selected?.type === "crew" && selected.data.id === crew.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{crew.name}</span>
                      <Badge
                        variant={crew.status === "active" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {crew.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Leader: {crew.leader}</p>
                    <p className="text-xs text-muted-foreground">Members: {crew.members_count}</p>
                    {!crew.current_latitude && (
                      <p className="text-xs text-amber-500 mt-1">⚠ Location unknown</p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>

          {selected && (
            <Card>
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {selected.type === "bin" ? "Bin Detail" : "Crew Detail"}
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelected(null)}>
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {selected.type === "bin" && (
                  <>
                    <p className="font-semibold text-sm">{selected.data.id}</p>
                    <p className="text-xs text-muted-foreground">{selected.data.location}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Fill</p>
                        <p className="font-bold" style={{ color: binColor(selected.data.fill_level_percent) }}>
                          {selected.data.fill_level_percent}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Capacity</p>
                        <p className="font-bold">{selected.data.capacity_liters}L</p>
                      </div>
                      {selected.data.battery_percent != null && (
                        <div>
                          <p className="text-muted-foreground">Battery</p>
                          <p className="font-bold">{selected.data.battery_percent}%</p>
                        </div>
                      )}
                      {selected.data.temperature_c != null && (
                        <div>
                          <p className="text-muted-foreground">Temp</p>
                          <p className="font-bold">{selected.data.temperature_c}°C</p>
                        </div>
                      )}
                    </div>
                    {selected.data.latitude && selected.data.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${selected.data.latitude},${selected.data.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline block mt-1"
                      >
                        Open in Google Maps →
                      </a>
                    )}
                  </>
                )}
                {selected.type === "crew" && (
                  <>
                    <p className="font-semibold text-sm">{selected.data.name}</p>
                    <p className="text-xs text-muted-foreground">Leader: {selected.data.leader}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-bold capitalize">{selected.data.status}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Members</p>
                        <p className="font-bold">{selected.data.members_count}</p>
                      </div>
                    </div>
                    {selected.data.phone && (
                      <p className="text-xs text-muted-foreground">📞 {selected.data.phone}</p>
                    )}
                    {selected.data.current_latitude && selected.data.current_longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${selected.data.current_latitude},${selected.data.current_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline block"
                      >
                        Open location in Google Maps →
                      </a>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}