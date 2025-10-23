//Analytics and reports UI. Uses mock data for charts and stats.

"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { TrendingUp, TrendingDown, BarChart3, Download, Calendar } from "lucide-react"
import { addDays } from "date-fns"
import type { DateRange } from "react-day-picker"

// Mock data for analytics
const dailyDetections = [
  { date: "2024-01-08", garbage: 12, spill: 3, vandalism: 1, total: 16 },
  { date: "2024-01-09", garbage: 18, spill: 5, vandalism: 2, total: 25 },
  { date: "2024-01-10", garbage: 15, spill: 2, vandalism: 0, total: 17 },
  { date: "2024-01-11", garbage: 22, spill: 7, vandalism: 3, total: 32 },
  { date: "2024-01-12", garbage: 19, spill: 4, vandalism: 1, total: 24 },
  { date: "2024-01-13", garbage: 25, spill: 8, vandalism: 2, total: 35 },
  { date: "2024-01-14", garbage: 21, spill: 6, vandalism: 1, total: 28 },
  { date: "2024-01-15", garbage: 28, spill: 9, vandalism: 4, total: 41 },
]

const weeklyOverflow = [
  { week: "Week 1", overflowing: 8, total: 156, percentage: 5.1 },
  { week: "Week 2", overflowing: 12, total: 156, percentage: 7.7 },
  { week: "Week 3", overflowing: 15, total: 156, percentage: 9.6 },
  { week: "Week 4", overflowing: 23, total: 156, percentage: 14.7 },
  { week: "Week 5", overflowing: 18, total: 156, percentage: 11.5 },
  { week: "Week 6", overflowing: 21, total: 156, percentage: 13.5 },
]

const crewTaskCompletion = [
  { name: "Completed", value: 142, color: "hsl(var(--chart-1))" },
  { name: "In Progress", value: 28, color: "hsl(var(--chart-2))" },
  { name: "Pending", value: 15, color: "hsl(var(--chart-3))" },
  { name: "Overdue", value: 8, color: "hsl(var(--chart-4))" },
]

const binTypeDistribution = [
  { type: "General Waste", count: 89, percentage: 57.1 },
  { type: "Recycling", count: 45, percentage: 28.8 },
  { type: "Organic", count: 22, percentage: 14.1 },
]

const locationPerformance = [
  { location: "Downtown", alerts: 45, efficiency: 92, avgFillTime: 2.3 },
  { location: "Residential", alerts: 28, efficiency: 87, avgFillTime: 3.1 },
  { location: "Commercial", alerts: 67, efficiency: 78, avgFillTime: 1.8 },
  { location: "University", alerts: 23, efficiency: 94, avgFillTime: 2.8 },
  { location: "Parks", alerts: 31, efficiency: 89, avgFillTime: 4.2 },
]

const monthlyTrends = [
  { month: "Jul", collections: 1240, alerts: 89, efficiency: 87 },
  { month: "Aug", collections: 1380, alerts: 102, efficiency: 85 },
  { month: "Sep", collections: 1290, alerts: 76, efficiency: 91 },
  { month: "Oct", collections: 1450, alerts: 118, efficiency: 83 },
  { month: "Nov", collections: 1320, alerts: 94, efficiency: 88 },
  { month: "Dec", collections: 1510, alerts: 134, efficiency: 79 },
  { month: "Jan", collections: 1420, alerts: 108, efficiency: 86 },
]

export function AnalyticsReports() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  })
  const [locationFilter, setLocationFilter] = useState("all")
  const [binTypeFilter, setBinTypeFilter] = useState("all")

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive insights and performance metrics for your waste management system.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Date Range</CardTitle>
          <CardDescription>Customize your analytics view with filters and date ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            </div>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="downtown">Downtown</SelectItem>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="university">University</SelectItem>
                <SelectItem value="parks">Parks</SelectItem>
              </SelectContent>
            </Select>

            <Select value={binTypeFilter} onValueChange={setBinTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Bin Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="general">General Waste</SelectItem>
                <SelectItem value="recycling">Recycling</SelectItem>
                <SelectItem value="organic">Organic</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collections</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,420</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-primary">+12%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Detections</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">108</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-destructive">-8%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Efficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">86%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-primary">+3%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4h</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-primary">-15min</span> from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="detections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="detections">AI Detections</TabsTrigger>
          <TabsTrigger value="overflow">Bin Overflow</TabsTrigger>
          <TabsTrigger value="crew">Crew Performance</TabsTrigger>
          <TabsTrigger value="trends">Monthly Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="detections" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily AI Detections</CardTitle>
                <CardDescription>Garbage, spill, and vandalism detections over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyDetections}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                    <Legend />
                    <Line type="monotone" dataKey="garbage" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                    <Line type="monotone" dataKey="spill" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                    <Line type="monotone" dataKey="vandalism" stroke="hsl(var(--chart-3))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detection Types Distribution</CardTitle>
                <CardDescription>Breakdown of AI detection types this month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Garbage", value: 180, color: "hsl(var(--chart-1))" },
                        { name: "Spill", value: 52, color: "hsl(var(--chart-2))" },
                        { name: "Vandalism", value: 14, color: "hsl(var(--chart-3))" },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: "Garbage", value: 180, color: "hsl(var(--chart-1))" },
                        { name: "Spill", value: 52, color: "hsl(var(--chart-2))" },
                        { name: "Vandalism", value: 14, color: "hsl(var(--chart-3))" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overflow" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Bin Overflow Trends</CardTitle>
                <CardDescription>Number of bins overflowing per week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklyOverflow}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="overflowing" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bin Type Distribution</CardTitle>
                <CardDescription>Distribution of bins by waste type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {binTypeDistribution.map((item, index) => (
                    <div key={item.type} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: COLORS[index] }} />
                        <span className="text-sm font-medium">{item.type}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{item.count}</div>
                        <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="crew" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Task Completion Status</CardTitle>
                <CardDescription>Current status of all assigned tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={crewTaskCompletion}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {crewTaskCompletion.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Location Performance</CardTitle>
                <CardDescription>Alerts and efficiency by location</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {locationPerformance.map((location) => (
                    <div key={location.location} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{location.location}</span>
                        <span className="text-sm text-muted-foreground">{location.efficiency}% efficiency</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{location.alerts} alerts</span>
                        <span>{location.avgFillTime}h avg fill time</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${location.efficiency}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Performance Trends</CardTitle>
              <CardDescription>Collections, alerts, and efficiency over the past 7 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="collections"
                    stackId="1"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.6}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="efficiency"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={3}
                  />
                  <Bar yAxisId="left" dataKey="alerts" fill="hsl(var(--chart-3))" fillOpacity={0.8} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
