"use client"

/**
 * components/bin-management.tsx
 *
 * Fixes:
 * 1. fetchBins(silent) — on silent polls, errors are silently swallowed so the
 *    UI doesn't flash toasts every 10s on transient network errors.
 *    On the initial load (silent=false) we DO show the toast.
 * 2. setInitialLoading(false) is now always called in the finally block even
 *    on silent polls, preventing the spinner from sticking if first load succeeds
 *    but a later poll throws before finally runs (race condition).
 * 3. statusFilter buttons use accessible aria-pressed.
 * 4. Edit/Delete dialogs pass onSuccess correctly.
 */

import { useEffect, useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { getBins, type Bin } from "@/lib/api-client"
import { mapBinStatus, getStatusColor, getStatusText, formatTimestamp } from "@/lib/status-mapper"
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

const POLL_INTERVAL = 10_000

export function BinManagementIntegrated() {
  const [bins, setBins] = useState<Bin[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()

  const fetchBins = useCallback(async (silent = false) => {
    try {
      const data = await getBins()
      setBins(data)
    } catch (error) {
      if (!silent) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load bins",
          variant: "destructive",
        })
      }
    } finally {
      // Always clear initial loading regardless of silent flag
      setInitialLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchBins(false)
    const interval = setInterval(() => fetchBins(true), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchBins])

  const filteredBins = useMemo(() =>
    bins.filter((bin) => {
      const q = searchTerm.toLowerCase()
      const matchesSearch =
        bin.id.toLowerCase().includes(q) ||
        bin.location.toLowerCase().includes(q)
      const mappedStatus = mapBinStatus(bin.status)
      const matchesStatus = statusFilter === "all" || mappedStatus === statusFilter
      return matchesSearch && matchesStatus
    }),
    [bins, searchTerm, statusFilter]
  )

  const stats = useMemo(() => ({
    total: bins.length,
    critical: bins.filter((b) => mapBinStatus(b.status) === "critical").length,
    warning: bins.filter((b) => mapBinStatus(b.status) === "warning").length,
    normal: bins.filter((b) => mapBinStatus(b.status) === "normal").length,
  }), [bins])

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bin Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time monitoring of waste collection bins
          </p>
        </div>
        <div className="flex gap-2">
          <AddBinDialog onSuccess={() => fetchBins(false)} />
          <Button onClick={() => fetchBins(false)} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
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
          <CardDescription>Live data from backend API</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search + filter row */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bins..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {["all", "critical", "warning", "normal", "offline"].map((f) => (
                <Button
                  key={f}
                  variant={statusFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(f)}
                  className="capitalize text-xs"
                  aria-pressed={statusFilter === f}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

          {filteredBins.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trash2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>{bins.length === 0 ? "No bins registered yet." : "No bins match your search."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBins.map((bin) => {
                const mappedStatus = mapBinStatus(bin.status)
                return (
                  <div
                    key={bin.id}
                    className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{bin.id}</div>
                        <div className="text-xs text-muted-foreground flex items-center mt-0.5">
                          <MapPin className="h-3 w-3 mr-1 shrink-0" />
                          <span className="truncate">{bin.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="flex flex-col items-center min-w-[60px]">
                        <div className="text-sm font-semibold">{bin.fill_level_percent}%</div>
                        <Progress value={bin.fill_level_percent} className="w-14 h-1.5 mt-1" />
                        <div className="text-xs text-muted-foreground mt-0.5">Fill</div>
                      </div>

                      {bin.battery_percent != null && (
                        <div className="hidden sm:flex items-center gap-1">
                          <Battery className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{bin.battery_percent}%</span>
                        </div>
                      )}

                      {bin.temperature_c != null && (
                        <div className="hidden md:flex items-center gap-1">
                          <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{bin.temperature_c}°C</span>
                        </div>
                      )}

                      {bin.humidity_percent != null && (
                        <div className="hidden lg:flex items-center gap-1">
                          <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{bin.humidity_percent}%</span>
                        </div>
                      )}

                      <Badge className={cn("text-xs", getStatusColor(mappedStatus))}>
                        {getStatusText(mappedStatus)}
                      </Badge>

                      {bin.last_telemetry && (
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {formatTimestamp(bin.last_telemetry)}
                        </span>
                      )}

                      <div className="flex gap-1">
                        <EditBinDialog bin={bin} onSuccess={() => fetchBins(true)} />
                        <DeleteBinDialog bin={bin} onSuccess={() => fetchBins(true)} />
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