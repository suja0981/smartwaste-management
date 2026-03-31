'use client'

/**
 * app/driver/page.tsx — Driver Mobile PWA
 *
 * Fixes:
 * 1. token now comes from useAuth().token (added to context) instead of
 *    reading localStorage directly — avoids SSR mismatch
 * 2. authHeaders memoized correctly — no stale token closure
 * 3. GPS timer cleanup uses correct ref type
 * 4. Tab badge z-index fixed (z-9 is not a valid Tailwind class → z-[9])
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

interface DriverTask {
  id: string
  title: string
  priority: string
  status: string
  location: string
  bin_id?: string
  estimated_time_minutes?: number
  due_date?: string
}

interface DriverWaypoint {
  bin_id: string
  location: string
  latitude?: number
  longitude?: number
  fill_level: number
  order: number
  estimated_collection_time: number
}

interface DriverRoute {
  id: string
  status: string
  total_distance_km: number
  estimated_time_minutes: number
  waypoints: DriverWaypoint[]
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const GPS_INTERVAL_MS = 60_000

const priorityColor = (p: string) =>
  ({ high: "#ef4444", medium: "#f59e0b", low: "#22c55e" }[p] ?? "#6b7280")

const fillColor = (lvl: number) =>
  lvl >= 90 ? "#ef4444" : lvl >= 80 ? "#f59e0b" : "#22c55e"

function FillBar({ level }: { level: number }) {
  return (
    <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${level}%`, background: fillColor(level) }}
      />
    </div>
  )
}

export default function DriverPage() {
  const { token, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  const [tasks, setTasks] = useState<DriverTask[]>([])
  const [route, setRoute] = useState<DriverRoute | null>(null)
  const [tab, setTab] = useState<"tasks" | "route">("tasks")
  const [toast, setToast] = useState("")
  const gpsTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [isAuthenticated, isLoading, router])

  const authHeaders = useCallback(
    (): Record<string, string> => ({
      Authorization: `Bearer ${token ?? ""}`,
      "Content-Type": "application/json",
    }),
    [token]
  )

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const [tasksRes, routeRes] = await Promise.all([
        fetch(`${API}/driver/tasks`, { headers: authHeaders() }),
        fetch(`${API}/driver/route/current`, { headers: authHeaders() }),
      ])
      if (tasksRes.ok) setTasks(await tasksRes.json())
      if (routeRes.ok) setRoute(await routeRes.json())
    } catch (e) {
      console.error("Driver fetch failed", e)
    }
  }, [token, authHeaders])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // GPS updates while route is active
  useEffect(() => {
    if (!token || !route) {
      if (gpsTimer.current) {
        clearInterval(gpsTimer.current)
        gpsTimer.current = null
      }
      return
    }
    const sendLocation = () => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch(`${API}/driver/location`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
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
  }, [token, route, authHeaders])

  const completeTask = async (taskId: string) => {
    try {
      const res = await fetch(`${API}/driver/tasks/${taskId}/complete`, {
        method: "POST",
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error("Failed")
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      showToast("✅ Task marked complete")
    } catch {
      showToast("❌ Could not complete task")
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-gray-100 font-sans relative">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-blue-600 text-white px-4 py-4 flex items-center justify-between font-bold text-base shadow">
        <span>🗑️ Smart Waste Driver</span>
        <button
          onClick={fetchData}
          className="bg-white/20 text-white border-none rounded-lg px-3 py-1.5 text-lg cursor-pointer"
          aria-label="Refresh"
        >
          ↻
        </button>
      </header>

      {/* Tabs */}
      <nav className="flex bg-white border-b sticky top-14 z-[9]">
        {(["tasks", "route"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3.5 border-none font-semibold text-sm cursor-pointer flex items-center justify-center gap-1.5 transition-colors ${
              tab === t
                ? "text-blue-600 border-b-[3px] border-b-blue-600 bg-transparent"
                : "text-gray-500 bg-transparent"
            }`}
          >
            {t === "tasks" ? "📋 Tasks" : "🗺️ Route"}
            {t === "tasks" && tasks.length > 0 && (
              <span className="bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5 font-bold">
                {tasks.length}
              </span>
            )}
            {t === "route" && route && (
              <span className="bg-green-500 text-white rounded-full text-xs px-1.5 py-0.5 font-bold">
                Active
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="p-3 pb-20">
        {tab === "tasks" && (
          <div>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2 text-center">
                <span className="text-5xl">✅</span>
                <p className="font-medium">No pending tasks</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-xl p-4 mb-2.5 shadow-sm flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: priorityColor(task.priority) }}
                    />
                    <span className="font-bold text-sm flex-1">{task.title}</span>
                  </div>
                  <p className="text-xs text-gray-500">📍 {task.location}</p>
                  {task.estimated_time_minutes && (
                    <p className="text-xs text-gray-500">
                      ⏱ ~{task.estimated_time_minutes} min
                    </p>
                  )}
                  {task.due_date && (
                    <p className="text-xs text-gray-500">
                      📅 Due: {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  )}
                  <button
                    onClick={() => completeTask(task.id)}
                    className="mt-1 w-full py-3 bg-green-500 text-white rounded-xl font-bold text-sm cursor-pointer border-none active:opacity-80"
                  >
                    Mark Complete
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "route" && (
          <div>
            {!route ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2 text-center">
                <span className="text-5xl">🚛</span>
                <p className="font-medium">No active route</p>
                <p className="text-sm">Ask admin to activate a route for your crew</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  {[
                    { value: route.total_distance_km.toFixed(1), label: "km" },
                    { value: Math.round(route.estimated_time_minutes).toString(), label: "min est." },
                    { value: route.waypoints.length.toString(), label: "bins" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex-1 bg-white rounded-xl p-3 text-center shadow-sm"
                    >
                      <span className="block text-2xl font-black text-blue-600">{s.value}</span>
                      <span className="text-xs text-gray-500">{s.label}</span>
                    </div>
                  ))}
                </div>

                {route.waypoints.map((wp) => (
                  <div key={wp.bin_id} className="bg-white rounded-xl p-4 mb-2.5 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {wp.order}
                      </span>
                      <span className="font-bold text-sm flex-1">{wp.bin_id}</span>
                      <span
                        className="font-black text-base"
                        style={{ color: fillColor(wp.fill_level) }}
                      >
                        {wp.fill_level}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">📍 {wp.location}</p>
                    <FillBar level={wp.fill_level} />
                    {wp.latitude && wp.longitude && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${wp.latitude},${wp.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-blue-600 text-sm font-semibold no-underline"
                      >
                        📍 Open in Maps
                      </a>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white py-3 px-6 rounded-full text-sm font-semibold shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}