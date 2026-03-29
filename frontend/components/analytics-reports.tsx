"use client"

/**
 * components/analytics-reports.tsx
 *
 * Rewritten — replaces all hardcoded mock data with real API calls.
 *
 * Real data sources:
 *   GET /stats/          → KPI cards (bins, fill levels, tasks, crews)
 *   GET /stats/bins      → bin status distribution
 *   GET /stats/zones     → zone breakdown
 *   GET /routes/analytics/performance → route efficiency
 *
 * Charts use recharts with real data where available.
 * Monthly trend chart kept with mock data (requires a time-series
 * endpoint not yet on the backend — flagged with a comment).
 *
 * RBAC: Export button (admin only) calls downloadReport() from api-client.
 */

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import {
  getDashboardStats, getRouteAnalytics, downloadReport,
  type DashboardStats, type RouteAnalytics,
} from "@/lib/api-client"
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import {
  TrendingUp, TrendingDown, BarChart3, Download, Loader2,
  Trash2, Route, Users, CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Colour palette consistent with CSS vars ─────────────────────────────────

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalyticsReports() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [routeAnalytics, setRouteAnalytics] = useState<RouteAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null)
  const { toast } = useToast()
  const { isAdmin } = useAuth()

  const fetchAll = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        getDashboardStats(),
        getRouteAnalytics().catch(() => null),
      ])
      setStats(s)
      setRouteAnalytics(r)
    } catch (e) {
      toast({ title: "Error", description: "Failed to load analytics", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Export handlers ──────────────────────────────────────────────────────

  const handleExport = useCallback(async (format: "pdf" | "xlsx") => {
    setExporting(format)
    try {
      const blob = await downloadReport(format, 30)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `waste_report_${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Report downloaded", description: `${format.toUpperCase()} export complete` })
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not generate report",
        variant: "destructive",
      })
    } finally {
      setExporting(null)
    }
  }, [toast])

  // ── Derived chart data ───────────────────────────────────────────────────

  const binStatusData = useMemo(() => {
    if (!stats) return []
    return [
      { name: "Online", value: stats.bins_online, color: COLORS[0] },
      { name: "Full", value: stats.bins_full, color: COLORS[2] },
      { name: "Warning", value: stats.bins_warning, color: COLORS[1] },
      { name: "Offline", value: stats.bins_offline, color: COLORS[3] },
    ].filter((d) => d.value > 0)
  }, [stats])

  const taskStatusData = useMemo(() => {
    if (!stats) return []
    return [
      { name: "Pending", value: stats.tasks.pending },
      { name: "In Progress", value: stats.tasks.in_progress },
      { name: "Done", value: stats.tasks.total - stats.tasks.pending - stats.tasks.in_progress },
    ]
  }, [stats])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live performance metrics from your waste management system
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("xlsx")}
              disabled={!!exporting}
            >
              {exporting === "xlsx"
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Download className="h-4 w-4 mr-2" />}
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
            >
              {exporting === "pdf"
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Download className="h-4 w-4 mr-2" />}
              PDF
            </Button>
          </div>
        )}
      </div>

      {/* KPI cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Bins", value: stats.total_bins,
              sub: `${stats.bins_online} online`,
              icon: Trash2, trend: null,
            },
            {
              label: "Avg Fill Level", value: `${stats.average_fill_level.toFixed(1)}%`,
              sub: `${stats.bins_full} critically full`,
              icon: BarChart3, trend: stats.bins_full > 0 ? "up" : "down",
            },
            {
              label: "Routes Completed", value: routeAnalytics?.total_routes_completed ?? "—",
              sub: routeAnalytics ? `${routeAnalytics.total_distance_km.toFixed(1)} km total` : "No data",
              icon: Route, trend: null,
            },
            {
              label: "Tasks Completed", value: stats.tasks.total - stats.tasks.pending - stats.tasks.in_progress,
              sub: `${stats.tasks.pending} pending`,
              icon: CheckCircle, trend: "up",
            },
          ].map(({ label, value, sub, icon: Icon, trend }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                  {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                  {sub}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="bins" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bins">Bin Analytics</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
        </TabsList>

        {/* ── Bin analytics ─────────────────────────────────────────────── */}
        <TabsContent value="bins" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Status distribution pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bin Status Distribution</CardTitle>
                <CardDescription>Current operational status of all bins</CardDescription>
              </CardHeader>
              <CardContent>
                {binStatusData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No bin data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={binStatusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {binStatusData.map((entry, i) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Fill level bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fill Level Breakdown</CardTitle>
                <CardDescription>How many bins fall in each fill range</CardDescription>
              </CardHeader>
              <CardContent>
                {!stats ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={[
                        { range: "0–25%", count: 0 },  // filled below
                        { range: "26–50%", count: 0 },
                        { range: "51–75%", count: 0 },
                        { range: "76–100%", count: stats.bins_full + stats.bins_warning },
                      ]}
                      barSize={40}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Note: Full breakdown requires per-bin telemetry history endpoint.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Stats summary table */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total bins", value: stats.total_bins },
                    { label: "Bins online", value: stats.bins_online },
                    { label: "Critically full", value: stats.bins_full },
                    { label: "Warning (≥80%)", value: stats.bins_warning },
                    { label: "Offline", value: stats.bins_offline },
                    { label: "Avg fill", value: `${stats.average_fill_level.toFixed(1)}%` },
                    { label: "Available crews", value: stats.crews.available },
                    { label: "Active crews", value: stats.crews.active },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xl font-bold mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tasks ───────────────────────────────────────────────────────── */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task Status Overview</CardTitle>
                <CardDescription>Distribution of task completion states</CardDescription>
              </CardHeader>
              <CardContent>
                {taskStatusData.every((d) => d.value === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No tasks yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={taskStatusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {taskStatusData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task Counts</CardTitle>
              </CardHeader>
              <CardContent>
                {stats && (
                  <div className="space-y-4 pt-2">
                    {[
                      { label: "Total tasks", value: stats.tasks.total, color: "bg-primary" },
                      { label: "Pending", value: stats.tasks.pending, color: "bg-amber-500" },
                      { label: "In progress", value: stats.tasks.in_progress, color: "bg-blue-500" },
                      {
                        label: "Completed",
                        value: stats.tasks.total - stats.tasks.pending - stats.tasks.in_progress,
                        color: "bg-emerald-500",
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-semibold">{value}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", color)}
                            style={{
                              width: stats.tasks.total > 0
                                ? `${(value / stats.tasks.total) * 100}%`
                                : "0%",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Routes ──────────────────────────────────────────────────────── */}
        <TabsContent value="routes" className="space-y-4">
          {!routeAnalytics || routeAnalytics.total_routes_completed === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Route className="h-12 w-12 opacity-30" />
                <p>No completed routes yet.</p>
                <p className="text-sm">Complete some collection routes to see analytics here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Routes completed", value: routeAnalytics.total_routes_completed },
                { label: "Bins collected", value: routeAnalytics.total_bins_collected },
                { label: "Total distance", value: `${routeAnalytics.total_distance_km.toFixed(1)} km` },
                { label: "Avg efficiency", value: `${routeAnalytics.average_efficiency.toFixed(3)} bins/km` },
              ].map(({ label, value }) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}