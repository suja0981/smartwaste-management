//Bin management UI. Fetches bins from backend (/bins endpoint), displays, filters, and manages bins.

"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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
  MapPin,
  Battery,
  Thermometer,
  Droplets,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Extended mock data for bin management
// const mockBins = [
//   {
//     id: "BIN-001",
//     location: "Main Street & 5th Ave",
//     address: "1234 Main Street, Downtown",
//     fillLevel: 85,
//     battery: 92,
//     temperature: 22,
//     humidity: 65,
//     status: "critical",
//     lastUpdate: "2 min ago",
//     lastEmptied: "2 days ago",
//     type: "General Waste",
//     capacity: "240L",
//     coordinates: { lat: 40.7128, lng: -74.006 },
//   },
//   {
//     id: "BIN-002",
//     location: "Central Park North",
//     address: "Central Park North Entrance",
//     fillLevel: 45,
//     battery: 78,
//     temperature: 20,
//     humidity: 58,
//     status: "normal",
//     lastUpdate: "5 min ago",
//     lastEmptied: "1 day ago",
//     type: "Recycling",
//     capacity: "360L",
//     coordinates: { lat: 40.7829, lng: -73.9654 },
//   },
//   {
//     id: "BIN-003",
//     location: "Shopping District",
//     address: "456 Commerce Ave, Shopping Center",
//     fillLevel: 72,
//     battery: 85,
//     temperature: 24,
//     humidity: 62,
//     status: "warning",
//     lastUpdate: "1 min ago",
//     lastEmptied: "3 hours ago",
//     type: "General Waste",
//     capacity: "240L",
//     coordinates: { lat: 40.7589, lng: -73.9851 },
//   },
//   {
//     id: "BIN-004",
//     location: "University Campus",
//     address: "University Main Building",
//     fillLevel: 28,
//     battery: 95,
//     temperature: 19,
//     humidity: 55,
//     status: "normal",
//     lastUpdate: "3 min ago",
//     lastEmptied: "6 hours ago",
//     type: "Recycling",
//     capacity: "360L",
//     coordinates: { lat: 40.7505, lng: -73.9934 },
//   },
//   {
//     id: "BIN-005",
//     location: "Residential Area A",
//     address: "789 Oak Street, Residential",
//     fillLevel: 91,
//     battery: 67,
//     temperature: 23,
//     humidity: 60,
//     status: "critical",
//     lastUpdate: "4 min ago",
//     lastEmptied: "4 days ago",
//     type: "General Waste",
//     capacity: "240L",
//     coordinates: { lat: 40.7282, lng: -73.9942 },
//   },
//   {
//     id: "BIN-006",
//     location: "Business District",
//     address: "321 Corporate Plaza",
//     fillLevel: 15,
//     battery: 88,
//     temperature: 21,
//     humidity: 57,
//     status: "normal",
//     lastUpdate: "1 min ago",
//     lastEmptied: "2 hours ago",
//     type: "Recycling",
//     capacity: "360L",
//     coordinates: { lat: 40.7614, lng: -73.9776 },
//   },
// ]

const API_BASE = "http://localhost:8000"

export type Bin = {
  id: string
  location: string
  capacity_liters: number
  fill_level_percent: number
  status: string
  // Optionals for UI compatibility
  battery?: number
  temperature?: number
  humidity?: number
  lastUpdate?: string
  lastEmptied?: string
  type?: string
  address?: string
  capacity?: string
  coordinates?: { lat: number; lng: number }
}

