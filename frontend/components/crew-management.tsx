//Crew management UI. Displays crews and tasks, currently mock data.

"use client"

import { useState } from "react" 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
  Plus,
  MoreHorizontal,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data for crew management
const mockCrews = [
  {
    id: "CREW-001",
    name: "Team Alpha",
    leader: "John Smith",
    members: ["John Smith", "Mike Johnson", "Sarah Wilson"],
    status: "active",
    currentTask: "TASK-015",
    location: "Downtown District",
    phone: "+1 (555) 123-4567",
    email: "team.alpha@wastemanagement.com",
    completedTasks: 28,
    efficiency: 94,
    avatar: "/avatars/team-alpha.png",
  },
  {
    id: "CREW-002",
    name: "Team Beta",
    leader: "Emily Davis",
    members: ["Emily Davis", "Robert Brown", "Lisa Garcia"],
    status: "active",
    currentTask: "TASK-022",
    location: "Residential Area",
    phone: "+1 (555) 234-5678",
    email: "team.beta@wastemanagement.com",
    completedTasks: 31,
    efficiency: 89,
    avatar: "/avatars/team-beta.png",
  },
  {
    id: "CREW-003",
    name: "Team Gamma",
    leader: "David Martinez",
    members: ["David Martinez", "Jennifer Lee", "Tom Anderson"],
    status: "break",
    currentTask: null,
    location: "Central Hub",
    phone: "+1 (555) 345-6789",
    email: "team.gamma@wastemanagement.com",
    completedTasks: 25,
    efficiency: 91,
    avatar: "/avatars/team-gamma.png",
  },
  {
    id: "CREW-004",
    name: "Team Delta",
    leader: "Maria Rodriguez",
    members: ["Maria Rodriguez", "Kevin White", "Amanda Taylor"],
    status: "active",
    currentTask: "TASK-008",
    location: "Shopping District",
    phone: "+1 (555) 456-7890",
    email: "team.delta@wastemanagement.com",
    completedTasks: 33,
    efficiency: 87,
    avatar: "/avatars/team-delta.png",
  },
]

const mockTasks = [
  {
    id: "TASK-001",
    title: "Empty Overflowing Bin - Main St",
    description: "Bin BIN-001 is at 95% capacity and needs immediate attention",
    priority: "high",
    status: "pending",
    assignedTo: null,
    binId: "BIN-001",
    location: "Main Street & 5th Ave",
    estimatedTime: "30 min",
    createdAt: "2024-01-15T09:00:00Z",
    dueDate: "2024-01-15T12:00:00Z",
    alertId: "ALERT-001",
  },
  {
    id: "TASK-002",
    title: "Clean Spill - Central Park",
    description: "Liquid spill detected around waste collection area",
    priority: "medium",
    status: "in-progress",
    assignedTo: "CREW-002",
    binId: "BIN-002",
    location: "Central Park North",
    estimatedTime: "45 min",
    createdAt: "2024-01-15T08:30:00Z",
    dueDate: "2024-01-15T11:30:00Z",
    alertId: "ALERT-002",
  },
  {
    id: "TASK-003",
    title: "Repair Damaged Bin",
    description: "Bin appears damaged and needs maintenance",
    priority: "low",
    status: "completed",
    assignedTo: "CREW-003",
    binId: "BIN-004",
    location: "University Campus",
    estimatedTime: "60 min",
    createdAt: "2024-01-15T07:00:00Z",
    dueDate: "2024-01-15T10:00:00Z",
    completedAt: "2024-01-15T09:45:00Z",
    alertId: "ALERT-004",
  },
  {
    id: "TASK-004",
    title: "Routine Collection - Residential",
    description: "Scheduled waste collection for residential area",
    priority: "medium",
    status: "in-progress",
    assignedTo: "CREW-001",
    binId: "BIN-005",
    location: "Residential Area A",
    estimatedTime: "90 min",
    createdAt: "2024-01-15T06:00:00Z",
    dueDate: "2024-01-15T14:00:00Z",
    alertId: null,
  },
  {
    id: "TASK-005",
    title: "Emergency Cleanup - Shopping District",
    description: "Large spill requiring immediate cleanup",
    priority: "high",
    status: "pending",
    assignedTo: null,
    binId: "BIN-003",
    location: "Shopping District",
    estimatedTime: "120 min",
    createdAt: "2024-01-15T10:15:00Z",
    dueDate: "2024-01-15T13:00:00Z",
    alertId: "ALERT-005",
  },
]

