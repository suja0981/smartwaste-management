"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { getBins, getAlerts, type Bin, type AIAlert } from "@/lib/api-client"
import { mapBinStatus, getStatusColor, getStatusText, formatTimestamp, mapAlertSeverity } from "@/lib/status-mapper"
import { Trash2, AlertTriangle, CheckCircle, TrendingUp, Activity, MapPin, Loader2, Zap, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

export function ModernDashboardStats() {
  const [bins, setBins] = useState<Bin[]>([])
  const [alerts, setAlerts] = useState<AIAlert[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const [binsData, alertsData] = await Promise.all([getBins(), getAlerts()])
      setBins(binsData)
      setAlerts(alertsData)
      setLoading(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load dashboard data",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const stats = {
    totalBins: bins.length,
    binsOnline: bins.filter(b => b.status !== 'offline').length,
    binsFull: bins.filter(b => mapBinStatus(b.status) === 'critical').length,
    activeAlerts: alerts.length,
    avgFill: bins.length > 0 ? Math.round(bins.reduce((acc, b) => acc + b.fill_level_percent, 0) / bins.length) : 0
  }

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <CardContent className="p-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Stat Card 1 */}
      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <CardContent className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Trash2 className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 opacity-75" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-cyan-50/80">Bins Online</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-bold">{stats.binsOnline}</h3>
              <span className="text-lg text-cyan-50/60">/ {stats.totalBins}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Card 2 */}
      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-orange-500 to-pink-600 text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <CardContent className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <Activity className="h-5 w-5 opacity-75" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-orange-50/80">Critical Bins</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-bold">{stats.binsFull}</h3>
              <span className="text-lg text-orange-50/60">full</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Card 3 */}
      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <CardContent className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Zap className="h-6 w-6" />
            </div>
            <Activity className="h-5 w-5 opacity-75" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-emerald-50/80">AI Alerts</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-bold">{stats.activeAlerts}</h3>
              <span className="text-lg text-emerald-50/60">active</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Card 4 */}
      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <CardContent className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Shield className="h-6 w-6" />
            </div>
            <CheckCircle className="h-5 w-5 opacity-75" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-violet-50/80">Avg Fill Level</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-bold">{stats.avgFill}%</h3>
              <span className="text-lg text-violet-50/60">capacity</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ModernBinStatus() {
  const [bins, setBins] = useState<Bin[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchBins = async () => {
    try {
      const data = await getBins()
      setBins(data.slice(0, 5))
      setLoading(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load bins",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBins()
    const interval = setInterval(fetchBins, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="border-0 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
        <CardContent className="p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-800/50 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Live Bin Status</CardTitle>
            <CardDescription className="mt-1">Real-time monitoring across all locations</CardDescription>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full border border-green-500/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {bins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No bins found. Create your first bin to get started!</p>
            </div>
          ) : (
            bins.map((bin) => {
              const mappedStatus = mapBinStatus(bin.status)
              return (
                <div 
                  key={bin.id} 
                  className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        mappedStatus === 'critical' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                        mappedStatus === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      )}>
                        <Trash2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{bin.id}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {bin.location}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("text-xs font-medium", getStatusColor(mappedStatus))}>
                      {getStatusText(mappedStatus)}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2 text-xs">
                        <span className="text-muted-foreground">Fill Level</span>
                        <span className="font-semibold">{bin.fill_level_percent}%</span>
                      </div>
                      <Progress value={bin.fill_level_percent} className="h-2" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                      {bin.battery_percent !== undefined && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Battery</p>
                          <p className="text-sm font-semibold">{bin.battery_percent}%</p>
                        </div>
                      )}
                      {bin.temperature_c !== undefined && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Temp</p>
                          <p className="text-sm font-semibold">{bin.temperature_c}°C</p>
                        </div>
                      )}
                      {bin.humidity_percent !== undefined && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Humidity</p>
                          <p className="text-sm font-semibold">{bin.humidity_percent}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" className="w-full rounded-xl border-2 hover:bg-slate-50 dark:hover:bg-slate-800">
            <a href="/bins">View All Bins →</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ModernAIAlerts() {
  const [alerts, setAlerts] = useState<AIAlert[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchAlerts = async () => {
    try {
      const data = await getAlerts()
      setAlerts(data.slice(0, 5))
      setLoading(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load alerts",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5000)
    return () => clearInterval(interval)
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"
      case "medium":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
      default:
        return "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400"
    }
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
        <CardContent className="p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-800/50 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">AI Detection Feed</CardTitle>
            <CardDescription className="mt-1">Real-time alerts from computer vision</CardDescription>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20">
            <Zap className="w-3 h-3" />
            <span className="text-xs font-medium">AI Powered</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="font-medium">All Clear!</p>
              <p className="text-sm text-muted-foreground mt-1">No active alerts detected</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const severity = mapAlertSeverity(alert.alert_type)
              return (
                <div 
                  key={alert.id} 
                  className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 p-4 transition-all duration-300 hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg border", getSeverityColor(severity))}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm capitalize">{alert.alert_type}</h4>
                        <Badge className={cn("text-xs", getSeverityColor(severity))}>
                          {severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {alert.description || `${alert.alert_type} detected at bin ${alert.bin_id}`}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {alert.bin_id}
                        </span>
                        <span>{formatTimestamp(alert.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" className="w-full rounded-xl border-2 hover:bg-slate-50 dark:hover:bg-slate-800">
            <a href="/alerts">View All Alerts →</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}