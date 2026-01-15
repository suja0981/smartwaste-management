"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { getAlerts, deleteAlert, type AIAlert } from "@/lib/api-client"
import { mapAlertSeverity, formatTimestamp } from "@/lib/status-mapper"
import {
  Search,
  AlertTriangle,
  Trash2,
  Droplets,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  Activity,
  Loader2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function AIAlertsManagementIntegrated() {
  const [alerts, setAlerts] = useState<AIAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)
  const { toast } = useToast()

  const fetchAlerts = async () => {
    try {
      const data = await getAlerts()
      setAlerts(data)
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
  }, [])

  useEffect(() => {
    if (!isRealTimeEnabled) return
    const interval = setInterval(fetchAlerts, 5000)
    return () => clearInterval(interval)
  }, [isRealTimeEnabled])

  const handleDeleteAlert = async (id: number) => {
    try {
      await deleteAlert(id)
      setAlerts(alerts.filter(a => a.id !== id))
      toast({
        title: "Success",
        description: "Alert deleted successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete alert",
        variant: "destructive",
      })
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-destructive text-destructive-foreground"
      case "medium":
        return "bg-secondary text-secondary-foreground"
      case "low":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "garbage":
        return <Trash2 className="h-4 w-4" />
      case "spill":
        return <Droplets className="h-4 w-4" />
      case "vandalism":
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const filteredAlerts = alerts.filter((alert) => {
    const severity = mapAlertSeverity(alert.alert_type)
    const matchesSearch =
      alert.bin_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.alert_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alert.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesSeverity = severityFilter === "all" || severity === severityFilter
    const matchesType = typeFilter === "all" || alert.alert_type.toLowerCase() === typeFilter.toLowerCase()
    return matchesSearch && matchesSeverity && matchesType
  })

  const stats = {
    total: alerts.length,
    high: alerts.filter((a) => mapAlertSeverity(a.alert_type) === "high").length,
  }

  if (loading) {
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
          <h2 className="text-3xl font-bold tracking-tight">AI Alerts & Detection</h2>
          <p className="text-muted-foreground">Real-time AI-powered waste detection and monitoring alerts</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={isRealTimeEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
          >
            <Activity className="h-4 w-4 mr-2" />
            {isRealTimeEnabled ? "Live" : "Paused"}
          </Button>
          <Button onClick={fetchAlerts} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.high}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">Active</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alert Management</CardTitle>
          <CardDescription>Monitor and manage AI-powered detection alerts in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="feed" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="feed">Live Feed</TabsTrigger>
                <TabsTrigger value="table">Table View</TabsTrigger>
              </TabsList>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search alerts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>

                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="garbage">Garbage</SelectItem>
                    <SelectItem value="spill">Spill</SelectItem>
                    <SelectItem value="vandalism">Vandalism</SelectItem>
                    <SelectItem value="fire">Fire</SelectItem>
                    <SelectItem value="overflow">Overflow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="feed">
              {filteredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <CheckCircle className="h-16 w-16 mb-4" />
                  <p className="text-lg font-medium">No alerts found</p>
                  <p className="text-sm">All systems running smoothly</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {filteredAlerts.map((alert) => {
                    const severity = mapAlertSeverity(alert.alert_type)
                    return (
                      <Card key={alert.id} className="transition-all hover:shadow-md">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-4">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                                {getTypeIcon(alert.alert_type)}
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium capitalize">{alert.alert_type} Detection</h4>
                                  <Badge className={cn("text-xs", getSeverityColor(severity))}>
                                    {severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {alert.description || `${alert.alert_type} detected at bin ${alert.bin_id}`}
                                </p>
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                  <div>Bin: {alert.bin_id}</div>
                                  <div>{formatTimestamp(alert.timestamp)}</div>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAlert(alert.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="table">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Bin ID</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No alerts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAlerts.map((alert) => {
                        const severity = mapAlertSeverity(alert.alert_type)
                        return (
                          <TableRow key={alert.id}>
                            <TableCell className="font-medium">#{alert.id}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                {getTypeIcon(alert.alert_type)}
                                <span className="ml-2 capitalize">{alert.alert_type}</span>
                              </div>
                            </TableCell>
                            <TableCell>{alert.bin_id}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-xs", getSeverityColor(severity))}>{severity}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatTimestamp(alert.timestamp)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAlert(alert.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}