//AI alerts management UI. Currently uses mock data; should fetch alerts from backend (/ai_alerts endpoint).

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Search,
  AlertTriangle,
  Trash2,
  Droplets,
  Camera,
  MapPin,
  Clock,
  Eye,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Extended mock data for AI alerts
const mockAlerts = [
  {
    id: "ALERT-001",
    cameraId: "CAM-15",
    type: "garbage",
    confidence: 94,
    timestamp: "2024-01-15T10:30:00Z",
    timestampRelative: "2 minutes ago",
    severity: "high",
    location: "Main Street & 5th Ave",
    binId: "BIN-001",
    status: "active",
    description: "Overflowing garbage detected near bin location",
    imageUrl: "/overflowing-garbage-bin.png",
    coordinates: { lat: 40.7128, lng: -74.006 },
    assignedTo: null,
    resolvedAt: null,
  },
  {
    id: "ALERT-002",
    cameraId: "CAM-08",
    type: "spill",
    confidence: 87,
    timestamp: "2024-01-15T10:22:00Z",
    timestampRelative: "10 minutes ago",
    severity: "medium",
    location: "Central Park North",
    binId: "BIN-002",
    status: "investigating",
    description: "Liquid spill detected around waste collection area",
    imageUrl: "/liquid-spill-near-bin.jpg",
    coordinates: { lat: 40.7829, lng: -73.9654 },
    assignedTo: "Crew Team A",
    resolvedAt: null,
  },
  {
    id: "ALERT-003",
    cameraId: "CAM-22",
    type: "garbage",
    confidence: 91,
    timestamp: "2024-01-15T10:15:00Z",
    timestampRelative: "17 minutes ago",
    severity: "high",
    location: "Shopping District",
    binId: "BIN-003",
    status: "resolved",
    description: "Scattered garbage around bin - cleaned up",
    imageUrl: "/scattered-garbage-around-bin.jpg",
    coordinates: { lat: 40.7589, lng: -73.9851 },
    assignedTo: "Crew Team B",
    resolvedAt: "2024-01-15T10:25:00Z",
  },
  {
    id: "ALERT-004",
    cameraId: "CAM-31",
    type: "vandalism",
    confidence: 78,
    timestamp: "2024-01-15T09:45:00Z",
    timestampRelative: "47 minutes ago",
    severity: "low",
    location: "University Campus",
    binId: "BIN-004",
    status: "active",
    description: "Potential vandalism detected - bin appears damaged",
    imageUrl: "/damaged-waste-bin.jpg",
    coordinates: { lat: 40.7505, lng: -73.9934 },
    assignedTo: null,
    resolvedAt: null,
  },
  {
    id: "ALERT-005",
    cameraId: "CAM-19",
    type: "spill",
    confidence: 95,
    timestamp: "2024-01-15T09:30:00Z",
    timestampRelative: "1 hour ago",
    severity: "high",
    location: "Residential Area A",
    binId: "BIN-005",
    status: "investigating",
    description: "Large liquid spill requiring immediate cleanup",
    imageUrl: "/large-liquid-spill-cleanup.jpg",
    coordinates: { lat: 40.7282, lng: -73.9942 },
    assignedTo: "Crew Team C",
    resolvedAt: null,
  },
]

