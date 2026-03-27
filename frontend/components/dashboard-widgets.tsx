import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { getBins, type Bin } from "@/lib/api-client"
import { mapBinStatus, getStatusColor, getStatusText, formatTimestamp } from "@/lib/status-mapper"
import { Trash2,AlertTriangle, CheckCircle, Battery, Thermometer, Droplets, MapPin, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardStatsIntegrated() {
  const [bins, setBins] = useState<Bin[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const binsData = await getBins()
      setBins(binsData)
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
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Bins Online</CardTitle>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.binsOnline}</div>
          <p className="text-xs text-muted-foreground">of {stats.totalBins} total bins</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bins Full</CardTitle>
          <AlertTriangle className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.binsFull}</div>
          <p className="text-xs text-muted-foreground">
            {stats.totalBins > 0 ? Math.round((stats.binsFull / stats.totalBins) * 100) : 0}% of total capacity
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Status</CardTitle>
          <CheckCircle className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">Online</div>
          <p className="text-xs text-muted-foreground">All systems operational</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function BinStatusSectionIntegrated() {
  const [bins, setBins] = useState<Bin[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchBins = async () => {
    try {
      const data = await getBins()
      // Show only first 4 bins for dashboard
      setBins(data.slice(0, 4))
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
      <Card>
        <CardHeader>
          <CardTitle>Bin Status Overview</CardTitle>
          <CardDescription>Loading real-time monitoring data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bin Status Overview</CardTitle>
        <CardDescription>Real-time monitoring of waste collection bins</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bins.map((bin) => {
            const mappedStatus = mapBinStatus(bin.status)
            return (
              <div key={bin.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col">
                    <div className="font-medium">{bin.id}</div>
                    <div className="text-sm text-muted-foreground flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {bin.location}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-medium">{bin.fill_level_percent}%</div>
                    <Progress value={bin.fill_level_percent} className="w-16 h-2" />
                    <div className="text-xs text-muted-foreground">Fill Level</div>
                  </div>

                  {bin.battery_percent !== undefined && (
                    <div className="flex items-center space-x-2">
                      <Battery className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{bin.battery_percent}%</span>
                    </div>
                  )}

                  {bin.temperature_c !== undefined && (
                    <div className="flex items-center space-x-2">
                      <Thermometer className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{bin.temperature_c}°C</span>
                    </div>
                  )}

                  {bin.humidity_percent !== undefined && (
                    <div className="flex items-center space-x-2">
                      <Droplets className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{bin.humidity_percent}%</span>
                    </div>
                  )}

                  <Badge className={cn("text-xs", getStatusColor(mappedStatus))}>
                    {getStatusText(mappedStatus)}
                  </Badge>

                  {bin.last_telemetry && (
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(bin.last_telemetry)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href="/bins">View All Bins</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}