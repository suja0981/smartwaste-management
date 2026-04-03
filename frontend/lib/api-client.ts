/**
 * lib/api-client.ts — Centralized API client.
 *
 * Fixes:
 *  1. logout() now calls POST /auth/logout (previously only cleared localStorage)
 *  2. fetchAPI retries once on 401 using the refresh token before giving up.
 *     This prevents silent failures after the 30-minute access token expiry.
 *  3. getBins() now accepts an optional zone_id filter (Phase 6).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const TOKEN_KEY = "swm_token"
const REFRESH_TOKEN_KEY = "swm_refresh_token"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/** Attempt a token refresh and update localStorage. Returns new token or null. */
async function attemptTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    localStorage.setItem(TOKEN_KEY, data.access_token)
    return data.access_token
  } catch {
    return null
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit,
  retry = true
): Promise<T> {
  const url = `${API_URL}${endpoint}`
  const token = getAuthToken()

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  })

  // On 401, try refreshing the token once then retry
  if (response.status === 401 && retry) {
    const newToken = await attemptTokenRefresh()
    if (newToken) {
      return fetchAPI<T>(endpoint, options, false) // retry once
    }
    // Refresh failed — clear session and let the ProtectedRoute handle redirect
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem("swm_user")
    throw new ApiError("Session expired. Please sign in again.", 401)
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ApiError(
      (error as { detail?: string }).detail ||
        `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      error
    )
  }

  // 204 No Content
  if (response.status === 204) return undefined as T

  return response.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number
  email: string
  full_name: string
  role: "admin" | "user"
  is_active: boolean
}

export interface AuthResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  user: AuthUser
}

export interface LoginRequest {
  email: string
  password: string
}

export interface SignupRequest {
  email: string
  password: string
  full_name: string
}

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  })
}

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function loginWithFirebase(idToken: string): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>("/auth/firebase", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  })
}

export async function getCurrentUser(): Promise<AuthUser> {
  return fetchAPI<AuthUser>("/auth/me")
}

export interface NotificationSettings {
  criticalBins: boolean
  routeUpdates: boolean
  systemAlerts: boolean
  emailDigest: boolean
  pushEnabled: boolean
}

export interface DisplaySettings {
  compactMode: boolean
  autoRefresh: boolean
}

export interface UserSettings {
  full_name: string
  email: string
  notifications: NotificationSettings
  display: DisplaySettings
}

export async function getUserSettings(): Promise<UserSettings> {
  return fetchAPI<UserSettings>("/auth/settings")
}

export async function updateUserSettings(data: UserSettings): Promise<UserSettings> {
  return fetchAPI<UserSettings>("/auth/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function registerDeviceToken(
  token: string,
  platform = "web"
): Promise<{ registered: boolean; platform: string }> {
  return fetchAPI("/auth/device-token", {
    method: "POST",
    body: JSON.stringify({ token, platform }),
  })
}

export async function unregisterDeviceToken(
  token: string,
  platform = "web"
): Promise<{ unregistered: boolean }> {
  return fetchAPI("/auth/device-token", {
    method: "DELETE",
    body: JSON.stringify({ token, platform }),
  })
}

/**
 * FIX: Original only did localStorage.removeItem — JWT stayed valid on server.
 * Now calls POST /auth/logout to revoke the JWT server-side.
 */
export async function logout(): Promise<void> {
  const token = getAuthToken()
  if (token) {
    await fetchAPI("/auth/logout", { method: "POST" }).catch(() => {})
  }
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem("swm_user")
}

// ─── Bins ─────────────────────────────────────────────────────────────────────

export interface Bin {
  id: string
  location: string
  capacity_liters: number
  fill_level_percent: number
  status: string
  latitude?: number
  longitude?: number
  battery_percent?: number
  temperature_c?: number
  humidity_percent?: number
  last_telemetry?: string
  zone_id?: string
}

export interface CreateBinRequest {
  id: string
  location: string
  capacity_liters: number
  fill_level_percent?: number
  latitude?: number
  longitude?: number
}

export interface UpdateBinRequest {
  location?: string
  capacity_liters?: number
  fill_level_percent?: number
  status?: string
  latitude?: number
  longitude?: number
}

/** Phase 6: accepts optional zone_id filter */
export async function getBins(zoneId?: string): Promise<Bin[]> {
  const params = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : ""
  return fetchAPI<Bin[]>(`/bins${params}`)
}

export async function getBin(id: string): Promise<Bin> {
  return fetchAPI<Bin>(`/bins/${id}`)
}

export async function createBin(data: CreateBinRequest): Promise<Bin> {
  return fetchAPI<Bin>("/bins", { method: "POST", body: JSON.stringify(data) })
}

export async function updateBin(id: string, data: UpdateBinRequest): Promise<Bin> {
  return fetchAPI<Bin>(`/bins/${id}`, { method: "PATCH", body: JSON.stringify(data) })
}

export async function deleteBin(id: string): Promise<void> {
  return fetchAPI<void>(`/bins/${id}`, { method: "DELETE" })
}

export async function assignBinZone(
  id: string,
  zoneId?: string
): Promise<{ bin_id: string; zone_id?: string | null; updated: boolean }> {
  const endpoint = zoneId
    ? `/bins/${id}/zone?zone_id=${encodeURIComponent(zoneId)}`
    : `/bins/${id}/zone`
  return fetchAPI(endpoint, { method: "PATCH" })
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface TelemetryPayload {
  bin_id: string
  fill_level_percent: number
  battery_percent?: number
  temperature_c?: number
  humidity_percent?: number
  timestamp?: string
}

export async function sendTelemetry(
  data: TelemetryPayload
): Promise<{ accepted: boolean; bin_id: string }> {
  return fetchAPI("/telemetry", { method: "POST", body: JSON.stringify(data) })
}

export async function getTelemetryHistory(
  binId: string,
  limit = 100
): Promise<unknown[]> {
  return fetchAPI<unknown[]>(`/telemetry/${binId}?limit=${limit}`)
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_bins: number
  bins_online: number
  bins_full: number
  bins_warning: number
  bins_offline: number
  average_fill_level: number
  tasks: { total: number; pending: number; in_progress: number }
  crews: { available: number; active: number }
}

export interface ZoneStats {
  total: number
  full: number
  warning: number
  ok: number
  offline: number
  average_fill: number
}

export interface TrendPoint {
  date: string
  telemetry_readings: number
  average_fill: number
  tasks_created: number
  tasks_completed: number
  routes_completed: number
  bins_collected: number
  distance_km: number
}

export interface TrendStats {
  days: number
  from: string
  to: string
  series: TrendPoint[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchAPI<DashboardStats>("/stats/")
}

export async function getZoneStats(): Promise<Record<string, ZoneStats>> {
  return fetchAPI<Record<string, ZoneStats>>("/stats/zones")
}

export async function getTrendStats(days = 30): Promise<TrendStats> {
  return fetchAPI<TrendStats>(`/stats/trends?days=${days}`)
}

// ─── Crews ────────────────────────────────────────────────────────────────────

export interface Crew {
  id: string
  name: string
  leader: string
  members_count: number
  status: string
  phone?: string
  email?: string
  current_location?: string
  current_latitude?: number
  current_longitude?: number
  created_at: string
  zone_id?: string
}

export interface CreateCrewRequest {
  id: string
  name: string
  leader: string
  members_count?: number
  phone?: string
  email?: string
  current_latitude?: number
  current_longitude?: number
}

export interface UpdateCrewRequest {
  name?: string
  leader?: string
  members_count?: number
  status?: string
  phone?: string
  email?: string
  current_location?: string
  current_latitude?: number
  current_longitude?: number
}

export async function getCrews(zoneId?: string): Promise<Crew[]> {
  const params = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : ""
  return fetchAPI<Crew[]>(`/crews${params}`)
}

export async function getCrew(id: string): Promise<Crew> {
  return fetchAPI<Crew>(`/crews/${id}`)
}

export async function createCrew(data: CreateCrewRequest): Promise<Crew> {
  return fetchAPI<Crew>("/crews", { method: "POST", body: JSON.stringify(data) })
}

export async function updateCrew(id: string, data: UpdateCrewRequest): Promise<Crew> {
  return fetchAPI<Crew>(`/crews/${id}`, { method: "PATCH", body: JSON.stringify(data) })
}

export async function deleteCrew(id: string): Promise<void> {
  return fetchAPI<void>(`/crews/${id}`, { method: "DELETE" })
}

export async function getCrewTasks(id: string): Promise<Task[]> {
  return fetchAPI<Task[]>(`/crews/${id}/tasks`)
}

export async function assignCrewZone(
  id: string,
  zoneId?: string
): Promise<{ crew_id: string; zone_id?: string | null; updated: boolean }> {
  const endpoint = zoneId
    ? `/crews/${id}/zone?zone_id=${encodeURIComponent(zoneId)}`
    : `/crews/${id}/zone`
  return fetchAPI(endpoint, { method: "PATCH" })
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  bin_id?: string
  location: string
  estimated_time_minutes?: number
  crew_id?: string
  alert_id?: number
  created_at: string
  due_date?: string
  completed_at?: string
}

export interface CreateTaskRequest {
  id: string
  title: string
  description?: string
  priority?: string
  location: string
  bin_id?: string
  estimated_time_minutes?: number
  due_date?: string
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  priority?: string
  status?: string
  location?: string
  crew_id?: string
  estimated_time_minutes?: number
  completed_at?: string
}

export async function getTasks(filters?: {
  status?: string
  priority?: string
  crew_id?: string
  zone_id?: string
}): Promise<Task[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.append("status", filters.status)
  if (filters?.priority) params.append("priority", filters.priority)
  if (filters?.crew_id) params.append("crew_id", filters.crew_id)
  if (filters?.zone_id) params.append("zone_id", filters.zone_id)
  const q = params.toString()
  return fetchAPI<Task[]>(`/tasks${q ? "?" + q : ""}`)
}

export async function getTask(id: string): Promise<Task> {
  return fetchAPI<Task>(`/tasks/${id}`)
}

export async function createTask(data: CreateTaskRequest): Promise<Task> {
  return fetchAPI<Task>("/tasks", { method: "POST", body: JSON.stringify(data) })
}

export async function updateTask(id: string, data: UpdateTaskRequest): Promise<Task> {
  return fetchAPI<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) })
}

export async function assignTask(id: string, crew_id: string): Promise<Task> {
  return fetchAPI<Task>(`/tasks/${id}/assign`, {
    method: "POST",
    body: JSON.stringify({ crew_id }),
  })
}

export async function deleteTask(id: string): Promise<void> {
  return fetchAPI<void>(`/tasks/${id}`, { method: "DELETE" })
}

// ─── ML Predictions ───────────────────────────────────────────────────────────

export interface FillPrediction {
  bin_id: string
  current_fill: number
  fill_rate_per_hour?: number
  hours_until_full?: number
  predicted_full_time?: string
  confidence?: number
  data_points_used?: number
  rate_stability?: number
  prediction_quality?: "high" | "medium" | "low"
}

export interface Anomaly {
  metric: string
  current_value: number
  expected_mean?: number
  expected_range: [number, number]
  z_score: number
  severity: "critical" | "high" | "medium" | "low"
  baseline_points?: number
}

export interface CollectionRecommendation {
  bin_id: string
  current_fill: number
  should_collect: boolean
  urgency: "critical" | "high" | "medium" | "low" | "unknown"
  reason: string
  recommended_time: string
  confidence?: number
  prediction?: FillPrediction
}

export interface BinAnalysis {
  bin_id: string
  current_fill: number
  prediction: FillPrediction | null
  anomalies: Anomaly[]
  collection_recommendation: CollectionRecommendation
  usage_pattern: Record<string, number>
  analysis_timestamp: string
  data_quality?: Record<string, unknown>
}

export interface PredictedAlert {
  bin_id: string
  location: string
  current_fill: number
  hours_until_full: number
  predicted_time: string
  urgency: "high" | "medium" | "low"
}

export interface PredictionTaskSyncResult {
  timeframe_hours: number
  alerts_considered: number
  created: number
  updated: number
  skipped_existing: number
  task_ids: string[]
  bin_ids: string[]
}

export interface MLStats {
  service: string
  status: string
  statistics: {
    total_bins_tracked: number
    total_data_points: number
    bins_with_predictions: number
    prediction_coverage: number
  }
  models: {
    fill_predictor: string
    anomaly_detector: string
    collection_optimizer: string
  }
}

export async function getPrediction(binId: string): Promise<FillPrediction> {
  return fetchAPI<FillPrediction>(`/predictions/predict/${binId}`)
}

export async function analyzeBin(binId: string): Promise<BinAnalysis> {
  return fetchAPI<BinAnalysis>(`/predictions/analyze/${binId}`)
}

export async function getAnomalies(binId: string): Promise<Anomaly[]> {
  return fetchAPI<Anomaly[]>(`/predictions/anomalies/${binId}`)
}

export async function getCollectionRecommendation(
  binId: string
): Promise<CollectionRecommendation> {
  return fetchAPI<CollectionRecommendation>(
    `/predictions/collection/recommend/${binId}`
  )
}

export async function getOptimizedCollectionOrder(): Promise<string[]> {
  return fetchAPI<string[]>("/predictions/collection/optimize")
}

export async function getAllPredictions(): Promise<{
  total_bins: number
  predictions_available: number
  predictions: FillPrediction[]
}> {
  return fetchAPI("/predictions/predictions/all")
}

export async function getPredictedAlerts(hoursAhead = 24): Promise<{
  timeframe_hours: number
  alerts_count: number
  alerts: PredictedAlert[]
}> {
  return fetchAPI(`/predictions/alerts/predicted?hours_ahead=${hoursAhead}`)
}

export async function syncPredictionTasks(
  hoursAhead = 24
): Promise<PredictionTaskSyncResult> {
  return fetchAPI<PredictionTaskSyncResult>(
    `/predictions/alerts/predicted/tasks?hours_ahead=${hoursAhead}`,
    { method: "POST" }
  )
}

export async function getMLStats(): Promise<MLStats> {
  return fetchAPI<MLStats>("/predictions/stats")
}

export async function getCollectionPriority(): Promise<string[]> {
  return fetchAPI<string[]>("/predictions/collection-priority")
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export interface RouteWaypoint {
  bin_id: string
  latitude: number
  longitude: number
  fill_level: number
  order: number
  estimated_collection_time: number
  location?: string
  done?: boolean
  completed_at?: string
}

export interface Route {
  id?: string
  route_id?: string
  algorithm: string
  algorithm_used?: string
  total_distance_km: number
  estimated_time_minutes: number
  bin_count: number
  waypoints: RouteWaypoint[]
  efficiency_score: number
  crew_id?: string
  status?: string
  created_at?: string
  started_at?: string
  completed_at?: string
  actual_time_minutes?: number
}

export interface OptimizeRouteRequest {
  bin_ids: string[]
  crew_id?: string
  start_latitude?: number
  start_longitude?: number
  algorithm?: "greedy" | "priority" | "hybrid" | "two_opt"
  save_route?: boolean
}

export interface RouteComparison {
  algorithms: Route[]
  recommended: string
}

export interface RouteAnalytics {
  total_routes_completed: number
  total_bins_collected: number
  total_distance_km: number
  average_efficiency: number
  average_time_minutes: number
}

function normalizeRoute(r: Record<string, unknown>): Route {
  const routeId = (r.id as string) || (r.route_id as string)
  const binCount =
    (r.bin_count as number) ||
    (Array.isArray(r.bin_ids) ? (r.bin_ids as string[]).length : 0)
  const totalDistance = Number(r.total_distance_km || 0)

  return {
    ...(r as unknown as Route),
    id: routeId,
    route_id: routeId,
    algorithm: (r.algorithm as string) || (r.algorithm_used as string) || "unknown",
    algorithm_used: (r.algorithm_used as string) || (r.algorithm as string) || "unknown",
    waypoints: Array.isArray(r.waypoints) ? r.waypoints : [],
    bin_count: binCount,
    efficiency_score:
      (r.efficiency_score as number) ||
      (binCount > 0 && totalDistance > 0 ? binCount / totalDistance : 0),
  }
}

export async function optimizeRoute(
  request: OptimizeRouteRequest
): Promise<Route> {
  const r = await fetchAPI<Record<string, unknown>>("/routes/optimize", {
    method: "POST",
    body: JSON.stringify(request),
  })
  return normalizeRoute(r)
}

export async function compareRoutes(
  binIds: string[],
  startLat?: number,
  startLon?: number
): Promise<RouteComparison> {
  const data = await fetchAPI<{
    algorithms: Record<string, unknown>[]
    recommended: string
  }>("/routes/compare", {
    method: "POST",
    body: JSON.stringify({
      bin_ids: binIds,
      start_latitude: startLat,
      start_longitude: startLon,
    }),
  })
  return {
    algorithms: data.algorithms.map(normalizeRoute),
    recommended: data.recommended,
  }
}

export async function getRoutes(
  status?: string,
  crewId?: string
): Promise<Route[]> {
  const params = new URLSearchParams()
  if (status) params.append("status", status)
  if (crewId) params.append("crew_id", crewId)
  const q = params.toString()
  const routes = await fetchAPI<Record<string, unknown>[]>(
    `/routes${q ? "?" + q : ""}`
  )
  return routes.map(normalizeRoute)
}

export async function getRoute(routeId: string): Promise<Route> {
  const r = await fetchAPI<Record<string, unknown>>(`/routes/${routeId}`)
  return normalizeRoute(r)
}

export async function updateRouteStatus(
  routeId: string,
  status: string,
  actualTimeMinutes?: number,
  notes?: string
): Promise<Route> {
  const r = await fetchAPI<Record<string, unknown>>(
    `/routes/${routeId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        actual_time_minutes: actualTimeMinutes,
        notes,
      }),
    }
  )
  return normalizeRoute(r)
}

