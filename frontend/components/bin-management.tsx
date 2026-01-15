"use client"

import { useEffect, useState } from "react"
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
  RefreshCw,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function BinManagementIntegrated() {
  const [bins, setBins] = useState<Bin[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()

  const fetchBins = async () => {
    try {
      setLoading(true)
      const data = await getBins()
      setBins(data)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load bins",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBins()
    // Poll every 5 seconds
    const interval = setInterval(fetchBins, 5000)
    return () => clearInterval(interval)
  }, [])

  const filteredBins = bins.filter((bin) => {
    const matchesSearch =
      bin.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bin.location.toLowerCase().includes(searchTerm.toLowerCase())
    const mappedStatus = mapBinStatus(bin.status)
    const matchesStatus = statusFilter === "all" || mappedStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: bins.length,
    critical: bins.filter((b) => mapBinStatus(b.status) === 'critical').length,
    warning: bins.filter((b) => mapBinStatus(b.status) === 'warning').length,
    normal: bins.filter((b) => mapBinStatus(b.status) === 'normal').length,
  }

  if (loading && bins.length === 0) {
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
          <h2 className="text-3xl font-bold tracking-tight">Bin Management</h2>
          <p className="text-muted-foreground">Real-time monitoring of waste collection bins</p>
        </div>
        <Button onClick={fetchBins} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bins</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning</CardTitle>
            <Clock className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{stats.warning}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Normal</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.normal}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bin Overview</CardTitle>
          <CardDescription>Connected to backend API - Real-time data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bins..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredBins.map((bin) => {
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
        </CardContent>
      </Card>
    </div>
  )
}