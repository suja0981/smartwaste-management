"use client"

import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { getBins, getCrews, getRoutes, type Bin, type Crew, type Route } from "@/lib/api-client"
import { mergeRealtimeBinUpdates, useRealtimeBinsContext } from "@/hooks/useRealtimeBins"
import { mapBinStatus } from "@/lib/status-mapper"
import { Trash2, Users, Route as RouteIcon, RefreshCw, Loader2, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

// @ts-expect-error Leaflet keeps this internal hook on the prototype.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
})

const DEFAULT_LAT = parseFloat(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? "21.1458")
const DEFAULT_LNG = parseFloat(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? "79.0882")
const DEFAULT_ZOOM = parseInt(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM ?? "13")
const TILE_LIGHT = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const POLL_INTERVAL = 60_000

function binColor(fillPercent: number) {
  return fillPercent >= 90 ? "#ef4444" : fillPercent >= 80 ? "#f59e0b" : "#22c55e"
}

function makeBinIcon(fillPercent: number, selected: boolean) {
  const color = binColor(fillPercent)
  const size = selected ? 36 : 30
  const radius = size / 2

  return L.icon({
    iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
        <circle cx="${radius}" cy="${radius}" r="${radius - 2}" fill="${color}" stroke="white" stroke-width="2.5"/>
        <path d="M${radius} ${size}L${radius - 6} ${size + 8}L${radius + 6} ${size + 8}Z" fill="${color}"/>
        <text x="${radius}" y="${radius + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="white" font-family="system-ui">${fillPercent}%</text>
      </svg>`
    )}`,
    iconSize: [size, size + 8] as [number, number],
    iconAnchor: [radius, size + 8] as [number, number],
    popupAnchor: [0, -size] as [number, number],
  })
}

function makeCrewIcon(status: string, selected: boolean) {
  const color = status === "active" ? "#3b82f6" : status === "break" ? "#f59e0b" : "#9ca3af"
  const size = selected ? 34 : 28

  return L.icon({
    iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
        <rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="6" fill="${color}" stroke="white" stroke-width="2.5"/>
        <path d="M${size / 2} ${size}L${size / 2 - 5} ${size + 8}L${size / 2 + 5} ${size + 8}Z" fill="${color}"/>
        <text x="${size / 2}" y="${size / 2 + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="white" font-family="system-ui">C</text>
      </svg>`
    )}`,
    iconSize: [size, size + 8] as [number, number],
    iconAnchor: [size / 2, size + 8] as [number, number],
    popupAnchor: [0, -size] as [number, number],
  })
}

type SelectedItem = { type: "bin"; data: Bin } | { type: "crew"; data: Crew } | null

