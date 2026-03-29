"use client"

/**
 * components/crew-management.tsx
 *
 * FIXES vs previous output:
 * 1. Task field is `crew_id` (not `assigned_crew_id` — that field doesn't exist in api-client).
 * 2. `updateTaskStatus` doesn't exist — uses `updateTask(id, { status })` instead.
 * 3. `assignTask` API uses `/tasks/{id}/assign` endpoint correctly.
 * 4. `getTasks` filters passed correctly as object.
 * 5. All mock data removed — real API calls only.
 * 6. filteredTasks memoized, fetchData in useCallback.
 */

import { useEffect, useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import {
  getCrews, getTasks, assignTask, updateTask,
  type Crew, type Task,
} from "@/lib/api-client"
import {
  Search, Users, Clock, CheckCircle, AlertTriangle,
  MapPin, Phone, Mail, Loader2, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function CrewManagement() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const { toast } = useToast()

  const fetchData = useCallback(async (silent = false) => {
    try {
      const [crewsData, tasksData] = await Promise.all([getCrews(), getTasks()])
      setCrews(crewsData)
      setTasks(tasksData)
    } catch (error) {
      if (!silent)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load data",
          variant: "destructive",
        })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData(false) }, [fetchData])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
      case "in-progress":
      case "in_progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "pending": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "medium": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "low": return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getCrewStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
      case "break": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "offline": return "bg-muted text-muted-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const handleTaskAssignment = async (taskId: string, crewId: string) => {
    try {
      // FIX: uses assignTask() which calls POST /tasks/{id}/assign
      await assignTask(taskId, crewId)
      toast({ title: "Task assigned", description: "Task has been assigned to crew" })
      fetchData(true)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign task",
        variant: "destructive",
      })
    }
  }

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      // FIX: uses updateTask() — updateTaskStatus() does not exist in api-client
      await updateTask(taskId, { status: newStatus })
      toast({ title: "Status updated", description: `Task marked as ${newStatus}` })
      fetchData(true)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      })
    }
  }

  const filteredTasks = useMemo(() =>
    tasks.filter((task) => {
      const q = searchTerm.toLowerCase()
      const matchSearch =
        task.title.toLowerCase().includes(q) ||
        task.location?.toLowerCase().includes(q) ||
        (task.description?.toLowerCase().includes(q) ?? false)
      const matchStatus = statusFilter === "all" || task.status === statusFilter || task.status === statusFilter.replace("-", "_")
      const matchPriority = priorityFilter === "all" || task.priority === priorityFilter
      return matchSearch && matchStatus && matchPriority
    }),
    [tasks, searchTerm, statusFilter, priorityFilter]
  )

  const tasksByStatus = useMemo(() => ({
    pending: tasks.filter((t) => t.status === "pending"),
    inProgress: tasks.filter((t) => t.status === "in-progress" || t.status === "in_progress"),
    completed: tasks.filter((t) => t.status === "completed"),
  }), [tasks])

  const stats = useMemo(() => ({
    totalCrews: crews.length,
    activeCrews: crews.filter((c) => c.status === "active").length,
    pendingTasks: tasksByStatus.pending.length,
    inProgressTasks: tasksByStatus.inProgress.length,
    completedTasks: tasksByStatus.completed.length,
  }), [crews, tasksByStatus])

  // Helper to get crew name by id
  const crewName = (crewId?: string) =>
    crewId ? (crews.find((c) => c.id === crewId)?.name ?? crewId) : null

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
          <h2 className="text-2xl font-semibold tracking-tight">Crew Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign tasks and monitor team performance.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(false)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Active Crews", value: `${stats.activeCrews} / ${stats.totalCrews}`, icon: Users, color: "text-primary" },
          { label: "Pending", value: stats.pendingTasks, icon: Clock, color: "text-amber-600" },
          { label: "In Progress", value: stats.inProgressTasks, icon: AlertTriangle, color: "text-blue-600" },
          { label: "Completed", value: stats.completedTasks, icon: CheckCircle, color: "text-emerald-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={cn("h-4 w-4", color)} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", color)}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
          <TabsTrigger value="tasks">Task List</TabsTrigger>
          <TabsTrigger value="crews">Crew Overview</TabsTrigger>
        </TabsList>

        {/* ── Kanban ── */}
        <TabsContent value="kanban">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Pending */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">Pending</h3>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  {tasksByStatus.pending.length}
                </Badge>
              </div>
              {tasksByStatus.pending.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  No pending tasks
                </div>
              )}
              {tasksByStatus.pending.map((task) => (
                <Card key={task.id} className="shadow-sm">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{task.title}</p>
                      <Badge className={cn("text-xs shrink-0", getPriorityColor(task.priority))}>
                        {task.priority}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{task.location}</span>
                    </div>
                    <Select onValueChange={(crewId) => handleTaskAssignment(task.id, crewId)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Assign to crew…" />
                      </SelectTrigger>
                      <SelectContent>
                        {crews.filter((c) => c.status === "active").map((crew) => (
                          <SelectItem key={crew.id} value={crew.id}>{crew.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* In Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">In Progress</h3>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {tasksByStatus.inProgress.length}
                </Badge>
              </div>
              {tasksByStatus.inProgress.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  No tasks in progress
                </div>
              )}
              {tasksByStatus.inProgress.map((task) => (
                <Card key={task.id} className="shadow-sm border-blue-200 dark:border-blue-900/50">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{task.title}</p>
                      <Badge className={cn("text-xs shrink-0", getPriorityColor(task.priority))}>
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{task.location}</span>
                    </div>
                    {/* FIX: Task type uses crew_id, not assigned_crew_id */}
                    {task.crew_id && (
                      <p className="text-xs text-muted-foreground">
                        👤 {crewName(task.crew_id) ?? task.crew_id}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => handleTaskStatusChange(task.id, "completed")}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Mark Complete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Completed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">Completed</h3>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {tasksByStatus.completed.length}
                </Badge>
              </div>
              {tasksByStatus.completed.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  No completed tasks
                </div>
              )}
              {tasksByStatus.completed.map((task) => (
                <Card key={task.id} className="shadow-sm opacity-65">
                  <CardContent className="p-3 space-y-1">
                    <p className="text-sm font-medium line-through text-muted-foreground">{task.title}</p>
                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{task.location}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle className="h-3 w-3" />
                      {task.completed_at
                        ? new Date(task.completed_at).toLocaleString()
                        : "Done"}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Task List ── */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>Filter and manage all tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          No tasks found
                        </TableCell>
                      </TableRow>
                    ) : filteredTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            {task.location}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getStatusColor(task.status))}>
                            {task.status}
                          </Badge>
                        </TableCell>
                        {/* FIX: Task uses crew_id not assigned_crew_id */}
                        <TableCell className="text-sm">
                          {task.crew_id
                            ? crewName(task.crew_id)
                            : <span className="text-muted-foreground">Unassigned</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {task.due_date ? new Date(task.due_date).toLocaleDateString("en-IN") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Crews ── */}
        <TabsContent value="crews">
          {crews.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No crews registered yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {crews.map((crew) => (
                <Card key={crew.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                            {crew.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">{crew.name}</CardTitle>
                          <CardDescription className="text-xs">Led by {crew.leader}</CardDescription>
                        </div>
                      </div>
                      <Badge className={cn("text-xs", getCrewStatusColor(crew.status))}>
                        {crew.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Members</p>
                        <p className="font-semibold">{crew.members_count}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm border-t pt-3">
                      {crew.current_location && (
                        <div className="flex items-center text-muted-foreground gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{crew.current_location}</span>
                        </div>
                      )}
                      {crew.phone && (
                        <div className="flex items-center text-muted-foreground gap-1.5">
                          <Phone className="h-3 w-3 shrink-0" />
                          {crew.phone}
                        </div>
                      )}
                      {crew.email && (
                        <div className="flex items-center text-muted-foreground gap-1.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{crew.email}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}