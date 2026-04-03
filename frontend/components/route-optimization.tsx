"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  compareRoutes,
  deleteRoute,
  getBins,
  getCrews,
  getRouteAnalytics,
  getRoutes,
  optimizeRoute,
  updateRouteStatus,
  type Bin,
  type Crew,
  type Route,
  type RouteAnalytics,
} from "@/lib/api-client"
import { buildZoneOptions, getZoneLabel, UNASSIGNED_ZONE } from "@/lib/zone-utils"
import {
  BarChart3,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Pause,
  Play,
  Route as RouteIcon,
  Square,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

type RouteAction = "active" | "paused" | "completed" | "cancelled"

function getAlgorithmInfo(algorithm: string) {
  const info: Record<string, { name: string; description: string; color: string }> = {
    greedy: {
      name: "Greedy",
      description: "Fast nearest-neighbor route creation",
      color: "bg-blue-500",
    },
    priority: {
      name: "Priority",
      description: "Favours critical bins first",
      color: "bg-orange-500",
    },
    hybrid: {
      name: "Hybrid",
      description: "Balanced distance and urgency optimization",
      color: "bg-emerald-500",
    },
    two_opt: {
      name: "2-Opt",
      description: "Refines the route for shorter travel distance",
      color: "bg-violet-500",
    },
  }

  return info[algorithm] || info.hybrid
}

function getRouteProgress(route: Route) {
  const totalWaypoints = route.waypoints.length
  const completedWaypoints = route.waypoints.filter((waypoint) => waypoint.done).length
  const progressPercent = totalWaypoints > 0 ? Math.round((completedWaypoints / totalWaypoints) * 100) : 0

  return { totalWaypoints, completedWaypoints, progressPercent }
}

function routeStatusBadge(route: Route) {
  switch (route.status) {
    case "active":
      return <Badge>Active</Badge>
    case "paused":
      return <Badge className="bg-amber-500 hover:bg-amber-500">Paused</Badge>
    case "planned":
      return <Badge variant="secondary">Planned</Badge>
    case "completed":
      return <Badge className="bg-emerald-500 hover:bg-emerald-500">Completed</Badge>
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>
    default:
      return <Badge variant="outline">{route.status || "unknown"}</Badge>
  }
}

export function RouteOptimization() {
  const [bins, setBins] = useState<Bin[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [zoneFilter, setZoneFilter] = useState("all")
  const [selectedBins, setSelectedBins] = useState<string[]>([])
  const [selectedCrew, setSelectedCrew] = useState("")
  const [algorithm, setAlgorithm] = useState("hybrid")
  const [optimizedRoute, setOptimizedRoute] = useState<Route | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [analytics, setAnalytics] = useState<RouteAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [routeActionId, setRouteActionId] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      const zoneId = zoneFilter === "all" ? undefined : zoneFilter
      const [binsData, crewsData, routesData, analyticsData] = await Promise.all([
        getBins(zoneId),
        getCrews(zoneId),
        getRoutes().catch(() => []),
        getRouteAnalytics().catch(() => null),
      ])
      setBins(binsData)
      setCrews(crewsData)
      setRoutes(routesData)
      setAnalytics(analyticsData)
    } catch (error) {
      toast({
        title: "Could not load routes",
        description: error instanceof Error ? error.message : "Failed to load route data",
        variant: "destructive",
      })
    }
  }, [toast, zoneFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setSelectedBins((currentSelection) =>
      currentSelection.filter((binId) => bins.some((bin) => bin.id === binId))
    )
  }, [bins])

  useEffect(() => {
    if (!selectedCrew) return
    if (!crews.some((crew) => crew.id === selectedCrew)) {
      setSelectedCrew("")
    }
  }, [crews, selectedCrew])

  const handleOptimize = async () => {
    if (selectedBins.length < 2) {
      toast({
        title: "Select bins",
        description: "Please select at least 2 bins to optimize a route.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const route = await optimizeRoute({
        bin_ids: selectedBins,
        crew_id: selectedCrew || undefined,
        algorithm: algorithm as "greedy" | "priority" | "hybrid" | "two_opt",
        save_route: true,
      })

      setOptimizedRoute(route)
      await fetchData()
      toast({
        title: "Route saved",
        description: `Created a ${route.algorithm} route for ${route.bin_count} bins.`,
      })
    } catch (error) {
      toast({
        title: "Optimization failed",
        description: error instanceof Error ? error.message : "Could not optimize the route.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCompare = async () => {
    if (selectedBins.length < 2) {
      toast({
        title: "Select bins",
        description: "Please select at least 2 bins to compare algorithms.",
        variant: "destructive",
      })
      return
    }

    setComparing(true)
    try {
      const comparison = await compareRoutes(selectedBins)
      const bestRoute = comparison.algorithms.find((route) => route.algorithm === comparison.recommended)
      if (bestRoute) {
        setOptimizedRoute(bestRoute)
      }
      toast({
        title: "Comparison complete",
        description: `Recommended algorithm: ${comparison.recommended.toUpperCase()}.`,
      })
    } catch (error) {
      toast({
        title: "Comparison failed",
        description: error instanceof Error ? error.message : "Could not compare route algorithms.",
        variant: "destructive",
      })
    } finally {
      setComparing(false)
    }
  }

  const handleRouteAction = async (routeId: string, action: RouteAction) => {
    setRouteActionId(routeId)
    try {
      await updateRouteStatus(routeId, action)
      await fetchData()
      toast({
        title: "Route updated",
        description:
          action === "active"
            ? "Route is active and crew tasks were synced."
            : action === "paused"
              ? "Route paused and route tasks moved back to pending."
            : action === "completed"
              ? "Route marked complete and history refreshed."
              : "Route cancelled.",
      })
    } catch (error) {
      toast({
        title: "Route update failed",
        description: error instanceof Error ? error.message : "Could not update route status.",
        variant: "destructive",
      })
    } finally {
      setRouteActionId(null)
    }
  }

  const handleDeleteRoute = async (routeId: string) => {
    setRouteActionId(routeId)
    try {
      await deleteRoute(routeId)
      await fetchData()
      toast({
        title: "Route deleted",
        description: "The saved route has been removed.",
      })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete the route.",
        variant: "destructive",
      })
    } finally {
      setRouteActionId(null)
    }
  }

  const toggleBinSelection = (binId: string) => {
    setSelectedBins((current) =>
      current.includes(binId) ? current.filter((id) => id !== binId) : [...current, binId]
    )
  }

  const algorithmInfo = getAlgorithmInfo(algorithm)
  const zoneOptions = useMemo(
    () => buildZoneOptions([...bins.map((bin) => bin.zone_id), ...crews.map((crew) => crew.zone_id)]),
    [bins, crews]
  )
  const activeOrPlannedRoutes = useMemo(
    () => routes.filter((route) => route.status === "planned" || route.status === "active" || route.status === "paused"),
    [routes]
  )
  const historicalRoutes = useMemo(
    () => routes.filter((route) => route.status === "completed" || route.status === "cancelled"),
    [routes]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Route Optimization</h2>
          <p className="text-muted-foreground">
            Plan routes, start them for crews, and track completion from one place.
          </p>
        </div>
        <Badge className="border-violet-500/20 bg-violet-500/10 text-violet-600">
          <Zap className="mr-1 h-3 w-3" />
          4 Algorithms
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-[190px]">
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
        <p className="text-sm text-muted-foreground">
          {zoneFilter === "all"
            ? "Showing bins and crews across the full network."
            : `Planning routes for ${getZoneLabel(zoneFilter)}.`}
        </p>
      </div>

      {analytics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Routes Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.total_routes_completed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
              <Navigation className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.total_distance_km.toFixed(1)} km</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Efficiency</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.average_efficiency.toFixed(3)} bins/km</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.average_time_minutes.toFixed(1)} min</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="create" className="space-y-4">
        <TabsList>
          <TabsTrigger value="create">Create Route</TabsTrigger>
          <TabsTrigger value="routes">Route Operations</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Route Configuration</CardTitle>
                  <CardDescription>Select bins and optimization settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Algorithm</label>
                    <Select value={algorithm} onValueChange={setAlgorithm}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="greedy">Greedy</SelectItem>
                        <SelectItem value="priority">Priority</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="two_opt">2-Opt</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="mt-2 rounded-lg bg-muted/50 p-3">
                      <div
                        className={cn(
                          "mb-1 inline-block rounded px-2 py-1 text-xs font-medium text-white",
                          algorithmInfo.color
                        )}
                      >
                        {algorithmInfo.name}
                      </div>
                      <p className="text-xs text-muted-foreground">{algorithmInfo.description}</p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Assign to Crew</label>
                    <Select value={selectedCrew} onValueChange={setSelectedCrew}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select crew" />
                      </SelectTrigger>
                      <SelectContent>
                        {crews.map((crew) => (
                          <SelectItem key={crew.id} value={crew.id}>
                            {crew.name} ({getZoneLabel(crew.zone_id)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Button onClick={handleOptimize} disabled={loading || selectedBins.length < 2} className="w-full">
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      Optimize and Save
                    </Button>

                    <Button
                      onClick={handleCompare}
                      disabled={comparing || selectedBins.length < 2}
                      variant="outline"
                      className="w-full"
                    >
                      {comparing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <BarChart3 className="mr-2 h-4 w-4" />
                      )}
                      Compare Algorithms
                    </Button>
                  </div>

                  <div className="border-t pt-4 text-sm text-muted-foreground">
                    {selectedBins.length} bin{selectedBins.length === 1 ? "" : "s"} selected
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Select Bins</CardTitle>
                  <CardDescription>Choose the bins you want in this route.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid max-h-[400px] gap-2 overflow-y-auto md:grid-cols-2">
                    {bins.map((bin) => (
                      <div
                        key={bin.id}
                        onClick={() => toggleBinSelection(bin.id)}
                        className={cn(
                          "cursor-pointer rounded-lg border p-3 transition-all",
                          selectedBins.includes(bin.id)
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm">{bin.id}</p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {bin.location}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Zone: {getZoneLabel(bin.zone_id)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{bin.fill_level_percent}%</p>
                            <p className="text-xs text-muted-foreground">Fill</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {optimizedRoute && (
                <Card className="border-2 border-primary">
                  <CardHeader className="bg-primary/5">
                    <CardTitle className="flex items-center gap-2">
                      <RouteIcon className="h-5 w-5" />
                      Optimized Route
                    </CardTitle>
                    <CardDescription>
                      Best current result using the {optimizedRoute.algorithm} algorithm.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="mb-6 grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{optimizedRoute.total_distance_km.toFixed(2)} km</p>
                        <p className="text-xs text-muted-foreground">Total Distance</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{optimizedRoute.estimated_time_minutes.toFixed(1)} min</p>
                        <p className="text-xs text-muted-foreground">Estimated Time</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{optimizedRoute.efficiency_score.toFixed(3)}</p>
                        <p className="text-xs text-muted-foreground">Efficiency</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {optimizedRoute.waypoints.map((waypoint) => (
                        <div key={`${waypoint.bin_id}-${waypoint.order}`} className="flex items-center gap-3 rounded-lg border p-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                            {waypoint.order}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{waypoint.bin_id}</p>
                            <p className="text-xs text-muted-foreground">
                              Fill {waypoint.fill_level}% and about {waypoint.estimated_collection_time} min
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="routes">
          <Card>
            <CardHeader>
              <CardTitle>Route Operations</CardTitle>
              <CardDescription>Start, pause, resume, complete, and review live route progress.</CardDescription>
            </CardHeader>
            <CardContent>
              {activeOrPlannedRoutes.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <RouteIcon className="mx-auto mb-3 h-12 w-12 opacity-50" />
                  <p>No planned, active, or paused routes right now.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeOrPlannedRoutes.map((route) => {
                    const progress = getRouteProgress(route)
                    const actionBusy = routeActionId === route.id

                    return (
                      <div key={route.id} className="rounded-xl border p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{route.route_id || route.id}</h4>
                              {routeStatusBadge(route)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {route.algorithm} algorithm
                              {route.crew_id ? ` and crew ${route.crew_id}` : " with no assigned crew yet"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {route.status === "planned" && (
                              <Button
                                size="sm"
                                onClick={() => handleRouteAction(route.id!, "active")}
                                disabled={actionBusy}
                              >
                                {actionBusy ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="mr-2 h-4 w-4" />
                                )}
                                Start Route
                              </Button>
                            )}
                            {route.status === "paused" && (
                              <Button
                                size="sm"
                                onClick={() => handleRouteAction(route.id!, "active")}
                                disabled={actionBusy}
                              >
                                {actionBusy ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="mr-2 h-4 w-4" />
                                )}
                                Resume Route
                              </Button>
                            )}
                            {route.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRouteAction(route.id!, "paused")}
                                disabled={actionBusy}
                              >
                                {actionBusy ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Pause className="mr-2 h-4 w-4" />
                                )}
                                Pause Route
                              </Button>
                            )}
                            {(route.status === "active" || route.status === "paused") && (
                              <Button
                                size="sm"
                                onClick={() => handleRouteAction(route.id!, "completed")}
                                disabled={actionBusy}
                              >
                                {actionBusy ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                )}
                                Complete Route
                              </Button>
                            )}
                            {route.status !== "completed" && route.status !== "cancelled" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRouteAction(route.id!, "cancelled")}
                                disabled={actionBusy}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel
                              </Button>
                            )}
                            {route.status === "planned" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteRoute(route.id!)}
                                disabled={actionBusy}
                              >
                                <Square className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="rounded-lg bg-muted p-3">
                            <p className="text-xs text-muted-foreground">Distance</p>
                            <p className="text-lg font-semibold">{route.total_distance_km.toFixed(2)} km</p>
                          </div>
                          <div className="rounded-lg bg-muted p-3">
                            <p className="text-xs text-muted-foreground">Estimated Time</p>
                            <p className="text-lg font-semibold">{route.estimated_time_minutes.toFixed(1)} min</p>
                          </div>
                          <div className="rounded-lg bg-muted p-3">
                            <p className="text-xs text-muted-foreground">Waypoints</p>
                            <p className="text-lg font-semibold">
                              {progress.completedWaypoints}/{progress.totalWaypoints}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted p-3">
                            <p className="text-xs text-muted-foreground">Progress</p>
                            <p className="text-lg font-semibold">{progress.progressPercent}%</p>
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          {route.waypoints.map((waypoint) => (
                            <div
                              key={`${route.id}-${waypoint.bin_id}-${waypoint.order}`}
                              className="flex items-center justify-between rounded-lg border p-2.5"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                  {waypoint.order}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{waypoint.bin_id}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {waypoint.location || "Route waypoint"} and {waypoint.fill_level}% fill
                                  </p>
                                </div>
                              </div>
                              <Badge variant={waypoint.done ? "default" : "secondary"}>
                                {waypoint.done ? "Done" : "Pending"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Route History</CardTitle>
              <CardDescription>Recently finished and cancelled routes.</CardDescription>
            </CardHeader>
            <CardContent>
              {historicalRoutes.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <RouteIcon className="mx-auto mb-3 h-12 w-12 opacity-50" />
                  <p>No route history yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historicalRoutes.slice(0, 10).map((route) => (
                    <div key={route.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold">{route.route_id || route.id}</h4>
                          <p className="text-xs text-muted-foreground">{route.algorithm} algorithm</p>
                        </div>
                        {routeStatusBadge(route)}
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Distance</p>
                          <p className="font-medium">{route.total_distance_km.toFixed(2)} km</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Estimated</p>
                          <p className="font-medium">{route.estimated_time_minutes.toFixed(1)} min</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Actual</p>
                          <p className="font-medium">
                            {route.actual_time_minutes ? `${route.actual_time_minutes.toFixed(1)} min` : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Efficiency</p>
                          <p className="font-medium">{route.efficiency_score.toFixed(3)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
