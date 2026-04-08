"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { assignBinZone, getBins, type Bin } from "@/lib/api-client"
import { mergeRealtimeBinUpdates, useRealtimeBinsContext } from "@/hooks/useRealtimeBins"
import { mapBinStatus, getStatusColor, getStatusText, formatTimestamp } from "@/lib/status-mapper"
import { buildZoneOptions, getZoneLabel, UNASSIGNED_ZONE } from "@/lib/zone-utils"
import {
  Search,
  MapPin,
  Battery,
  Thermometer,
  Droplets,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AddBinDialog } from "./add-bin-dialog"
import { EditBinDialog } from "./edit-bin-dialog"
import { DeleteBinDialog } from "./delete-bin-dialog"

const POLL_INTERVAL = 60_000

export function BinManagementIntegrated() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [zoneFilter, setZoneFilter] = useState("all")
  const [updatingZoneId, setUpdatingZoneId] = useState<string | null>(null)
  const seenAlerts = useRef<Set<string>>(new Set())
  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const { binUpdates, connected, alertQueue, dismissAlert } = useRealtimeBinsContext()

  // ── TanStack Query: handles fetch, polling, loading & error state ──────────
  const queryZone = zoneFilter === "all" ? undefined : zoneFilter
  const { data: fetchedBins = [], isLoading: initialLoading, isFetching, refetch } = useQuery({
    queryKey: ["bins", queryZone],
    queryFn: () => getBins(queryZone),
    refetchInterval: POLL_INTERVAL,
    staleTime: 15_000,
  })

  // ── Display bins: fresh API data merged with live WebSocket updates ─────────
  const [displayBins, setDisplayBins] = useState<Bin[]>(fetchedBins)

  // Single effect: always derive from the authoritative fetchedBins, then apply
  // any realtime deltas on top. Two separate effects had a write-order race
  // where a fetchedBins update would overwrite binUpdates-merged state.
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

  const filteredBins = useMemo(
    () =>
      displayBins.filter((bin) => {
        const query = searchTerm.toLowerCase()
        const matchesSearch =
          bin.id.toLowerCase().includes(query) || bin.location.toLowerCase().includes(query)
        const mappedStatus = mapBinStatus(bin.status)
        const matchesStatus = statusFilter === "all" || mappedStatus === statusFilter
        return matchesSearch && matchesStatus
      }),
    [displayBins, searchTerm, statusFilter]
  )

  const zoneOptions = useMemo(
    () => buildZoneOptions(displayBins.map((bin) => bin.zone_id)),
    [displayBins]
  )

  const stats = useMemo(
    () => ({
      total: displayBins.length,
      critical: displayBins.filter((bin) => mapBinStatus(bin.status) === "critical").length,
      warning: displayBins.filter((bin) => mapBinStatus(bin.status) === "warning").length,
      normal: displayBins.filter((bin) => mapBinStatus(bin.status) === "normal").length,
    }),
    [displayBins]
  )

  const handleZoneAssignment = useCallback(
    async (binId: string, nextZone: string) => {
      setUpdatingZoneId(binId)
      try {
        await assignBinZone(binId, nextZone === UNASSIGNED_ZONE ? undefined : nextZone)
        // Optimistic update — refetch will confirm from server
        setDisplayBins((currentBins) =>
          currentBins.map((bin) =>
            bin.id === binId
              ? { ...bin, zone_id: nextZone === UNASSIGNED_ZONE ? undefined : nextZone }
              : bin
          )
        )
        toast({
          title: "Zone updated",
          description:
            nextZone === UNASSIGNED_ZONE
              ? `Removed ${binId} from any assigned zone.`
              : `${binId} is now assigned to ${getZoneLabel(nextZone)}.`,
        })
      } catch (error) {
        toast({
          title: "Zone update failed",
          description: error instanceof Error ? error.message : "Could not update the bin zone.",
          variant: "destructive",
        })
      } finally {
        setUpdatingZoneId(null)
      }
    },
    [toast]
  )

  if (initialLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Bin Management</h2>
            <Badge variant={connected ? "default" : "secondary"} className="text-[11px]">
              {connected ? "Live feed" : "Fallback refresh"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {connected
              ? "Realtime monitoring with automatic fallback refresh."
              : "Monitoring bins with automatic minute refresh while the live feed reconnects."}
          </p>
        </div>
        <div className="flex gap-2">
          <AddBinDialog onSuccess={() => refetch()} />
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Bins", value: stats.total, icon: Trash2, color: "text-muted-foreground" },
          { label: "Critical", value: stats.critical, icon: AlertTriangle, color: "text-destructive" },
          { label: "Warning", value: stats.warning, icon: Clock, color: "text-amber-500" },
          { label: "Normal", value: stats.normal, icon: CheckCircle, color: "text-emerald-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={cn("h-4 w-4", color)} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", color)}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bin Overview</CardTitle>
          <CardDescription>
            {connected ? "Live updates are applied instantly." : "Live socket disconnected, using API refresh."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bins..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All zones</SelectItem>
                <SelectItem value={UNASSIGNED_ZONE}>Unassigned only</SelectItem>
                {zoneOptions.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {getZoneLabel(zone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {["all", "critical", "warning", "normal", "offline"].map((filterValue) => (
                <Button
                  key={filterValue}
                  variant={statusFilter === filterValue ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filterValue)}
                  className="capitalize text-xs"
                  aria-pressed={statusFilter === filterValue}
                >
                  {filterValue}
                </Button>
              ))}
            </div>
          </div>

          {filteredBins.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Trash2 className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p>{displayBins.length === 0 ? "No bins registered yet." : "No bins match your search."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBins.map((bin) => {
                const mappedStatus = mapBinStatus(bin.status)

                return (
                  <div
                    key={bin.id}
                    className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="font-semibold text-sm">{bin.id}</div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <MapPin className="mr-1 h-3 w-3 shrink-0" />
                        <span className="truncate">{bin.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px]">
                          {getZoneLabel(bin.zone_id)}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-4">
                      <div className="flex min-w-[60px] flex-col items-center">
                        <div className="text-sm font-semibold">{bin.fill_level_percent}%</div>
                        <Progress value={bin.fill_level_percent} className="mt-1 h-1.5 w-14" />
                        <div className="mt-0.5 text-xs text-muted-foreground">Fill</div>
                      </div>

                      {bin.battery_percent != null && (
                        <div className="hidden items-center gap-1 sm:flex">
                          <Battery className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{bin.battery_percent}%</span>
                        </div>
                      )}

                      {bin.temperature_c != null && (
                        <div className="hidden items-center gap-1 md:flex">
                          <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{bin.temperature_c} C</span>
                        </div>
                      )}

                      {bin.humidity_percent != null && (
                        <div className="hidden items-center gap-1 lg:flex">
                          <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{bin.humidity_percent}%</span>
                        </div>
                      )}

                      <Badge className={cn("text-xs", getStatusColor(mappedStatus))}>
                        {getStatusText(mappedStatus)}
                      </Badge>

                      {bin.last_telemetry && (
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {formatTimestamp(bin.last_telemetry)}
                        </span>
                      )}

                      {isAdmin && (
                        <Select
                          value={bin.zone_id || UNASSIGNED_ZONE}
                          onValueChange={(value) => handleZoneAssignment(bin.id, value)}
                          disabled={updatingZoneId === bin.id}
                        >
                          <SelectTrigger className="hidden h-8 w-[150px] text-xs md:flex">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED_ZONE}>Unassigned</SelectItem>
                            {zoneOptions.map((zone) => (
                              <SelectItem key={zone} value={zone}>
                                {getZoneLabel(zone)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <div className="flex gap-1">
                        <EditBinDialog bin={bin} onSuccess={() => refetch()} />
                        <DeleteBinDialog bin={bin} onSuccess={() => refetch()} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