export function AIAlertsManagement() {
  const [alerts, setAlerts] = useState(mockAlerts)
  const [searchTerm, setSearchTerm] = useState("")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedAlert, setSelectedAlert] = useState<(typeof mockAlerts)[0] | null>(null)
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)

  // Simulate real-time updates
  useEffect(() => {
    if (!isRealTimeEnabled) return

    const interval = setInterval(() => {
      // Simulate new alert occasionally
      if (Math.random() < 0.1) {
        const newAlert = {
          id: `ALERT-${Date.now()}`,
          cameraId: `CAM-${Math.floor(Math.random() * 50) + 1}`,
          type: ["garbage", "spill", "vandalism"][Math.floor(Math.random() * 3)],
          confidence: Math.floor(Math.random() * 30) + 70,
          timestamp: new Date().toISOString(),
          timestampRelative: "Just now",
          severity: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
          location: ["New Location", "Another Street", "Random Area"][Math.floor(Math.random() * 3)],
          binId: `BIN-${Math.floor(Math.random() * 10) + 1}`,
          status: "active",
          description: "New AI detection alert",
          imageUrl: "/new-alert-detection.jpg",
          coordinates: { lat: 40.7 + Math.random() * 0.1, lng: -74 + Math.random() * 0.1 },
          assignedTo: null,
          resolvedAt: null,
        }
        setAlerts((prev) => [newAlert, ...prev])
      }
    }, 10000) // Check every 10 seconds

    return () => clearInterval(interval)
  }, [isRealTimeEnabled])

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-destructive text-destructive-foreground"
      case "investigating":
        return "bg-secondary text-secondary-foreground"
      case "resolved":
        return "bg-primary text-primary-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "garbage":
        return <Trash2 className="h-4 w-4" />
      case "spill":
        return <Droplets className="h-4 w-4" />
      case "vandalism":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter
    const matchesStatus = statusFilter === "all" || alert.status === statusFilter
    const matchesType = typeFilter === "all" || alert.type === typeFilter
    return matchesSearch && matchesSeverity && matchesStatus && matchesType
  })

  const stats = {
    total: alerts.length,
    active: alerts.filter((a) => a.status === "active").length,
    investigating: alerts.filter((a) => a.status === "investigating").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
    high: alerts.filter((a) => a.severity === "high").length,
  }

  const handleStatusChange = (alertId: string, newStatus: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              status: newStatus,
              resolvedAt: newStatus === "resolved" ? new Date().toISOString() : null,
            }
          : alert,
      ),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Alerts & Detection</h2>
          <p className="text-muted-foreground">Real-time AI-powered waste detection and monitoring alerts.</p>
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
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
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
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investigating</CardTitle>
            <Clock className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{stats.investigating}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.resolved}</div>
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

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
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
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            <TabsContent value="feed">
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredAlerts.map((alert) => (
                  <Card key={alert.id} className="transition-all hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                            {getTypeIcon(alert.type)}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium capitalize">{alert.type} Detection</h4>
                              <Badge className={cn("text-xs", getSeverityColor(alert.severity))}>
                                {alert.severity}
                              </Badge>
                              <Badge className={cn("text-xs", getStatusColor(alert.status))}>{alert.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{alert.description}</p>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Camera className="h-3 w-3 mr-1" />
                                {alert.cameraId}
                              </div>
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {alert.location}
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {alert.timestampRelative}
                              </div>
                              <div>Confidence: {alert.confidence}%</div>
                            </div>
                            {alert.assignedTo && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Assigned to:</span>{" "}
                                <span className="font-medium">{alert.assignedTo}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {alert.status === "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(alert.id, "investigating")}
                            >
                              Investigate
                            </Button>
                          )}
                          {alert.status === "investigating" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(alert.id, "resolved")}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          )}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedAlert(alert)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle>Alert Details - {selectedAlert?.id}</DialogTitle>
                                <DialogDescription>
                                  Detailed information about this AI detection alert
                                </DialogDescription>
                              </DialogHeader>
                              {selectedAlert && (
                                <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <h4 className="font-medium">Detection Information</h4>
                                      <div className="text-sm space-y-1">
                                        <p>
                                          <strong>Alert ID:</strong> {selectedAlert.id}
                                        </p>
                                        <p>
                                          <strong>Type:</strong> {selectedAlert.type}
                                        </p>
                                        <p>
                                          <strong>Confidence:</strong> {selectedAlert.confidence}%
                                        </p>
                                        <p>
                                          <strong>Camera:</strong> {selectedAlert.cameraId}
                                        </p>
                                        <p>
                                          <strong>Related Bin:</strong> {selectedAlert.binId}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <h4 className="font-medium">Status & Assignment</h4>
                                      <div className="text-sm space-y-1">
                                        <p>
                                          <strong>Status:</strong>
                                          <Badge className={cn("ml-2 text-xs", getStatusColor(selectedAlert.status))}>
                                            {selectedAlert.status}
                                          </Badge>
                                        </p>
                                        <p>
                                          <strong>Severity:</strong>
                                          <Badge
                                            className={cn("ml-2 text-xs", getSeverityColor(selectedAlert.severity))}
                                          >
                                            {selectedAlert.severity}
                                          </Badge>
                                        </p>
                                        <p>
                                          <strong>Assigned To:</strong> {selectedAlert.assignedTo || "Unassigned"}
                                        </p>
                                        <p>
                                          <strong>Detected:</strong> {selectedAlert.timestampRelative}
                                        </p>
                                        {selectedAlert.resolvedAt && (
                                          <p>
                                            <strong>Resolved:</strong>{" "}
                                            {new Date(selectedAlert.resolvedAt).toLocaleString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="font-medium">Location & Description</h4>
                                    <div className="text-sm space-y-1">
                                      <p>
                                        <strong>Location:</strong> {selectedAlert.location}
                                      </p>
                                      <p>
                                        <strong>Description:</strong> {selectedAlert.description}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="font-medium">Detection Image</h4>
                                    <img
                                      src={selectedAlert.imageUrl || "/placeholder.svg"}
                                      alt="Detection"
                                      className="w-full h-48 object-cover rounded-md border"
                                    />
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="table">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell className="font-medium">{alert.id}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getTypeIcon(alert.type)}
                            <span className="ml-2 capitalize">{alert.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                            {alert.location}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getSeverityColor(alert.severity))}>{alert.severity}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getStatusColor(alert.status))}>{alert.status}</Badge>
                        </TableCell>
                        <TableCell>{alert.confidence}%</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{alert.timestampRelative}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {alert.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(alert.id, "investigating")}
                              >
                                Investigate
                              </Button>
                            )}
                            {alert.status === "investigating" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(alert.id, "resolved")}
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedAlert(alert)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