export function CrewManagement() {
  const [tasks, setTasks] = useState(mockTasks)
  const [crews] = useState(mockCrews)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [selectedCrew, setSelectedCrew] = useState<(typeof mockCrews)[0] | null>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-primary text-primary-foreground"
      case "in-progress":
        return "bg-secondary text-secondary-foreground"
      case "pending":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
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

  const getCrewStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary text-primary-foreground"
      case "break":
        return "bg-secondary text-secondary-foreground"
      case "offline":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const handleTaskAssignment = (taskId: string, crewId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              assignedTo: crewId,
              status: "in-progress",
            }
          : task,
      ),
    )
  }

  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: newStatus,
              completedAt: newStatus === "completed" ? new Date().toISOString() : undefined,
            }
          : task,
      ),
    )
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  const tasksByStatus = {
    pending: tasks.filter((t) => t.status === "pending"),
    "in-progress": tasks.filter((t) => t.status === "in-progress"),
    completed: tasks.filter((t) => t.status === "completed"),
  }

  const stats = {
    totalCrews: crews.length,
    activeCrews: crews.filter((c) => c.status === "active").length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === "completed").length,
    pendingTasks: tasks.filter((t) => t.status === "pending").length,
    inProgressTasks: tasks.filter((t) => t.status === "in-progress").length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Crew Management</h2>
        <p className="text-muted-foreground">Manage crew assignments, track tasks, and monitor team performance.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Crews</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCrews}</div>
            <p className="text-xs text-muted-foreground">of {stats.totalCrews} total crews</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.pendingTasks}</div>
            <p className="text-xs text-muted-foreground">Awaiting assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <AlertTriangle className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{stats.inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">Tasks finished</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
          <TabsTrigger value="tasks">Task List</TabsTrigger>
          <TabsTrigger value="crews">Crew Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Pending Column */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pending</span>
                  <Badge variant="destructive">{tasksByStatus.pending.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tasksByStatus.pending.map((task) => (
                  <Card key={task.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <Badge className={cn("text-xs", getPriorityColor(task.priority))}>{task.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {task.location}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {task.estimatedTime}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Select
                          value={task.assignedTo || ""}
                          onValueChange={(value) => handleTaskAssignment(task.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Assign crew" />
                          </SelectTrigger>
                          <SelectContent>
                            {crews
                              .filter((crew) => crew.status === "active")
                              .map((crew) => (
                                <SelectItem key={crew.id} value={crew.id}>
                                  {crew.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* In Progress Column */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>In Progress</span>
                  <Badge variant="secondary">{tasksByStatus["in-progress"].length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tasksByStatus["in-progress"].map((task) => (
                  <Card key={task.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <Badge className={cn("text-xs", getPriorityColor(task.priority))}>{task.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {task.location}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {task.estimatedTime}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs">
                          Assigned to: {crews.find((c) => c.id === task.assignedTo)?.name}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTaskStatusChange(task.id, "completed")}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* Completed Column */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Completed</span>
                  <Badge variant="default">{tasksByStatus.completed.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tasksByStatus.completed.map((task) => (
                  <Card key={task.id} className="p-3 opacity-75">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <Badge className={cn("text-xs", getPriorityColor(task.priority))}>{task.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {task.location}
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1 text-primary" />
                          Completed
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        By: {crews.find((c) => c.id === task.assignedTo)?.name}
                      </div>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Task Management</CardTitle>
              <CardDescription>View and manage all tasks with filtering options</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tasks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{task.title}</div>
                            <div className="text-sm text-muted-foreground">{task.description}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                            {task.location}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getPriorityColor(task.priority))}>{task.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getStatusColor(task.status))}>{task.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {task.assignedTo ? crews.find((c) => c.id === task.assignedTo)?.name : "Unassigned"}
                        </TableCell>
                        <TableCell className="text-sm">{new Date(task.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crews">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {crews.map((crew) => (
              <Card key={crew.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={crew.avatar || "/placeholder.svg"} alt={crew.name} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{crew.name}</CardTitle>
                        <CardDescription>Led by {crew.leader}</CardDescription>
                      </div>
                    </div>
                    <Badge className={cn("text-xs", getCrewStatusColor(crew.status))}>{crew.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Members:</span>
                      <div className="font-medium">{crew.members.length}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Efficiency:</span>
                      <div className="font-medium">{crew.efficiency}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completed:</span>
                      <div className="font-medium">{crew.completedTasks}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current:</span>
                      <div className="font-medium">
                        {crew.currentTask ? tasks.find((t) => t.id === crew.currentTask)?.title || "N/A" : "None"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center">
                      <MapPin className="h-3 w-3 mr-2 text-muted-foreground" />
                      {crew.location}
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-3 w-3 mr-2 text-muted-foreground" />
                      {crew.phone}
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-3 w-3 mr-2 text-muted-foreground" />
                      {crew.email}
                    </div>
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full bg-transparent" onClick={() => setSelectedCrew(crew)}>
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Crew Details - {selectedCrew?.name}</DialogTitle>
                        <DialogDescription>
                          Detailed information about this crew and their performance
                        </DialogDescription>
                      </DialogHeader>
                      {selectedCrew && (
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <h4 className="font-medium">Team Information</h4>
                              <div className="text-sm space-y-1">
                                <p>
                                  <strong>Team Leader:</strong> {selectedCrew.leader}
                                </p>
                                <p>
                                  <strong>Members:</strong>
                                </p>
                                <ul className="ml-4 list-disc">
                                  {selectedCrew.members.map((member) => (
                                    <li key={member}>{member}</li>
                                  ))}
                                </ul>
                                <p>
                                  <strong>Status:</strong>
                                  <Badge className={cn("ml-2 text-xs", getCrewStatusColor(selectedCrew.status))}>
                                    {selectedCrew.status}
                                  </Badge>
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-medium">Performance Metrics</h4>
                              <div className="text-sm space-y-1">
                                <p>
                                  <strong>Efficiency:</strong> {selectedCrew.efficiency}%
                                </p>
                                <p>
                                  <strong>Completed Tasks:</strong> {selectedCrew.completedTasks}
                                </p>
                                <p>
                                  <strong>Current Location:</strong> {selectedCrew.location}
                                </p>
                                <p>
                                  <strong>Current Task:</strong>{" "}
                                  {selectedCrew.currentTask
                                    ? tasks.find((t) => t.id === selectedCrew.currentTask)?.title || "N/A"
                                    : "None"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-medium">Contact Information</h4>
                            <div className="text-sm space-y-1">
                              <p>
                                <strong>Phone:</strong> {selectedCrew.phone}
                              </p>
                              <p>
                                <strong>Email:</strong> {selectedCrew.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
