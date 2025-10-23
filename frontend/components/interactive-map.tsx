//Interactive map visualization for bins, crews, and alerts. Uses mock data

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Trash2, Users, AlertTriangle, Battery, Thermometer, Droplets, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data for map integration
const mockBinLocations = [
  {
    id: "BIN-001",
    name: "Main Street & 5th Ave",
    coordinates: [40.7128, -74.006],
    fillLevel: 85,
    battery: 92,
    temperature: 22,
    humidity: 65,
    status: "critical",
    type: "General Waste",
    lastUpdate: "2 min ago",
    alerts: 2,
  },
  {
    id: "BIN-002",
    name: "Central Park North",
    coordinates: [40.7829, -73.9654],
    fillLevel: 45,
    battery: 78,
    temperature: 20,
    humidity: 58,
    status: "normal",
    type: "Recycling",
    lastUpdate: "5 min ago",
    alerts: 0,
  },
  {
    id: "BIN-003",
    name: "Shopping District",
    coordinates: [40.7589, -73.9851],
    fillLevel: 72,
    battery: 85,
    temperature: 24,
    humidity: 62,
    status: "warning",
    type: "General Waste",
    lastUpdate: "1 min ago",
    alerts: 1,
  },
  {
    id: "BIN-004",
    name: "University Campus",
    coordinates: [40.7505, -73.9934],
    fillLevel: 28,
    battery: 95,
    temperature: 19,
    humidity: 55,
    status: "normal",
    type: "Recycling",
    lastUpdate: "3 min ago",
    alerts: 0,
  },
  {
    id: "BIN-005",
    name: "Residential Area A",
    coordinates: [40.7282, -73.9942],
    fillLevel: 91,
    battery: 67,
    temperature: 23,
    humidity: 60,
    status: "critical",
    type: "General Waste",
    lastUpdate: "4 min ago",
    alerts: 3,
  },
  {
    id: "BIN-006",
    name: "Business District",
    coordinates: [40.7614, -73.9776],
    fillLevel: 15,
    battery: 88,
    temperature: 21,
    humidity: 57,
    status: "normal",
    type: "Recycling",
    lastUpdate: "1 min ago",
    alerts: 0,
  },
]

const mockCrewLocations = [
  {
    id: "CREW-001",
    name: "Team Alpha",
    coordinates: [40.715, -74.008],
    status: "active",
    currentTask: "Collection Route A",
    members: 3,
    eta: "15 min",
  },
  {
    id: "CREW-002",
    name: "Team Beta",
    coordinates: [40.78, -73.96],
    status: "active",
    currentTask: "Emergency Cleanup",
    members: 3,
    eta: "8 min",
  },
  {
    id: "CREW-003",
    name: "Team Gamma",
    coordinates: [40.75, -73.99],
    status: "break",
    currentTask: "Break Time",
    members: 3,
    eta: "N/A",
  },
  {
    id: "CREW-004",
    name: "Team Delta",
    coordinates: [40.76, -73.98],
    status: "active",
    currentTask: "Routine Maintenance",
    members: 3,
    eta: "22 min",
  },
]

const mockAlertLocations = [
  {
    id: "ALERT-001",
    coordinates: [40.7128, -74.006],
    type: "garbage",
    severity: "high",
    description: "Overflowing garbage detected",
    timestamp: "2 min ago",
  },
  {
    id: "ALERT-002",
    coordinates: [40.7589, -73.9851],
    type: "spill",
    severity: "medium",
    description: "Liquid spill detected",
    timestamp: "8 min ago",
  },
  {
    id: "ALERT-003",
    coordinates: [40.7282, -73.9942],
    type: "vandalism",
    severity: "low",
    description: "Potential vandalism detected",
    timestamp: "15 min ago",
  },
]

