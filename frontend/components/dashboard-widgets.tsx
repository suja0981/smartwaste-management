//Dashboard widgets for stats, bin status, and AI alerts.

"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Trash2, AlertTriangle, CheckCircle, Battery, Thermometer, Droplets, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data - in real app this would come from API
const mockStats = {
  totalBins: 156,
  binsOnline: 142,
  binsFull: 23,
  activeAlerts: 8,
  tasksAssigned: 12,
  completedTasks: 8,
}

const mockBins = [
  {
    id: "BIN-001",
    location: "Main Street & 5th Ave",
    fillLevel: 85,
    battery: 92,
    temperature: 22,
    humidity: 65,
    status: "critical",
    lastUpdate: "2 min ago",
  },
  {
    id: "BIN-002",
    location: "Central Park North",
    fillLevel: 45,
    battery: 78,
    temperature: 20,
    humidity: 58,
    status: "normal",
    lastUpdate: "5 min ago",
  },
  {
    id: "BIN-003",
    location: "Shopping District",
    fillLevel: 72,
    battery: 85,
    temperature: 24,
    humidity: 62,
    status: "warning",
    lastUpdate: "1 min ago",
  },
  {
    id: "BIN-004",
    location: "University Campus",
    fillLevel: 28,
    battery: 95,
    temperature: 19,
    humidity: 55,
    status: "normal",
    lastUpdate: "3 min ago",
  },
]

const mockAlerts = [
  {
    id: "ALERT-001",
    cameraId: "CAM-15",
    type: "garbage",
    confidence: 94,
    timestamp: "2 minutes ago",
    severity: "high",
    location: "Main Street & 5th Ave",
  },
  {
    id: "ALERT-002",
    cameraId: "CAM-08",
    type: "spill",
    confidence: 87,
    timestamp: "8 minutes ago",
    severity: "medium",
    location: "Central Park North",
  },
  {
    id: "ALERT-003",
    cameraId: "CAM-22",
    type: "garbage",
    confidence: 91,
    timestamp: "15 minutes ago",
    severity: "high",
    location: "Shopping District",
  },
]

export function DashboardStats() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Bins Online</CardTitle>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockStats.binsOnline}</div>
          <p className="text-xs text-muted-foreground">of {mockStats.totalBins} total bins</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bins Full</CardTitle>
          <AlertTriangle className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockStats.binsFull}</div>
          <p className="text-xs text-muted-foreground">
            {Math.round((mockStats.binsFull / mockStats.totalBins) * 100)}% of total capacity
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active AI Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockStats.activeAlerts}</div>
          <p className="text-xs text-muted-foreground">Requires immediate attention</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tasks Assigned</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockStats.tasksAssigned}</div>
          <p className="text-xs text-muted-foreground">{mockStats.completedTasks} completed today</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function BinStatusSection() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "bg-destructive text-destructive-foreground"
      case "warning":
        return "bg-secondary text-secondary-foreground"
      case "normal":
        return "bg-primary text-primary-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "critical":
        return "Critical"
      case "warning":
        return "Warning"
      case "normal":
        return "Normal"
      default:
        return "Unknown"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bin Status Overview</CardTitle>
        <CardDescription>Real-time monitoring of waste collection bins</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockBins.map((bin) => (
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
                  <div className="text-sm font-medium">{bin.fillLevel}%</div>
                  <Progress value={bin.fillLevel} className="w-16 h-2" />
                  <div className="text-xs text-muted-foreground">Fill Level</div>
                </div>

                <div className="flex items-center space-x-2">
                  <Battery className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{bin.battery}%</span>
                </div>

                <div className="flex items-center space-x-2">
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{bin.temperature}°C</span>
                </div>

                <div className="flex items-center space-x-2">
                  <Droplets className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{bin.humidity}%</span>
                </div>

                <Badge className={cn("text-xs", getStatusColor(bin.status))}>{getStatusText(bin.status)}</Badge>

                <div className="text-xs text-muted-foreground">{bin.lastUpdate}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm">
            View All Bins
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function AIAlertsSection() {
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
    switch (type) {
      case "garbage":
        return <Trash2 className="h-4 w-4" />
      case "spill":
        return <Droplets className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Alerts Feed</CardTitle>
        <CardDescription>Real-time AI-powered waste detection alerts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {mockAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                  {getTypeIcon(alert.type)}
                </div>
                <div className="flex flex-col">
                  <div className="font-medium capitalize">{alert.type} Detection</div>
                  <div className="text-sm text-muted-foreground">
                    Camera {alert.cameraId} • {alert.location}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-sm">
                  <span className="font-medium">{alert.confidence}%</span>
                  <span className="text-muted-foreground"> confidence</span>
                </div>
                <Badge className={cn("text-xs", getSeverityColor(alert.severity))}>{alert.severity}</Badge>
                <div className="text-xs text-muted-foreground">{alert.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm">
            View All Alerts
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