export async function deleteRoute(routeId: string): Promise<void> {
  return fetchAPI<void>(`/routes/${routeId}`, { method: "DELETE" })
}

export async function getRouteAnalytics(): Promise<RouteAnalytics> {
  return fetchAPI<RouteAnalytics>("/routes/analytics/performance")
}

// Driver

export interface DriverTask {
  id: string
  title: string
  priority: string
  status: string
  location: string
  bin_id?: string
  estimated_time_minutes?: number
  due_date?: string
}

export interface DriverWaypoint {
  bin_id: string
  location: string
  latitude?: number
  longitude?: number
  fill_level: number
  order: number
  estimated_collection_time: number
  done: boolean
  completed_at?: string
}

export interface DriverRoute {
  id: string
  status: string
  total_distance_km: number
  estimated_time_minutes: number
  waypoints: DriverWaypoint[]
  total_waypoints: number
  completed_waypoints: number
  progress_percent: number
}

export async function getDriverTasks(): Promise<DriverTask[]> {
  return fetchAPI<DriverTask[]>("/driver/tasks")
}

export async function getCurrentDriverRoute(): Promise<DriverRoute | null> {
  return fetchAPI<DriverRoute | null>("/driver/route/current")
}

export async function completeDriverTask(
  taskId: string
): Promise<{ message: string; task_id: string; route_completed?: boolean }> {
  return fetchAPI(`/driver/tasks/${taskId}/complete`, { method: "POST" })
}

export async function completeDriverWaypoint(
  routeId: string,
  binId: string
): Promise<{ updated: boolean; route_completed: boolean; bin_id: string }> {
  return fetchAPI(`/driver/route/${routeId}/waypoint-done`, {
    method: "POST",
    body: JSON.stringify({ bin_id: binId }),
  })
}

export async function updateDriverLocation(data: {
  latitude: number
  longitude: number
  location_name?: string
}): Promise<{ updated: boolean; crew_id: string }> {
  return fetchAPI("/driver/location", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function downloadReport(
  format: "pdf" | "xlsx",
  days = 30
): Promise<Blob> {
  const token = getAuthToken()
  const res = await fetch(
    `${API_URL}/reports/export?format=${format}&days=${days}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  )
  if (!res.ok) throw new ApiError("Report export failed", res.status)
  return res.blob()
}

export async function getReportSummary(days = 30) {
  return fetchAPI<unknown>(`/reports/summary?days=${days}`)
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ status: string; service: string }> {
  return fetchAPI("/health")
}
