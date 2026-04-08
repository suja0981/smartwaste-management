"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ElementType, ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { getBins, type Bin } from "@/lib/api-client"
import { mergeRealtimeBinUpdates, useRealtimeBinsContext } from "@/hooks/useRealtimeBins"
import { mapBinStatus, getStatusColor, getStatusText, formatTimestamp } from "@/lib/status-mapper"
import { Trash2, AlertTriangle, Activity, MapPin, Loader2, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

const POLL_INTERVAL = 60_000

interface BinDataCtx {
  bins: Bin[]
  initialLoading: boolean
  realtimeConnected: boolean
  refresh: () => void
}

const BinDataContext = createContext<BinDataCtx>({
  bins: [],
  initialLoading: true,
  realtimeConnected: false,
  refresh: () => {},
})

export function BinDataProvider({ children }: { children: ReactNode }) {
  const seenAlerts = useRef<Set<string>>(new Set())
  const { toast } = useToast()
  const { binUpdates, connected, alertQueue, dismissAlert } = useRealtimeBinsContext()

  const { data: fetchedBins = [], isLoading: initialLoading, refetch } = useQuery({
    queryKey: ["bins"],
    queryFn: () => getBins(),
    refetchInterval: POLL_INTERVAL,
    staleTime: 15_000,
  })

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

  return (
    <BinDataContext.Provider
      value={{ bins: displayBins, initialLoading, realtimeConnected: connected, refresh: refetch }}
    >
      {children}
    </BinDataContext.Provider>
  )
}

function useBinData() {
  return useContext(BinDataContext)
}

interface StatCardProps {
  label: string
  value: string | number
  sub: string
  icon: ElementType
  accent: "blue" | "red" | "green" | "purple"
}

const accentMap = {
  blue: {
    bg: "bg-sky-50 dark:bg-sky-950/40",
    icon: "text-sky-600 dark:text-sky-400",
    val: "text-sky-700 dark:text-sky-300",
  },
  red: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    icon: "text-rose-600 dark:text-rose-400",
    val: "text-rose-700 dark:text-rose-300",
  },
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    icon: "text-emerald-600 dark:text-emerald-400",
    val: "text-emerald-700 dark:text-emerald-300",
  },
  purple: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    icon: "text-violet-600 dark:text-violet-400",
    val: "text-violet-700 dark:text-violet-300",
  },
}

function StatCard({ label, value, sub, icon: Icon, accent }: StatCardProps) {
  const colors = accentMap[accent]

  return (
    <div className={cn("rounded-xl p-4 flex items-start gap-3", colors.bg)}>
      <div className={cn("mt-0.5 rounded-lg bg-white/70 p-2 shadow-sm dark:bg-black/20", colors.icon)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("mt-0.5 text-2xl font-bold leading-none", colors.val)}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

export function ModernDashboardStats() {
  const { bins, initialLoading, realtimeConnected } = useBinData()

  const stats = useMemo(
    () => ({
      binsOnline: bins.filter((bin) => bin.status !== "offline").length,
      total: bins.length,
      critical: bins.filter((bin) => mapBinStatus(bin.status) === "critical").length,
      avgFill:
        bins.length > 0
          ? Math.round(bins.reduce((sum, bin) => sum + bin.fill_level_percent, 0) / bins.length)
          : 0,
    }),
    [bins]
  )

  if (initialLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-[88px] animate-pulse rounded-xl bg-muted/50 p-4" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Bins Online"
        value={stats.binsOnline}
        sub={`of ${stats.total} total`}
        icon={Trash2}
        accent="blue"
      />
      <StatCard
        label="Critical Bins"
        value={stats.critical}
        sub="need collection"
        icon={AlertTriangle}
        accent="red"
      />
      <StatCard
        label="System Health"
        value={realtimeConnected ? "Live" : "Fallback"}
        sub={realtimeConnected ? "websocket connected" : "minute refresh active"}
        icon={Activity}
        accent="green"
      />
      <StatCard
        label="Avg Fill Level"
        value={`${stats.avgFill}%`}
        sub="across all bins"
        icon={Shield}
        accent="purple"
      />
    </div>
  )
}

export function ModernBinStatus() {
  const { bins, initialLoading, realtimeConnected } = useBinData()

  const topBins = useMemo(
    () => [...bins].sort((left, right) => right.fill_level_percent - left.fill_level_percent).slice(0, 6),
    [bins]
  )

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Live Bin Status</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {realtimeConnected
                ? "Live feed connected and sorted by fill level"
                : "Auto-refreshing every minute and sorted by fill level"}
            </CardDescription>
          </div>
          <Badge variant={realtimeConnected ? "default" : "secondary"} className="text-[11px]">
            {realtimeConnected ? "Live" : "Fallback"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : topBins.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Trash2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No bins registered yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topBins.map((bin) => {
              const mappedStatus = mapBinStatus(bin.status)

              return (
                <div
                  key={bin.id}
                  className="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "rounded-md p-1.5",
                          mappedStatus === "critical"
                            ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                            : mappedStatus === "warning"
                              ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{bin.id}</p>
                        <p className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <MapPin className="h-2.5 w-2.5" />
                          {bin.location}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("text-xs", getStatusColor(mappedStatus))}>
                      {getStatusText(mappedStatus)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Fill level</span>
                      <span className="font-semibold">{bin.fill_level_percent}%</span>
                    </div>
                    <Progress value={bin.fill_level_percent} className="h-1.5" />
                  </div>
                  {bin.last_telemetry && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Updated {formatTimestamp(bin.last_telemetry)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-4">
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href="/bins">View all bins</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