export function BinManagement() {
  const [bins, setBins] = useState<Bin[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null)

  const fetchBins = async () => {
    try {
      const res = await fetch(`${API_BASE}/bins`)
      if (!res.ok) throw new Error("Failed to fetch bins")
      const data = await res.json()
      setBins(data)
    } catch (err) {
      // Optionally show error toast
    }
  }

  useEffect(() => {
    fetchBins()
  }, [])

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical":
        return <AlertTriangle className="h-4 w-4" />
      case "warning":
        return <Clock className="h-4 w-4" />
      case "normal":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const filteredBins = bins.filter((bin) => {
    const matchesSearch =
      bin.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bin.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bin.address.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || bin.status === statusFilter
    const matchesType = typeFilter === "all" || bin.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const stats = {
    total: bins.length,
    critical: bins.filter((b) => b.status === "critical").length,
    warning: bins.filter((b) => b.status === "warning").length,
    normal: bins.filter((b) => b.status === "normal").length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Bin Management</h2>
        <p className="text-muted-foreground">Monitor and manage all waste collection bins across your network.</p>
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
          <CardDescription>Comprehensive view of all waste collection bins</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="table" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="cards">Card View</TabsTrigger>
              </TabsList>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search bins..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="General Waste">General Waste</SelectItem>
                    <SelectItem value="Recycling">Recycling</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            <TabsContent value="table">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bin ID</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Fill Level</TableHead>
                      <TableHead>Battery</TableHead>
                      <TableHead>Temperature</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBins.map((bin) => (
                      <TableRow key={bin.id}>
                        <TableCell className="font-medium">{bin.id}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                            {bin.location}
                          </div>
                        </TableCell>
                        <TableCell>{bin.type}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Progress value={bin.fillLevel} className="w-16 h-2" />
                            <span className="text-sm">{bin.fillLevel}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Battery className="h-3 w-3 mr-1 text-muted-foreground" />
                            {bin.battery}%
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Thermometer className="h-3 w-3 mr-1 text-muted-foreground" />
                            {bin.temperature}°C
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getStatusColor(bin.status))}>
                            {getStatusIcon(bin.status)}
                            <span className="ml-1">{getStatusText(bin.status)}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{bin.lastUpdate}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedBin(bin)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Bin Details - {selectedBin?.id}</DialogTitle>
                                <DialogDescription>Detailed information and sensor data for this bin</DialogDescription>
                              </DialogHeader>
                              {selectedBin && (
                                <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <h4 className="font-medium">Location Information</h4>
                                      <div className="text-sm space-y-1">
                                        <p>
                                          <strong>Location:</strong> {selectedBin.location}
                                        </p>
                                        <p>
                                          <strong>Address:</strong> {selectedBin.address}
                                        </p>
                                        <p>
                                          <strong>Type:</strong> {selectedBin.type}
                                        </p>
                                        <p>
                                          <strong>Capacity:</strong> {selectedBin.capacity}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <h4 className="font-medium">Sensor Data</h4>
                                      <div className="text-sm space-y-1">
                                        <p>
                                          <strong>Fill Level:</strong> {selectedBin.fillLevel}%
                                        </p>
                                        <p>
                                          <strong>Battery:</strong> {selectedBin.battery}%
                                        </p>
                                        <p>
                                          <strong>Temperature:</strong> {selectedBin.temperature}°C
                                        </p>
                                        <p>
                                          <strong>Humidity:</strong> {selectedBin.humidity}%
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="font-medium">Status & History</h4>
                                    <div className="text-sm space-y-1">
                                      <p>
                                        <strong>Current Status:</strong>
                                        <Badge className={cn("ml-2 text-xs", getStatusColor(selectedBin.status))}>
                                          {getStatusText(selectedBin.status)}
                                        </Badge>
                                      </p>
                                      <p>
                                        <strong>Last Update:</strong> {selectedBin.lastUpdate}
                                      </p>
                                      <p>
                                        <strong>Last Emptied:</strong> {selectedBin.lastEmptied}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="cards">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredBins.map((bin) => (
                  <Card key={bin.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{bin.id}</CardTitle>
                        <Badge className={cn("text-xs", getStatusColor(bin.status))}>
                          {getStatusIcon(bin.status)}
                          <span className="ml-1">{getStatusText(bin.status)}</span>
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {bin.location}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Fill Level</span>
                        <div className="flex items-center space-x-2">
                          <Progress value={bin.fillLevel} className="w-20 h-2" />
                          <span className="text-sm font-medium">{bin.fillLevel}%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center">
                          <Battery className="h-3 w-3 mr-1 text-muted-foreground" />
                          {bin.battery}%
                        </div>
                        <div className="flex items-center">
                          <Thermometer className="h-3 w-3 mr-1 text-muted-foreground" />
                          {bin.temperature}°C
                        </div>
                        <div className="flex items-center">
                          <Droplets className="h-3 w-3 mr-1 text-muted-foreground" />
                          {bin.humidity}%
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Updated {bin.lastUpdate}</span>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedBin(bin)}>
                              <Eye className="h-3 w-3 mr-1" />
                              Details
                            </Button>
                          </DialogTrigger>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
