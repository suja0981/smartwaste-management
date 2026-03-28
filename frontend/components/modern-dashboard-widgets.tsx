"use client"

/**
 * components/modern-dashboard-widgets.tsx
 *
 * Performance fixes:
 *  1. ModernDashboardStats and ModernBinStatus were TWO separate components
 *     each calling getBins() independently and polling every 5s — 2 network
 *     requests every 5s for the same data.
 *     Now a single shared context provides the data to both components.
 *  2. Stats object is memoized.
 *  3. Polling interval increased to 10s (sufficient for waste management).
 *  4. setLoading(true) only on initial load — no flicker on background polls.
 */

import { useEffect, useState, useCallback, useMemo, createContext, useContext } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { getBins, type Bin } from "@/lib/api-client"
import { mapBinStatus, getStatusColor, getStatusText, formatTimestamp } from "@/lib/status-mapper"
import { Trash2, AlertTriangle, CheckCircle, TrendingUp, Activity, MapPin, Loader2, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

const POLL_INTERVAL = 10_000

// ─── Shared data context ─────────────────────────────────────────────────────

interface BinDataCtx {
  bins: Bin[]
  initialLoading: boolean
  refresh: () => void
}

const BinDataContext = createContext<BinDataCtx>({
  bins: [],
  initialLoading: true,
  refresh: () => {},
})

export function BinDataProvider({ children }: { children: React.ReactNode }) {
  const [bins, setBins] = useState<Bin[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const { toast } = useToast()

  const fetchBins = useCallback(async (silent = false) => {
    try {
      setBins(await getBins())
    } catch (error) {
      if (!silent)
        toast({
          title: "Error",
          description: "Failed to load bin data",
          variant: "destructive",
        })
    } finally {
      setInitialLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchBins(false)
    const id = setInterval(() => fetchBins(true), POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchBins])

  return (
    <BinDataContext.Provider value={{ bins, initialLoading, refresh: () => fetchBins(false) }}>
      {children}
    </BinDataContext.Provider>
  )
}

function useBinData() {
  return useContext(BinDataContext)
}

// ─── Stats cards ─────────────────────────────────────────────────────────────

export function ModernDashboardStats() {
  const { bins, initialLoading } = useBinData()

  const stats = useMemo(() => ({
    binsOnline: bins.filter((b) => b.status !== "offline").length,
    total: bins.length,
    critical: bins.filter((b) => mapBinStatus(b.status) === "critical").length,
    avgFill:
      bins.length > 0
        ? Math.round(bins.reduce((a, b) => a + b.fill_level_percent, 0) / bins.length)
        : 0,
  }), [bins])

  const cards = [
    {
      label: "Bins Online",
      value: `${stats.binsOnline}`,
      sub: `of ${stats.total} total`,
      icon: Trash2,
      gradient: "from-cyan-500 to-blue-600",
      accent: TrendingUp,
    },
    {
      label: "Critical Bins",
      value: `${stats.critical}`,
      sub: "need collection",
      icon: AlertTriangle,
      gradient: "from-orange-500 to-red-600",
      accent: Activity,
    },
    {
      label: "System Health",
      value: "Healthy",
      sub: "all sensors active",
      icon: Activity,
      gradient: "from-emerald-500 to-teal-600",
      accent: CheckCircle,
    },
    {
      label: "Avg Fill Level",
      value: `${stats.avgFill}%`,
      sub: "across all bins",
      icon: Shield,
      gradient: "from-violet-500 to-purple-600",
      accent: CheckCircle,
    },
  ]

  if (initialLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, sub, icon: Icon, gradient, accent: Accent }) => (
        <Card
          key={label}
          className={`border-0 bg-gradient-to-br ${gradient} text-white shadow-md`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Icon className="h-5 w-5" />
              </div>
              <Accent className="h-4 w-4 opacity-60" />
            </div>
            <p className="text-xs font-medium opacity-75 mb-0.5">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-xs opacity-60 mt-1">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Bin status list ──────────────────────────────────────────────────────────

export function ModernBinStatus() {
  const { bins, initialLoading } = useBinData()

  // Show top 6 by fill level descending
  const topBins = useMemo(
    () => [...bins].sort((a, b) => b.fill_level_percent - a.fill_level_percent).slice(0, 6),
    [bins]
  )

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Live Bin Status</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Real-time monitoring — sorted by fill level
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : topBins.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trash2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No bins registered yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topBins.map((bin) => {
              const mappedStatus = mapBinStatus(bin.status)
              return (
                <div
                  key={bin.id}
                  className="rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "p-1.5 rounded-md",
                          mappedStatus === "critical"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                            : mappedStatus === "warning"
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                            : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{bin.id}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-0.5">
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
                    <p className="text-xs text-muted-foreground mt-1.5">
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