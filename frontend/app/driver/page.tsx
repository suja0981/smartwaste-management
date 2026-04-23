"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import {
  completeDriverTask,
  completeDriverWaypoint,
  getCurrentDriverRoute,
  getDriverTasks,
  updateDriverLocation,
  updateRouteStatus,
  type DriverRoute,
  type DriverTask,
} from "@/lib/api-client"

const GPS_INTERVAL_MS = 60_000

const priorityColor = (priority: string) =>
  ({ high: "#ef4444", medium: "#f59e0b", low: "#22c55e" }[priority] ?? "#6b7280")

const fillColor = (fillLevel: number) =>
  fillLevel >= 90 ? "#ef4444" : fillLevel >= 80 ? "#f59e0b" : "#22c55e"

function FillBar({ level }: { level: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${level}%`, background: fillColor(level) }}
      />
    </div>
  )
}

export default function DriverPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tasks, setTasks] = useState<DriverTask[]>([])
  const [route, setRoute] = useState<DriverRoute | null>(null)
  // Read initial tab from URL so manifest shortcuts (/driver?tab=route) work.
  const [tab, setTab] = useState<"tasks" | "route">(
    searchParams.get("tab") === "route" ? "route" : "tasks"
  )
  const [toast, setToast] = useState("")
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const gpsTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [isAuthenticated, isLoading, router])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 3000)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [taskData, routeData] = await Promise.all([getDriverTasks(), getCurrentDriverRoute()])
      setTasks(taskData)
      setRoute(routeData)
    } catch (error) {
      console.error("Driver fetch failed", error)
      showToast("Could not refresh driver data")
    }
  }, [showToast])

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [fetchData, isAuthenticated])

  // Register the PWA service worker once the driver page mounts.
  // Fails silently on unsupported browsers (e.g. Safari desktop).
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/driver" })
        .catch((err) => console.warn("[SW] Registration failed:", err))
    }
  }, [])


  useEffect(() => {
    if (!route || route.status !== "active") {
      if (gpsTimer.current) {
        clearInterval(gpsTimer.current)
        gpsTimer.current = null
      }
      return
    }

    const sendLocation = () => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateDriverLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }).catch(() => {})
        },
        () => {}
      )
    }

    sendLocation()
    gpsTimer.current = setInterval(sendLocation, GPS_INTERVAL_MS)

    return () => {
      if (gpsTimer.current) {
        clearInterval(gpsTimer.current)
        gpsTimer.current = null
      }
    }
  }, [route])

  const handleCompleteTask = async (taskId: string) => {
    setBusyKey(`task:${taskId}`)
    try {
      const result = await completeDriverTask(taskId)
      await fetchData()
      showToast(result.route_completed ? "Task done and route updated" : "Task marked complete")
    } catch {
      showToast("Could not complete task")
    } finally {
      setBusyKey(null)
    }
  }

  const handleStartRoute = async () => {
    if (!route) return
    setBusyKey(`route:start:${route.id}`)
    try {
      await updateRouteStatus(route.id, "active")
      await fetchData()
      showToast("Route started")
    } catch {
      showToast("Could not start route")
    } finally {
      setBusyKey(null)
    }
  }

  const handleCompleteWaypoint = async (binId: string) => {
    if (!route) return
    setBusyKey(`waypoint:${binId}`)
    try {
      const result = await completeDriverWaypoint(route.id, binId)
      await fetchData()
      showToast(result.route_completed ? "Last stop collected. Route completed." : `Collected ${binId}`)
    } catch {
      showToast("Could not mark waypoint complete")
    } finally {
      setBusyKey(null)
    }
  }

  const handlePauseRoute = async () => {
    if (!route) return
    setBusyKey(`route:pause:${route.id}`)
    try {
      await updateRouteStatus(route.id, "paused")
      await fetchData()
      showToast("Route paused")
    } catch {
      showToast("Could not pause route")
    } finally {
      setBusyKey(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="relative mx-auto min-h-screen max-w-[480px] bg-gray-100 font-sans">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-blue-600 px-4 py-4 text-base font-bold text-white shadow">
        <span>Smart Waste Driver</span>
        <button
          onClick={fetchData}
          className="cursor-pointer rounded-lg border-none bg-white/20 px-3 py-1.5 text-lg text-white"
          aria-label="Refresh"
        >
          ↻
        </button>
      </header>

      <nav className="sticky top-14 z-[9] flex border-b bg-white">
        {(["tasks", "route"] as const).map((nextTab) => (
          <button
            key={nextTab}
            onClick={() => setTab(nextTab)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-none py-3.5 text-sm font-semibold transition-colors ${
              tab === nextTab
                ? "border-b-[3px] border-b-blue-600 bg-transparent text-blue-600"
                : "bg-transparent text-gray-500"
            }`}
          >
            {nextTab === "tasks" ? "Tasks" : "Route"}
            {nextTab === "tasks" && tasks.length > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {tasks.length}
              </span>
            )}
            {nextTab === "route" && route && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-bold text-white ${
                  route.status === "active"
                    ? "bg-green-500"
                    : route.status === "paused"
                      ? "bg-orange-500"
                      : "bg-amber-500"
                }`}
              >
                {route.status === "active"
                  ? "Active"
                  : route.status === "paused"
                    ? "Paused"
                    : "Planned"}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="p-3 pb-20">
        {tab === "tasks" && (
          <div>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-gray-500">
                <span className="text-5xl">OK</span>
                <p className="font-medium">No pending tasks</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="mb-2.5 flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ background: priorityColor(task.priority) }}
                    />
                    <span className="flex-1 text-sm font-bold">{task.title}</span>
                  </div>
                  <p className="text-xs text-gray-500">Location: {task.location}</p>
                  {task.estimated_time_minutes && (
                    <p className="text-xs text-gray-500">About {task.estimated_time_minutes} min</p>
                  )}
                  {task.due_date && (
                    <p className="text-xs text-gray-500">
                      Due: {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  )}
                  <button
                    onClick={() => handleCompleteTask(task.id)}
                    disabled={busyKey === `task:${task.id}`}
                    className="mt-1 w-full cursor-pointer rounded-xl border-none bg-green-500 py-3 text-sm font-bold text-white disabled:opacity-70"
                  >
                    {busyKey === `task:${task.id}` ? "Saving..." : "Mark Complete"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "route" && (
          <div>
            {!route ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-gray-500">
                <span className="text-5xl">Route</span>
                <p className="font-medium">No route assigned</p>
                <p className="text-sm">Ask admin to create and assign a route for your crew.</p>
              </div>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {[
                    { value: route.total_distance_km.toFixed(1), label: "km" },
                    { value: Math.round(route.estimated_time_minutes).toString(), label: "min est." },
                    { value: route.completed_waypoints.toString(), label: "done" },
                    { value: `${route.progress_percent}%`, label: "progress" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-white p-3 text-center shadow-sm">
                      <span className="block text-2xl font-black text-blue-600">{stat.value}</span>
                      <span className="text-xs text-gray-500">{stat.label}</span>
                    </div>
                  ))}
                </div>

                {route.status === "planned" && (
                  <button
                    onClick={handleStartRoute}
                    disabled={busyKey === `route:start:${route.id}`}
                    className="mb-3 w-full cursor-pointer rounded-xl border-none bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-70"
                  >
                    {busyKey === `route:start:${route.id}` ? "Starting..." : "Start Route"}
                  </button>
                )}

                {route.status === "paused" && (
                  <button
                    onClick={handleStartRoute}
                    disabled={busyKey === `route:start:${route.id}`}
                    className="mb-3 w-full cursor-pointer rounded-xl border-none bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-70"
                  >
                    {busyKey === `route:start:${route.id}` ? "Resuming..." : "Resume Route"}
                  </button>
                )}

                {route.status === "active" && (
                  <button
                    onClick={handlePauseRoute}
                    disabled={busyKey === `route:pause:${route.id}`}
                    className="mb-3 w-full cursor-pointer rounded-xl border-none bg-orange-500 py-3 text-sm font-bold text-white disabled:opacity-70"
                  >
                    {busyKey === `route:pause:${route.id}` ? "Pausing..." : "Pause Route"}
                  </button>
                )}

                {route.waypoints.map((waypoint) => (
                  <div key={waypoint.bin_id} className="mb-2.5 flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                        {waypoint.order}
                      </span>
                      <span className="flex-1 text-sm font-bold">{waypoint.bin_id}</span>
                      <span className="text-base font-black" style={{ color: fillColor(waypoint.fill_level) }}>
                        {waypoint.fill_level}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Location: {waypoint.location}</p>
                    <FillBar level={waypoint.fill_level} />
                    <div className="flex items-center justify-between gap-2">
                      {waypoint.latitude && waypoint.longitude ? (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${waypoint.latitude},${waypoint.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-blue-600 no-underline"
                        >
                          Open in Maps
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">No coordinates</span>
                      )}

                      {waypoint.done ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Collected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCompleteWaypoint(waypoint.bin_id)}
                          disabled={route.status !== "active" || busyKey === `waypoint:${waypoint.bin_id}`}
                          className="cursor-pointer rounded-full border-none bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyKey === `waypoint:${waypoint.bin_id}` ? "Saving..." : "Mark Collected"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