export function InteractiveMap() {
  const [selectedBin, setSelectedBin] = useState<(typeof mockBinLocations)[0] | null>(null)
  const [selectedCrew, setSelectedCrew] = useState<(typeof mockCrewLocations)[0] | null>(null)
  const [mapView, setMapView] = useState("satellite")
  const [showBins, setShowBins] = useState(true)
  const [showCrews, setShowCrews] = useState(true)
  const [showAlerts, setShowAlerts] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoaded, setIsLoaded] = useState(false)

  // Simulate map loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "bg-destructive"
      case "warning":
        return "bg-secondary"
      case "normal":
        return "bg-primary"
      default:
        return "bg-muted"
    }
  }

  const getCrewStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary"
      case "break":
        return "bg-secondary"
      case "offline":
        return "bg-muted"
      default:
        return "bg-muted"
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-destructive"
      case "medium":
        return "bg-secondary"
      case "low":
        return "bg-muted"
      default:
        return "bg-muted"
    }
  }

  const filteredBins = mockBinLocations.filter((bin) => statusFilter === "all" || bin.status === statusFilter)

  const stats = {
    totalBins: mockBinLocations.length,
    criticalBins: mockBinLocations.filter((b) => b.status === "critical").length,
    activeCrews: mockCrewLocations.filter((c) => c.status === "active").length,
    activeAlerts: mockAlertLocations.length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Interactive Map</h2>
        <p className="text-muted-foreground">
          Real-time visualization of bins, crews, and alerts across your waste management network.
        </p>
      </div>

      {/* Map Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Map Controls</span>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch id="bins" checked={showBins} onCheckedChange={setShowBins} />
                <Label htmlFor="bins" className="flex items-center">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Bins
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="crews" checked={showCrews} onCheckedChange={setShowCrews} />
                <Label htmlFor="crews" className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  Crews
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="alerts" checked={showAlerts} onCheckedChange={setShowAlerts} />
                <Label htmlFor="alerts" className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Alerts
                </Label>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Select value={mapView} onValueChange={setMapView}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="satellite">Satellite</SelectItem>
                  <SelectItem value="street">Street</SelectItem>
                  <SelectItem value="terrain">Terrain</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Map Container */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <div className="relative h-[600px] bg-muted rounded-lg overflow-hidden">
                {!isLoaded ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading map...</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative h-full w-full">
                    {/* Simulated Map Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 dark:from-blue-900 dark:to-green-900">
                      {/* Map Grid Lines */}
                      <svg className="absolute inset-0 w-full h-full opacity-20">
                        <defs>
                          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                      </svg>

                      {/* Simulated Bin Markers */}
                      {showBins &&
                        filteredBins.map((bin, index) => (
                          <div
                            key={bin.id}
                            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
                            style={{
                              left: `${20 + (index % 3) * 25}%`,
                              top: `${20 + Math.floor(index / 3) * 20}%`,
                            }}
                            onClick={() => setSelectedBin(bin)}
                          >
                            <div
                              className={cn(
                                "w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center",
                                getStatusColor(bin.status),
                              )}
                            >
                              <Trash2 className="h-3 w-3 text-white" />
                            </div>
                            {bin.alerts > 0 && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full flex items-center justify-center">
                                <span className="text-xs text-white">{bin.alerts}</span>
                              </div>
                            )}
                          </div>
                        ))}

                      {/* Simulated Crew Markers */}
                      {showCrews &&
                        mockCrewLocations.map((crew, index) => (
                          <div
                            key={crew.id}
                            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
                            style={{
                              left: `${30 + (index % 2) * 40}%`,
                              top: `${30 + Math.floor(index / 2) * 25}%`,
                            }}
                            onClick={() => setSelectedCrew(crew)}
                          >
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center",
                                getCrewStatusColor(crew.status),
                              )}
                            >
                              <Users className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        ))}

                      {/* Simulated Alert Markers */}
                      {showAlerts &&
                        mockAlertLocations.map((alert, index) => (
                          <div
                            key={alert.id}
                            className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
                            style={{
                              left: `${25 + (index % 3) * 30}%`,
                              top: `${25 + Math.floor(index / 3) * 30}%`,
                            }}
                          >
                            <div
                              className={cn(
                                "w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center",
                                getSeverityColor(alert.severity),
                              )}
                            >
                              <AlertTriangle className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Map Legend */}
                    <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                      <h4 className="font-medium text-sm mb-2">Legend</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-destructive rounded-full"></div>
                          <span>Critical</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-secondary rounded-full"></div>
                          <span>Warning</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-primary rounded-full"></div>
                          <span>Normal</span>
                        </div>
                      </div>
                    </div>

                    {/* Map Stats */}
                    <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-bold text-lg">{stats.totalBins}</div>
                          <div className="text-muted-foreground">Total Bins</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg text-destructive">{stats.criticalBins}</div>
                          <div className="text-muted-foreground">Critical</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{stats.activeCrews}</div>
                          <div className="text-muted-foreground">Active Crews</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{stats.activeAlerts}</div>
                          <div className="text-muted-foreground">Alerts</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          <Tabs defaultValue="bins">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bins">Bins</TabsTrigger>
              <TabsTrigger value="crews">Crews</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="bins" className="space-y-3">
              {filteredBins.map((bin) => (
                <Card
                  key={bin.id}
                  className={cn("cursor-pointer transition-all", selectedBin?.id === bin.id && "ring-2 ring-primary")}
                  onClick={() => setSelectedBin(bin)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{bin.id}</h4>
                      <Badge className={cn("text-xs", getStatusColor(bin.status), "text-white")}>{bin.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{bin.name}</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Fill Level:</span>
                        <span className="font-medium">{bin.fillLevel}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Battery:</span>
                        <span className="font-medium">{bin.battery}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Alerts:</span>
                        <span className="font-medium">{bin.alerts}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="crews" className="space-y-3">
              {mockCrewLocations.map((crew) => (
                <Card
                  key={crew.id}
                  className={cn("cursor-pointer transition-all", selectedCrew?.id === crew.id && "ring-2 ring-primary")}
                  onClick={() => setSelectedCrew(crew)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{crew.name}</h4>
                      <Badge className={cn("text-xs", getCrewStatusColor(crew.status), "text-white")}>
                        {crew.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Task:</span>
                        <span className="font-medium">{crew.currentTask}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Members:</span>
                        <span className="font-medium">{crew.members}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>ETA:</span>
                        <span className="font-medium">{crew.eta}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="alerts" className="space-y-3">
              {mockAlertLocations.map((alert) => (
                <Card key={alert.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm capitalize">{alert.type}</h4>
                      <Badge className={cn("text-xs", getSeverityColor(alert.severity), "text-white")}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{alert.description}</p>
                    <div className="text-xs text-muted-foreground">{alert.timestamp}</div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>

          {/* Selected Item Details */}
          {selectedBin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bin Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">{selectedBin.id}</h4>
                  <p className="text-sm text-muted-foreground">{selectedBin.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center">
                    <Trash2 className="h-3 w-3 mr-1" />
                    {selectedBin.fillLevel}%
                  </div>
                  <div className="flex items-center">
                    <Battery className="h-3 w-3 mr-1" />
                    {selectedBin.battery}%
                  </div>
                  <div className="flex items-center">
                    <Thermometer className="h-3 w-3 mr-1" />
                    {selectedBin.temperature}°C
                  </div>
                  <div className="flex items-center">
                    <Droplets className="h-3 w-3 mr-1" />
                    {selectedBin.humidity}%
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Updated {selectedBin.lastUpdate}</div>
              </CardContent>
            </Card>
          )}

          {selectedCrew && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Crew Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">{selectedCrew.name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedCrew.currentTask}</p>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <Badge className={cn("text-xs", getCrewStatusColor(selectedCrew.status), "text-white")}>
                      {selectedCrew.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Members:</span>
                    <span>{selectedCrew.members}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ETA:</span>
                    <span>{selectedCrew.eta}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
