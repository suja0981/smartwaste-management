"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  getBins,
  getCrews,
  optimizeRoute,
  compareRoutes,
  getRoutes,
  getRouteAnalytics,
  type Bin,
  type Crew,
  type Route,
  type RouteAnalytics
} from "@/lib/api-client"
import { 
  MapPin, 
  Route as RouteIcon, 
  Zap, 
  TrendingUp, 
  Clock, 
  Navigation,
  Loader2,
  Play,
  BarChart3,
  CheckCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

export function RouteOptimization() {
  const [bins, setBins] = useState<Bin[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [selectedBins, setSelectedBins] = useState<string[]>([])
  const [selectedCrew, setSelectedCrew] = useState<string>("")
  const [algorithm, setAlgorithm] = useState<string>("hybrid")
  const [optimizedRoute, setOptimizedRoute] = useState<Route | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [analytics, setAnalytics] = useState<RouteAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [comparing, setComparing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [binsData, crewsData, routesData, analyticsData] = await Promise.all([
        getBins(),
        getCrews(),
        getRoutes().catch(() => []),
        getRouteAnalytics().catch(() => null)
      ])
      setBins(binsData)
      setCrews(crewsData)
      setRoutes(routesData)
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
  }

  const handleOptimize = async () => {
    if (selectedBins.length < 2) {
      toast({
        title: "Select bins",
        description: "Please select at least 2 bins to optimize a route",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const route = await optimizeRoute({
        bin_ids: selectedBins,
        crew_id: selectedCrew || undefined,
        algorithm: algorithm as any,
        save_route: true
      })

      setOptimizedRoute(route)
      toast({
        title: "Route optimized!",
        description: `Found route with ${route.bin_count} bins, ${route.total_distance_km.toFixed(2)} km total distance`
      })

      // Refresh routes list
      const routesData = await getRoutes()
      setRoutes(routesData)
    } catch (error) {
      toast({
        title: "Optimization failed",
        description: error instanceof Error ? error.message : "Failed to optimize route",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCompare = async () => {
    if (selectedBins.length < 2) {
      toast({
        title: "Select bins",
        description: "Please select at least 2 bins to compare algorithms",
        variant: "destructive"
      })
      return
    }

    setComparing(true)
    try {
      const comparison = await compareRoutes(selectedBins)
      
      // Show comparison results
      toast({
        title: "Algorithm comparison complete",
        description: `Recommended: ${comparison.recommended.toUpperCase()}`
      })

      // Set the best route as optimized
      const bestRoute = comparison.algorithms.find(r => r.algorithm === comparison.recommended)
      if (bestRoute) {
        setOptimizedRoute(bestRoute)
      }
    } catch (error) {
      toast({
        title: "Comparison failed",
        description: error instanceof Error ? error.message : "Failed to compare algorithms",
        variant: "destructive"
      })
    } finally {
      setComparing(false)
    }
  }

  const toggleBinSelection = (binId: string) => {
    setSelectedBins(prev =>
      prev.includes(binId)
        ? prev.filter(id => id !== binId)
        : [...prev, binId]
    )
  }

  const getAlgorithmInfo = (algo: string) => {
    const info: Record<string, { name: string; description: string; color: string }> = {
      greedy: {
        name: "Greedy",
        description: "Fast, nearest neighbor approach",
        color: "bg-blue-500"
      },
      priority: {
        name: "Priority",
        description: "Urgency-based routing",
        color: "bg-orange-500"
      },
      hybrid: {
        name: "Hybrid",
        description: "Balanced optimization",
        color: "bg-emerald-500"
      },
      two_opt: {
        name: "2-Opt",
        description: "Advanced optimization",
        color: "bg-violet-500"
      }
    }
    return info[algo] || info.hybrid
  }

  const algoInfo = getAlgorithmInfo(algorithm)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Route Optimization</h2>
          <p className="text-muted-foreground">
            AI-powered route planning for efficient waste collection
          </p>
        </div>
        <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20">
          <Zap className="h-3 w-3 mr-1" />
          4 Algorithms
        </Badge>
      </div>

      {/* Analytics Cards */}
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
          <TabsTrigger value="routes">Active Routes</TabsTrigger>
          <TabsTrigger value="history">Route History</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Configuration Panel */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Route Configuration</CardTitle>
                  <CardDescription>Select bins and optimization settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Algorithm Selection */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Algorithm</label>
                    <Select value={algorithm} onValueChange={setAlgorithm}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="greedy">Greedy (Fastest)</SelectItem>
                        <SelectItem value="priority">Priority-based</SelectItem>
                        <SelectItem value="hybrid">Hybrid (Recommended)</SelectItem>
                        <SelectItem value="two_opt">2-Opt (Most Optimal)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="mt-2 p-3 rounded-lg bg-muted/50">
                      <div className={cn("inline-block px-2 py-1 rounded text-xs font-medium text-white mb-1", algoInfo.color)}>
                        {algoInfo.name}
                      </div>
                      <p className="text-xs text-muted-foreground">{algoInfo.description}</p>
                    </div>
                  </div>

                  {/* Crew Selection */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Assign to Crew (Optional)</label>
                    <Select value={selectedCrew} onValueChange={setSelectedCrew}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select crew" />
                      </SelectTrigger>
                      <SelectContent>
                        {crews.map(crew => (
                          <SelectItem key={crew.id} value={crew.id}>
                            {crew.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button 
                      onClick={handleOptimize} 
                      disabled={loading || selectedBins.length < 2}
                      className="w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Optimize Route
                    </Button>

                    <Button 
                      onClick={handleCompare} 
                      disabled={comparing || selectedBins.length < 2}
                      variant="outline"
                      className="w-full"
                    >
                      {comparing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <BarChart3 className="h-4 w-4 mr-2" />
                      )}
                      Compare Algorithms
                    </Button>
                  </div>

                  {/* Selection Info */}
                  <div className="pt-4 border-t text-sm">
                    <p className="text-muted-foreground">
                      {selectedBins.length} bin{selectedBins.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bin Selection & Route Display */}
            <div className="lg:col-span-2 space-y-4">
              {/* Bin Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Bins for Route</CardTitle>
                  <CardDescription>Click bins to add/remove from route</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2 max-h-[400px] overflow-y-auto">
                    {bins.map(bin => (
                      <div
                        key={bin.id}
                        onClick={() => toggleBinSelection(bin.id)}
                        className={cn(
                          "p-3 border rounded-lg cursor-pointer transition-all",
                          selectedBins.includes(bin.id)
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{bin.id}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {bin.location}
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

              {/* Optimized Route Display */}
              {optimizedRoute && (
                <Card className="border-2 border-primary">
                  <CardHeader className="bg-primary/5">
                    <CardTitle className="flex items-center gap-2">
                      <RouteIcon className="h-5 w-5" />
                      Optimized Route
                    </CardTitle>
                    <CardDescription>Route created with {optimizedRoute.algorithm} algorithm</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-3 mb-6">
                      <div className="text-center p-3 rounded-lg bg-muted">
                        <p className="text-2xl font-bold text-primary">{optimizedRoute.total_distance_km.toFixed(2)} km</p>
                        <p className="text-xs text-muted-foreground">Total Distance</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted">
                        <p className="text-2xl font-bold text-primary">{optimizedRoute.estimated_time_minutes.toFixed(1)} min</p>
                        <p className="text-xs text-muted-foreground">Estimated Time</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted">
                        <p className="text-2xl font-bold text-primary">{optimizedRoute.efficiency_score.toFixed(3)}</p>
                        <p className="text-xs text-muted-foreground">Efficiency (bins/km)</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Collection Order</h4>
                      <div className="space-y-2">
                        {optimizedRoute.waypoints.map((waypoint, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 rounded-lg border">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                              {waypoint.order}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{waypoint.bin_id}</p>
                              <p className="text-xs text-muted-foreground">
                                Fill: {waypoint.fill_level}% • Est. {waypoint.estimated_collection_time} min
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
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
              <CardTitle>Active Routes</CardTitle>
              <CardDescription>Routes currently in progress</CardDescription>
            </CardHeader>
            <CardContent>
              {routes.filter(r => r.status === 'active').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RouteIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active routes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {routes.filter(r => r.status === 'active').map(route => (
                    <div key={route.route_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{route.route_id}</h4>
                        <Badge variant="outline">{route.algorithm}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Distance</p>
                          <p className="font-medium">{route.total_distance_km.toFixed(2)} km</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Time</p>
                          <p className="font-medium">{route.estimated_time_minutes.toFixed(1)} min</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bins</p>
                          <p className="font-medium">{route.bin_count}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Route History</CardTitle>
              <CardDescription>Previously completed routes</CardDescription>
            </CardHeader>
            <CardContent>
              {routes.filter(r => r.status === 'completed').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RouteIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No completed routes yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {routes.filter(r => r.status === 'completed').slice(0, 10).map(route => (
                    <div key={route.route_id} className="border rounded-lg p-4 opacity-75">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{route.route_id}</h4>
                        <Badge>Completed</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Distance</p>
                          <p className="font-medium">{(route.total_distance_km ?? 0).toFixed(2)} km</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Efficiency</p>
                          <p className="font-medium">{(route.efficiency_score ?? 0).toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Algorithm</p>
                          <p className="font-medium capitalize">{route.algorithm || 'unknown'}</p>
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