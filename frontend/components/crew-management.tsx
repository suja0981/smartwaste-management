"use client"

/**
 * components/crew-management.tsx
 *
 * Added in this version:
 * — "Add Crew" button → CreateCrewDialog (POST /crews)
 * — Edit icon on each crew card → EditCrewDialog (PATCH /crews/:id)
 * — Delete icon on each crew card → DeleteCrewDialog (DELETE /crews/:id)
 * — Auto-generates a slug-style crew ID from the name on creation
 * — All mutations use existing api-client helpers: createCrew / updateCrew / deleteCrew
 */

import { useEffect, useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import {
  assignCrewZone,
  getCrews, getTasks, assignTask, updateTask,
  createCrew, updateCrew, deleteCrew,
  createTask, deleteTask,
  type Crew, type Task, type CreateCrewRequest, type UpdateCrewRequest,
  type CreateTaskRequest, type UpdateTaskRequest,
} from "@/lib/api-client"
import { buildZoneOptions, getZoneLabel, UNASSIGNED_ZONE } from "@/lib/zone-utils"
import {
  Search, Users, Clock, CheckCircle, AlertTriangle,
  MapPin, Phone, Mail, Loader2, RefreshCw, Plus, Pencil, Trash2,
  Calendar, FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts "Alpha Team" → "crew-alpha-team-<4 random hex>" */
function generateCrewId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")
  return `crew-${slug}-${rand}`
}

/** Converts "Collect Bin Alpha" → "task-collect-bin-alpha-<4 random hex>" */
function generateTaskId(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")
  return `task-${slug}-${rand}`
}

// ─── CreateCrewDialog ─────────────────────────────────────────────────────────

interface CreateCrewDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const EMPTY_CREATE: Omit<CreateCrewRequest, "id"> = {
  name: "",
  leader: "",
  members_count: 1,
  phone: "",
  email: "",
  current_latitude: undefined,
  current_longitude: undefined,
}

function CreateCrewDialog({ open, onClose, onCreated }: CreateCrewDialogProps) {
  const [form, setForm] = useState(EMPTY_CREATE)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Reset form whenever dialog opens
  useEffect(() => {
    if (open) setForm(EMPTY_CREATE)
  }, [open])

  const set = (key: keyof typeof EMPTY_CREATE, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.leader.trim()) {
      toast({ title: "Validation error", description: "Name and leader are required.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      await createCrew({
        id: generateCrewId(form.name),
        name: form.name.trim(),
        leader: form.leader.trim(),
        members_count: Number(form.members_count) || 1,
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
        current_latitude: form.current_latitude,
        current_longitude: form.current_longitude,
      })
      toast({ title: "Crew created", description: `${form.name} has been added.` })
      onCreated()
      onClose()
    } catch (err) {
      toast({
        title: "Failed to create crew",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Crew</DialogTitle>
          <DialogDescription>Register a new field crew for task assignment.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="c-name">Crew Name <span className="text-destructive">*</span></Label>
              <Input
                id="c-name"
                placeholder="e.g. Alpha Team"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="c-leader">Team Leader <span className="text-destructive">*</span></Label>
              <Input
                id="c-leader"
                placeholder="Full name"
                value={form.leader}
                onChange={(e) => set("leader", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-members">Members</Label>
              <Input
                id="c-members"
                type="number"
                min={1}
                max={50}
                value={form.members_count}
                onChange={(e) => set("members_count", parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input
                id="c-phone"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                placeholder="crew@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-lat">Latitude</Label>
              <Input
                id="c-lat"
                type="number"
                step="any"
                placeholder="21.1458"
                value={form.current_latitude ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    current_latitude: e.target.value ? parseFloat(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-lng">Longitude</Label>
              <Input
                id="c-lng"
                type="number"
                step="any"
                placeholder="79.0882"
                value={form.current_longitude ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    current_longitude: e.target.value ? parseFloat(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Crew
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── EditCrewDialog ───────────────────────────────────────────────────────────

interface EditCrewDialogProps {
  crew: Crew | null
  onClose: () => void
  onUpdated: () => void
}

function EditCrewDialog({ crew, onClose, onUpdated }: EditCrewDialogProps) {
  const [form, setForm] = useState<UpdateCrewRequest>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Populate form when dialog opens
  useEffect(() => {
    if (crew) {
      setForm({
        name: crew.name,
        leader: crew.leader,
        members_count: crew.members_count,
        status: crew.status,
        phone: crew.phone ?? "",
        email: crew.email ?? "",
        current_location: crew.current_location ?? "",
        current_latitude: crew.current_latitude,
        current_longitude: crew.current_longitude,
      })
    }
  }, [crew])

  const set = <K extends keyof UpdateCrewRequest>(key: K, value: UpdateCrewRequest[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    if (!crew) return
    if (!form.name?.trim() || !form.leader?.trim()) {
      toast({ title: "Validation error", description: "Name and leader are required.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      await updateCrew(crew.id, {
        ...form,
        name: form.name?.trim(),
        leader: form.leader?.trim(),
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
        current_location: form.current_location?.trim() || undefined,
      })
      toast({ title: "Crew updated", description: `${form.name} has been updated.` })
      onUpdated()
      onClose()
    } catch (err) {
      toast({
        title: "Failed to update crew",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!crew} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Crew</DialogTitle>
          <DialogDescription>Update details for {crew?.name}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Crew Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Team Leader <span className="text-destructive">*</span></Label>
              <Input
                value={form.leader ?? ""}
                onChange={(e) => set("leader", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Members</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.members_count ?? ""}
                onChange={(e) => set("members_count", parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? ""} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="break">On Break</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Current Location</Label>
              <Input
                placeholder="e.g. North Zone Depot"
                value={form.current_location ?? ""}
                onChange={(e) => set("current_location", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input
                type="number"
                step="any"
                value={form.current_latitude ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    current_latitude: e.target.value ? parseFloat(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input
                type="number"
                step="any"
                value={form.current_longitude ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    current_longitude: e.target.value ? parseFloat(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── DeleteCrewDialog ─────────────────────────────────────────────────────────

interface DeleteCrewDialogProps {
  crew: Crew | null
  onClose: () => void
  onDeleted: () => void
}

function DeleteCrewDialog({ crew, onClose, onDeleted }: DeleteCrewDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!crew) return
    setDeleting(true)
    try {
      await deleteCrew(crew.id)
      toast({ title: "Crew removed", description: `${crew.name} has been deleted.` })
      onDeleted()
      onClose()
    } catch (err) {
      toast({
        title: "Failed to delete crew",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={!!crew} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {crew?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the crew and cannot be undone. Any tasks
            currently assigned to this crew will become unassigned.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete Crew
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── CreateTaskDialog ─────────────────────────────────────────────────────────

interface CreateTaskDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const EMPTY_TASK_CREATE: Omit<CreateTaskRequest, "id"> = {
  title: "",
  description: "",
  priority: "medium",
  location: "",
  bin_id: undefined,
  estimated_time_minutes: 30,
  due_date: undefined,
}

function CreateTaskDialog({ open, onClose, onCreated }: CreateTaskDialogProps) {
  const [form, setForm] = useState(EMPTY_TASK_CREATE)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) setForm(EMPTY_TASK_CREATE)
  }, [open])

  const set = (key: keyof typeof EMPTY_TASK_CREATE, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.location.trim()) {
      toast({
        title: "Validation error",
        description: "Title and location are required.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      await createTask({
        id: generateTaskId(form.title),
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
        priority: form.priority,
        location: form.location.trim(),
        bin_id: form.bin_id,
        estimated_time_minutes: form.estimated_time_minutes || 30,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      })
      toast({ title: "Task created", description: `${form.title} has been added.` })
      onCreated()
      onClose()
    } catch (err) {
      toast({
        title: "Failed to create task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task and assign it to a crew.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Task Title <span className="text-destructive">*</span></Label>
            <Input
              id="t-title"
              placeholder="e.g. Collect Bin Alpha"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Input
              id="t-desc"
              placeholder="Task description..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-location">Location <span className="text-destructive">*</span></Label>
            <Input
              id="t-location"
              placeholder="e.g. Street 5, Main Market"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-priority">Priority</Label>
              <Select value={form.priority} onValueChange={(val) => set("priority", val)}>
                <SelectTrigger id="t-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-time">Est. Time (mins)</Label>
              <Input
                id="t-time"
                type="number"
                min={5}
                max={480}
                value={form.estimated_time_minutes || 30}
                onChange={(e) => set("estimated_time_minutes", parseInt(e.target.value) || 30)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-due">Due Date</Label>
            <Input
              id="t-due"
              type="date"
              value={form.due_date ? form.due_date.toString().split("T")[0] : ""}
              onChange={(e) => set("due_date", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-bin">Bin ID (optional)</Label>
            <Input
              id="t-bin"
              placeholder="e.g. bin-001"
              value={form.bin_id || ""}
              onChange={(e) => set("bin_id", e.target.value || undefined)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── EditTaskDialog ───────────────────────────────────────────────────────────

interface EditTaskDialogProps {
  task: Task | null
  onClose: () => void
  onUpdated: () => void
}

function EditTaskDialog({ task, onClose, onUpdated }: EditTaskDialogProps) {
  const [form, setForm] = useState<UpdateTaskRequest>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        priority: task.priority,
        status: task.status,
        location: task.location,
        estimated_time_minutes: task.estimated_time_minutes,
      })
    }
  }, [task])

  const set = <K extends keyof UpdateTaskRequest>(key: K, value: UpdateTaskRequest[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    if (!task) return
    if (!form.title?.trim() || !form.location?.trim()) {
      toast({
        title: "Validation error",
        description: "Title and location are required.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      await updateTask(task.id, {
        ...form,
        title: form.title?.trim(),
        description: form.description?.trim() || undefined,
        location: form.location?.trim(),
      })
      toast({ title: "Task updated", description: `${form.title} has been updated.` })
      onUpdated()
      onClose()
    } catch (err) {
      toast({
        title: "Failed to update task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update task details and status.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="et-title">Task Title <span className="text-destructive">*</span></Label>
            <Input
              id="et-title"
              placeholder="e.g. Collect Bin Alpha"
              value={form.title || ""}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="et-desc">Description</Label>
            <Input
              id="et-desc"
              placeholder="Task description..."
              value={form.description || ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="et-location">Location <span className="text-destructive">*</span></Label>
            <Input
              id="et-location"
              placeholder="e.g. Street 5, Main Market"
              value={form.location || ""}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="et-priority">Priority</Label>
              <Select value={form.priority || "medium"} onValueChange={(val) => set("priority", val)}>
                <SelectTrigger id="et-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="et-status">Status</Label>
              <Select value={form.status || "pending"} onValueChange={(val) => set("status", val)}>
                <SelectTrigger id="et-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="et-time">Est. Time (mins)</Label>
            <Input
              id="et-time"
              type="number"
              min={5}
              max={480}
              value={form.estimated_time_minutes || 30}
              onChange={(e) => set("estimated_time_minutes", parseInt(e.target.value) || 30)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── DeleteTaskDialog ─────────────────────────────────────────────────────────

interface DeleteTaskDialogProps {
  task: Task | null
  onClose: () => void
  onDeleted: () => void
}

function DeleteTaskDialog({ task, onClose, onDeleted }: DeleteTaskDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!task) return
    setDeleting(true)
    try {
      await deleteTask(task.id)
      toast({ title: "Task removed", description: `Task has been deleted.` })
      onDeleted()
      onClose()
    } catch (err) {
      toast({
        title: "Failed to delete task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {task?.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the task and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete Task
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── CrewManagement (main component) ─────────────────────────────────────────

export function CrewManagement() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [zoneFilter, setZoneFilter] = useState("all")
  const [updatingCrewZoneId, setUpdatingCrewZoneId] = useState<string | null>(null)

  // Dialog state
  const [showCreate, setShowCreate] = useState(false)
  const [editCrew, setEditCrew] = useState<Crew | null>(null)
  const [deletingCrew, setDeletingCrew] = useState<Crew | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)

  const { toast } = useToast()
  const { isAdmin } = useAuth()

  const fetchData = useCallback(async (silent = false) => {
    try {
      const zoneId = zoneFilter === "all" ? undefined : zoneFilter
      const [crewsData, tasksData] = await Promise.all([
        getCrews(zoneId),
        getTasks({ zone_id: zoneId }),
      ])
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
  }, [toast, zoneFilter])

  useEffect(() => { fetchData(false) }, [fetchData])

  const zoneOptions = useMemo(
    () => buildZoneOptions(crews.map((crew) => crew.zone_id)),
    [crews]
  )

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
      case "available": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "break": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "offline": return "bg-muted text-muted-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const handleTaskAssignment = async (taskId: string, crewId: string) => {
    try {
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId)
      toast({ title: "Task deleted", description: "Task has been removed." })
      fetchData(true)
      setDeletingTask(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete task",
        variant: "destructive",
      })
    }
  }

  const handleCrewZoneChange = async (crewId: string, nextZone: string) => {
    setUpdatingCrewZoneId(crewId)
    try {
      await assignCrewZone(crewId, nextZone === UNASSIGNED_ZONE ? undefined : nextZone)
      setCrews((currentCrews) =>
        currentCrews.map((crew) =>
          crew.id === crewId
            ? { ...crew, zone_id: nextZone === UNASSIGNED_ZONE ? undefined : nextZone }
            : crew
        )
      )
      toast({
        title: "Crew zone updated",
        description:
          nextZone === UNASSIGNED_ZONE
            ? `Removed ${crewId} from any assigned zone.`
            : `${crewId} is now assigned to ${getZoneLabel(nextZone)}.`,
      })
    } catch (error) {
      toast({
        title: "Zone update failed",
        description: error instanceof Error ? error.message : "Could not update the crew zone.",
        variant: "destructive",
      })
    } finally {
      setUpdatingCrewZoneId(null)
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
    <>
      {/* ── CRUD Dialogs ── */}
      <CreateCrewDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => fetchData(true)}
      />
      <EditCrewDialog
        crew={editCrew}
        onClose={() => setEditCrew(null)}
        onUpdated={() => fetchData(true)}
      />
      <DeleteCrewDialog
        crew={deletingCrew}
        onClose={() => setDeletingCrew(null)}
        onDeleted={() => fetchData(true)}
      />
      <CreateTaskDialog
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onCreated={() => fetchData(true)}
      />
      <EditTaskDialog
        task={editTask}
        onClose={() => setEditTask(null)}
        onUpdated={() => fetchData(true)}
      />
      <DeleteTaskDialog
        task={deletingTask}
        onClose={() => setDeletingTask(null)}
        onDeleted={() => fetchData(true)}
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Crew Management</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Assign tasks and monitor team performance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="All zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All zones</SelectItem>
                <SelectItem value={UNASSIGNED_ZONE}>Unassigned only</SelectItem>
                {zoneOptions.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {getZoneLabel(zone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => fetchData(false)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreateTask(true)} variant="secondary">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Crew
            </Button>
          </div>
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
                          {crews.filter((c) => c.status === "active" || c.status === "available").map((crew) => (
                            <SelectItem key={crew.id} value={crew.id}>{crew.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1 pt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0"
                          onClick={() => setEditTask(task)}
                          title="Edit task"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletingTask(task)}
                          title="Delete task"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
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
                      {task.crew_id && (
                        <p className="text-xs text-muted-foreground">
                          👤 {crewName(task.crew_id) ?? task.crew_id}
                        </p>
                      )}
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => handleTaskStatusChange(task.id, "completed")}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Mark Complete
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditTask(task)}
                          title="Edit task"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletingTask(task)}
                          title="Delete task"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
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
                      <div className="flex gap-1 pt-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0"
                          onClick={() => setEditTask(task)}
                          title="Edit task"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletingTask(task)}
                          title="Delete task"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
                        <TableHead className="w-16">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
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
                          <TableCell className="text-sm">
                            {task.crew_id
                              ? crewName(task.crew_id)
                              : <span className="text-muted-foreground">Unassigned</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.due_date ? new Date(task.due_date).toLocaleDateString("en-IN") : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0"
                                onClick={() => setEditTask(task)}
                                title="Edit task"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeletingTask(task)}
                                title="Delete task"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
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
                  <p className="text-sm mb-4">No crews registered yet.</p>
                  <Button size="sm" onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Crew
                  </Button>
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
                        <div className="flex items-center gap-1">
                          <Badge className={cn("text-xs", getCrewStatusColor(crew.status))}>
                            {crew.status}
                          </Badge>
                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditCrew(crew)}
                            aria-label={`Edit ${crew.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingCrew(crew)}
                            aria-label={`Delete ${crew.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Members</p>
                          <p className="font-semibold">{crew.members_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Zone</p>
                          <p className="font-semibold">{getZoneLabel(crew.zone_id)}</p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="border-t pt-3">
                          <p className="mb-2 text-xs text-muted-foreground">Assign zone</p>
                          <Select
                            value={crew.zone_id || UNASSIGNED_ZONE}
                            onValueChange={(value) => handleCrewZoneChange(crew.id, value)}
                            disabled={updatingCrewZoneId === crew.id}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED_ZONE}>Unassigned</SelectItem>
                              {zoneOptions.map((zone) => (
                                <SelectItem key={zone} value={zone}>
                                  {getZoneLabel(zone)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
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
    </>
  )
}