export function MapClient() {
  const [selected, setSelected] = useState<SelectedItem>(null)
  const [showBins, setShowBins] = useState(true)
  const [showCrews, setShowCrews] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")

  const seenAlerts = useRef<Set<string>>(new Set())
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const binMarkers = useRef<Map<string, L.Marker>>(new Map())
  const crewMarkers = useRef<Map<string, L.Marker>>(new Map())
  const routeLines = useRef<L.Polyline[]>([])

  const { toast } = useToast()
  const { resolvedTheme } = useTheme()
  const { binUpdates, connected, alertQueue, dismissAlert } = useRealtimeBinsContext()
  const isDark = resolvedTheme === "dark"
  const queryClient = useQueryClient()

  // ── TanStack Query: bins, crews, routes polled every 60 s ──────────────────
  const { data: fetchedBins = [], isLoading: binsLoading } = useQuery<Bin[]>({
    queryKey: ["bins"],
    queryFn: () => getBins(),
    refetchInterval: POLL_INTERVAL,
    staleTime: 15_000,
  })

  const { data: crews = [], isLoading: crewsLoading } = useQuery<Crew[]>({
    queryKey: ["crews"],
    queryFn: () => getCrews(),
    refetchInterval: POLL_INTERVAL,
    staleTime: 15_000,
  })

  const { data: routes = [] } = useQuery({
    queryKey: ["routes"],
    queryFn: () => getRoutes().catch(() => [] as Route[]),
    refetchInterval: POLL_INTERVAL,
    staleTime: 30_000,
  })

  const loading = binsLoading || crewsLoading
  const error: string | null = null  // query errors surface via toast on retry

  // ── Merge realtime WS updates on top of queried bins ──────────────────────
  const [displayBins, setDisplayBins] = useState<Bin[]>(fetchedBins)

  // Single effect: always derive from the authoritative fetchedBins, then apply
  // any realtime deltas on top. Two separate effects had a write-order race.
  useEffect(() => {
    setDisplayBins(mergeRealtimeBinUpdates(fetchedBins, binUpdates))
  }, [fetchedBins, binUpdates])

  useEffect(() => {
    const nextAlert = alertQueue[0]
    if (!nextAlert) return

    const alertKey = `${nextAlert.bin_id}:${nextAlert.level}:${nextAlert.timestamp}`
    if (seenAlerts.current.has(alertKey)) {
      dismissAlert(0)
      return
    }

    seenAlerts.current.add(alertKey)
    toast({
      title: nextAlert.level === "critical" ? "Critical bin alert" : "Bin warning",
      description: nextAlert.message,
      variant: nextAlert.level === "critical" ? "destructive" : "default",
    })
    dismissAlert(0)
  }, [alertQueue, dismissAlert, toast])

  useEffect(() => {
    if (!selected || selected.type !== "bin") return
    const liveBin = displayBins.find((bin) => bin.id === selected.data.id)
    if (liveBin && liveBin !== selected.data) {
      setSelected({ type: "bin", data: liveBin })
    }
  }, [displayBins, selected])

  useEffect(() => {
    if (!selected || selected.type !== "crew") return
    const liveCrew = crews.find((crew) => crew.id === selected.data.id)
    if (liveCrew && liveCrew !== selected.data) {
      setSelected({ type: "crew", data: liveCrew })
    }
  }, [crews, selected])

  useEffect(() => {
    if (!divRef.current || mapRef.current) return

    const map = L.map(divRef.current, {
      center: [DEFAULT_LAT, DEFAULT_LNG],
      zoom: DEFAULT_ZOOM,
    })

    mapRef.current = map
    map.invalidateSize()

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const bm = binMarkers.current
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const cm = crewMarkers.current
      map.remove()
      mapRef.current = null
      tileRef.current = null
      bm.clear()
      cm.clear()
      routeLines.current = []
    }
  }, []) // Run once on mount — prevents double-init and map teardown on refetch

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (tileRef.current) {
      tileRef.current.remove()
    }

    const tileLayer = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
      attribution: ATTR,
      maxZoom: 19,
    })

    tileLayer.addTo(map)
    tileRef.current = tileLayer
  }, [isDark])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    binMarkers.current.forEach((marker) => marker.remove())
    binMarkers.current.clear()

    if (!showBins) return

    displayBins
      .filter((bin) => statusFilter === "all" || mapBinStatus(bin.status) === statusFilter)
      .forEach((bin) => {
        if (!bin.latitude || !bin.longitude) return

        const isSelected = selected?.type === "bin" && selected.data.id === bin.id
        const marker = L.marker([bin.latitude, bin.longitude], {
          icon: makeBinIcon(bin.fill_level_percent, isSelected),
        })

        marker.bindPopup(`
          <div style="min-width:180px;font-family:system-ui">
            <b style="font-size:14px">${bin.id}</b>
            <div style="color:#6b7280;font-size:12px;margin:4px 0 8px">${bin.location}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <div style="flex:1;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden">
                <div style="width:${bin.fill_level_percent}%;height:100%;background:${binColor(bin.fill_level_percent)};border-radius:3px"></div>
              </div>
              <b style="color:${binColor(bin.fill_level_percent)}">${bin.fill_level_percent}%</b>
            </div>
            ${bin.battery_percent != null ? `<div style="font-size:12px;color:#6b7280">Battery ${bin.battery_percent}%</div>` : ""}
            ${bin.temperature_c != null ? `<div style="font-size:12px;color:#6b7280">Temp ${bin.temperature_c} C</div>` : ""}
          </div>
        `)

        marker.on("click", () => setSelected({ type: "bin", data: bin }))
        marker.addTo(map)
        binMarkers.current.set(bin.id, marker)
      })
  }, [displayBins, selected, showBins, statusFilter])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    crewMarkers.current.forEach((marker) => marker.remove())
    crewMarkers.current.clear()

    if (!showCrews) return

    crews.forEach((crew) => {
      if (!crew.current_latitude || !crew.current_longitude) return

      const isSelected = selected?.type === "crew" && selected.data.id === crew.id
      const marker = L.marker([crew.current_latitude, crew.current_longitude], {
        icon: makeCrewIcon(crew.status, isSelected),
      })

      marker.bindPopup(`
        <div style="min-width:160px;font-family:system-ui">
          <b style="font-size:14px">${crew.name}</b>
          <div style="font-size:12px;color:#6b7280;margin:4px 0">Leader: ${crew.leader} · ${crew.members_count} members</div>
          <div style="font-size:12px">Status: <b style="color:${crew.status === "active" ? "#22c55e" : "#f59e0b"}">${crew.status}</b></div>
          ${crew.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">Phone ${crew.phone}</div>` : ""}
        </div>
      `)

      marker.on("click", () => setSelected({ type: "crew", data: crew }))
      marker.addTo(map)
      crewMarkers.current.set(crew.id, marker)
    })
  }, [crews, selected, showCrews])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    routeLines.current.forEach((line) => line.remove())
    routeLines.current = []

    if (!showRoutes) return

    routes
      .filter((route) => route.status === "active" || route.status === "planned")
      .forEach((route) => {
        const points = (route.waypoints ?? [])
          .sort((left, right) => left.order - right.order)
          .filter((waypoint) => waypoint.latitude && waypoint.longitude)
          .map((waypoint) => [waypoint.latitude, waypoint.longitude] as [number, number])

        if (points.length < 2) return

        const line = L.polyline(points, {
          color: route.status === "active" ? "#3b82f6" : "#94a3b8",
          weight: route.status === "active" ? 4 : 2,
          opacity: 0.8,
          dashArray: route.status === "active" ? undefined : "6 6",
        })

        line.addTo(map)
        routeLines.current.push(line)
      })
  }, [routes, showRoutes])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selected) return

    if (selected.type === "bin" && selected.data.latitude && selected.data.longitude) {
      map.flyTo([selected.data.latitude, selected.data.longitude], 16, { duration: 1 })
    }

    if (
      selected.type === "crew" &&
      selected.data.current_latitude &&
      selected.data.current_longitude
    ) {
      map.flyTo([selected.data.current_latitude, selected.data.current_longitude], 16, {
        duration: 1,
      })
    }
  }, [selected])

  const stats = useMemo(
    () => ({
      totalBins: displayBins.length,
      critical: displayBins.filter((bin) => mapBinStatus(bin.status) === "critical").length,
      activeCrews: crews.filter((crew) => crew.status === "active").length,
      activeRoutes: routes.filter((route) => route.status === "active").length,
      binsWithCoords: displayBins.filter((bin) => bin.latitude && bin.longitude).length,
    }),
    [displayBins, crews, routes]
  )

  const filteredBins = useMemo(
    () => displayBins.filter((bin) => statusFilter === "all" || mapBinStatus(bin.status) === statusFilter),
    [displayBins, statusFilter]
  )

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="mb-2 text-red-500">Error loading map data</p>
          <Button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["bins"] })
              queryClient.invalidateQueries({ queryKey: ["crews"] })
              queryClient.invalidateQueries({ queryKey: ["routes"] })
            }}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Live Map</h2>
            <Badge variant={connected ? "default" : "secondary"} className="text-[11px]">
              {connected ? "Live feed" : "Fallback refresh"}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {stats.binsWithCoords} of {stats.totalBins} bins have coordinates
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          queryClient.invalidateQueries({ queryKey: ["bins"] })
          queryClient.invalidateQueries({ queryKey: ["crews"] })
          queryClient.invalidateQueries({ queryKey: ["routes"] })
        }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total bins", value: stats.totalBins, color: "text-foreground" },
          { label: "Critical", value: stats.critical, color: "text-red-500" },
          { label: "Active crews", value: stats.activeCrews, color: "text-blue-500" },
          { label: "Active routes", value: stats.activeRoutes, color: "text-emerald-500" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("mt-0.5 text-2xl font-bold", color)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="flex flex-col gap-0 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-6 rounded-t-xl border bg-card px-4 py-2.5">
            {([
              { id: "bins", label: "Bins", state: showBins, setState: setShowBins, icon: Trash2 },
              { id: "crews", label: "Crews", state: showCrews, setState: setShowCrews, icon: Users },
              { id: "routes", label: "Routes", state: showRoutes, setState: setShowRoutes, icon: RouteIcon },
            ] as const).map(({ id, label, state, setState, icon: Icon }) => (
              <div key={id} className="flex items-center gap-2">
                <Switch id={id} checked={state} onCheckedChange={(value) => setState(value)} />
                <Label htmlFor={id} className="flex cursor-pointer items-center gap-1 text-sm">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Label>
              </div>
            ))}
            <div className="ml-auto flex gap-1">
              {["all", "critical", "warning", "normal"].map((filterValue) => (
                <Button
                  key={filterValue}
                  variant={statusFilter === filterValue ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filterValue)}
                  className="h-7 px-2 text-xs capitalize"
                >
                  {filterValue}
                </Button>
              ))}
            </div>
          </div>

          <div
            ref={divRef}
            style={{
              height: "520px",
              width: "100%",
              position: "relative",
              display: "block",
              backgroundColor: isDark ? "#111827" : "#f5f5f5",
              zIndex: 1,
            }}
            className="leaflet-container border-x border-border"
          />

          <div className="flex flex-wrap items-center gap-4 rounded-b-xl border bg-card px-4 py-2.5 text-xs text-muted-foreground">
            {[
              { color: "#22c55e", label: "Normal (<80%)" },
              { color: "#f59e0b", label: "Warning (80-89%)" },
              { color: "#ef4444", label: "Critical (90%+)" },
              { color: "#3b82f6", label: "Active crew" },
              { color: "#94a3b8", label: "Planned route" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Tabs defaultValue="bins">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bins">Bins ({filteredBins.length})</TabsTrigger>
              <TabsTrigger value="crews">Crews ({crews.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="bins" className="mt-2 max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {filteredBins.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No bins found</p>
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
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-semibold">{bin.id}</span>
                      <span className="text-xs font-bold" style={{ color: binColor(bin.fill_level_percent) }}>
                        {bin.fill_level_percent}%
                      </span>
                    </div>
                    <p className="mb-1.5 flex items-center gap-0.5 text-xs text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      {bin.location}
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${bin.fill_level_percent}%`,
                          background: binColor(bin.fill_level_percent),
                        }}
                      />
                    </div>
                    {!bin.latitude && <p className="mt-1 text-xs text-amber-500">No coordinates</p>}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="crews" className="mt-2 max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {crews.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No crews found</p>
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
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">{crew.name}</span>
                      <Badge variant={crew.status === "active" ? "default" : "secondary"} className="text-xs">
                        {crew.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Leader: {crew.leader}</p>
                    <p className="text-xs text-muted-foreground">Members: {crew.members_count}</p>
                    {!crew.current_latitude && (
                      <p className="mt-1 text-xs text-amber-500">Location unknown</p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>

          {selected && (
            <Card>
              <CardHeader className="px-4 pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {selected.type === "bin" ? "Bin Detail" : "Crew Detail"}
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelected(null)}>
                    x
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                {selected.type === "bin" && (
                  <>
                    <p className="text-sm font-semibold">{selected.data.id}</p>
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
                          <p className="font-bold">{selected.data.temperature_c} C</p>
                        </div>
                      )}
                    </div>
                    {selected.data.latitude && selected.data.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${selected.data.latitude},${selected.data.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs text-primary hover:underline"
                      >
                        Open in Google Maps
                      </a>
                    )}
                  </>
                )}

                {selected.type === "crew" && (
                  <>
                    <p className="text-sm font-semibold">{selected.data.name}</p>
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
                      <p className="text-xs text-muted-foreground">Phone: {selected.data.phone}</p>
                    )}
                    {selected.data.current_latitude && selected.data.current_longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${selected.data.current_latitude},${selected.data.current_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-primary hover:underline"
                      >
                        Open in Google Maps
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
