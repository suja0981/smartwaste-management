// Centralized API client for all backend communication

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Get auth token from localStorage
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('authToken')
}

// Generic fetch wrapper with error handling
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`
  const token = getAuthToken()

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new ApiError(
        error.detail || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        error
      )
    }

    return response.json()
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0
    )
  }
}

// ============================================
// AUTHENTICATION API
// ============================================

export interface AuthUser {
  id: number
  email: string
  full_name: string
  role: 'admin' | 'user'
  is_active: boolean
}

export interface AuthResponse {
  access_token: string
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
  return fetchAPI<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getCurrentUser(): Promise<AuthUser> {
  const token = getAuthToken()
  if (!token) {
    throw new ApiError('No auth token found', 401)
  }

  return fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(res => res.json())
    .catch(err => {
      throw new ApiError('Failed to fetch user', 0)
    })
}

export async function logout(): Promise<void> {
  localStorage.removeItem('authToken')
}

// ============================================
// BINS API
// ============================================

export interface Bin {
  id: string
  location: string
  capacity_liters: number
  fill_level_percent: number
  status: string
  battery_percent?: number
  temperature_c?: number
  humidity_percent?: number
  last_telemetry?: string
}

export async function getBins(): Promise<Bin[]> {
  return fetchAPI<Bin[]>('/bins')
}

export async function getBin(id: string): Promise<Bin> {
  return fetchAPI<Bin>(`/bins/${id}`)
}

export interface CreateBinRequest {
  id: string
  location: string
  capacity_liters: number
  fill_level_percent?: number
}

export async function createBin(data: CreateBinRequest): Promise<Bin> {
  return fetchAPI<Bin>('/bins', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface UpdateBinRequest {
  location?: string
  capacity_liters?: number
  fill_level_percent?: number
  status?: string
}

export async function updateBin(
  id: string,
  data: UpdateBinRequest
): Promise<Bin> {
  return fetchAPI<Bin>(`/bins/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteBin(id: string): Promise<void> {
  return fetchAPI<void>(`/bins/${id}`, {
    method: 'DELETE',
  })
}

// ============================================
// ALERTS API
// ============================================

export interface AIAlert {
  id: number
  bin_id: string
  alert_type: string
  description?: string
  timestamp: string
}

export async function getAlerts(): Promise<AIAlert[]> {
  return fetchAPI<AIAlert[]>('/ai_alerts')
}

export async function getAlert(id: number): Promise<AIAlert> {
  return fetchAPI<AIAlert>(`/ai_alerts/${id}`)
}

export interface CreateAlertRequest {
  bin_id: string
  alert_type: string
  description?: string
  timestamp?: string
}

export async function createAlert(
  data: CreateAlertRequest
): Promise<{ accepted: boolean; bin_id: string; alert_type: string }> {
  return fetchAPI('/ai_alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteAlert(id: number): Promise<void> {
  return fetchAPI<void>(`/ai_alerts/${id}`, {
    method: 'DELETE',
  })
}

// ============================================
// TELEMETRY API
// ============================================

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
  return fetchAPI('/telemetry', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ============================================
// HEALTH CHECK
// ============================================

export async function healthCheck(): Promise<{ status: string; service: string }> {
  return fetchAPI('/health')
}

// Add to existing api-client.ts

// ============================================
// CREWS API
// ============================================

export interface Crew {
  id: string
  name: string
  leader: string
  members_count: number
  status: string
  phone?: string
  email?: string
  current_location?: string
  created_at: string
}

export async function getCrews(): Promise<Crew[]> {
  return fetchAPI<Crew[]>('/crews')
}

export async function getCrew(id: string): Promise<Crew> {
  return fetchAPI<Crew>(`/crews/${id}`)
}

export interface CreateCrewRequest {
  id: string
  name: string
  leader: string
  members_count?: number
  phone?: string
  email?: string
}

export async function createCrew(data: CreateCrewRequest): Promise<Crew> {
  return fetchAPI<Crew>('/crews', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface UpdateCrewRequest {
  name?: string
  leader?: string
  members_count?: number
  status?: string
  phone?: string
  email?: string
  current_location?: string
}

export async function updateCrew(
  id: string,
  data: UpdateCrewRequest
): Promise<Crew> {
  return fetchAPI<Crew>(`/crews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteCrew(id: string): Promise<void> {
  return fetchAPI<void>(`/crews/${id}`, {
    method: 'DELETE',
  })
}

export async function getCrewTasks(id: string): Promise<Task[]> {
  return fetchAPI<Task[]>(`/crews/${id}/tasks`)
}

// ============================================
// TASKS API
// ============================================

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

export async function getTasks(): Promise<Task[]> {
  return fetchAPI<Task[]>('/tasks')
}

export async function getTask(id: string): Promise<Task> {
  return fetchAPI<Task>(`/tasks/${id}`)
}

export interface CreateTaskRequest {
  id: string
  title: string
  description?: string
  priority?: string
  location: string
  bin_id?: string
  estimated_time_minutes?: number
  alert_id?: number
  due_date?: string
}

export async function createTask(data: CreateTaskRequest): Promise<Task> {
  return fetchAPI<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  })
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

export async function updateTask(
  id: string,
  data: UpdateTaskRequest
): Promise<Task> {
  return fetchAPI<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function assignTask(
  id: string,
  crew_id: string
): Promise<Task> {
  return fetchAPI<Task>(`/tasks/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ crew_id }),
  })
}

export async function deleteTask(id: string): Promise<void> {
  return fetchAPI<void>(`/tasks/${id}`, {
    method: 'DELETE',
  })
}
// Add these types and functions to your existing api-client.ts

// ============================================
// ML PREDICTIONS API
// ============================================

export interface FillPrediction {
  bin_id: string
  current_fill: number
  fill_rate_per_hour?: number
  hours_until_full?: number
  predicted_full_time?: string
  confidence?: number
  data_points_used?: number
}

export interface Anomaly {
  metric: string
  current_value: number
  expected_range: [number, number]
  z_score: number
  severity: 'high' | 'medium' | 'low'
}

export interface CollectionRecommendation {
  bin_id: string
  current_fill: number
  should_collect: boolean
  urgency: 'high' | 'medium' | 'low'
  reason: string
  recommended_time: string
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
}

export interface PredictedAlert {
  bin_id: string
  location: string
  current_fill: number
  hours_until_full: number
  predicted_time: string
  urgency: 'high' | 'medium' | 'low'
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

// Get fill time prediction for a bin
export async function getPrediction(binId: string): Promise<FillPrediction> {
  return fetchAPI<FillPrediction>(`/predictions/predict/${binId}`)
}

// Get comprehensive analysis for a bin
export async function analyzeBin(binId: string): Promise<BinAnalysis> {
  return fetchAPI<BinAnalysis>(`/predictions/analyze/${binId}`)
}

// Get anomalies for a bin
export async function getAnomalies(binId: string): Promise<Anomaly[]> {
  return fetchAPI<Anomaly[]>(`/predictions/anomalies/${binId}`)
}

// Get collection recommendation
export async function getCollectionRecommendation(binId: string): Promise<CollectionRecommendation> {
  return fetchAPI<CollectionRecommendation>(`/predictions/collection/recommend/${binId}`)
}

// Get optimized collection order for all bins
export async function getOptimizedCollectionOrder(): Promise<string[]> {
  return fetchAPI<string[]>('/predictions/collection/optimize')
}

// Get usage pattern for a bin
export async function getUsagePattern(binId: string): Promise<{
  bin_id: string
  hourly_fill_rates: Record<string, number>
  peak_hours: Array<[string, number]>
}> {
  return fetchAPI(`/predictions/patterns/${binId}`)
}

// Get all predictions
export async function getAllPredictions(): Promise<{
  total_bins: number
  predictions_available: number
  predictions: FillPrediction[]
}> {
  return fetchAPI('/predictions/predictions/all')
}

// Get predicted alerts
export async function getPredictedAlerts(hoursAhead: number = 24): Promise<{
  timeframe_hours: number
  alerts_count: number
  alerts: PredictedAlert[]
}> {
  return fetchAPI(`/predictions/alerts/predicted?hours_ahead=${hoursAhead}`)
}

// Get ML service stats
export async function getMLStats(): Promise<MLStats> {
  return fetchAPI<MLStats>('/predictions/stats')
}

// ============================================
// ROUTES API
// ============================================

export interface RouteWaypoint {
  bin_id: string
  latitude: number
  longitude: number
  fill_level: number
  order: number
  estimated_collection_time: number
}

export interface Route {
  id?: string
  route_id?: string
  algorithm: string
  total_distance_km: number
  estimated_time_minutes: number
  bin_count: number
  waypoints: RouteWaypoint[]
  efficiency_score: number
  crew_id?: string
  status?: string
  created_at?: string
}

export interface OptimizeRouteRequest {
  bin_ids: string[]
  crew_id?: string
  start_latitude?: number
  start_longitude?: number
  algorithm?: 'greedy' | 'priority' | 'hybrid' | 'two_opt'
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

// Optimize a route
export async function optimizeRoute(request: OptimizeRouteRequest): Promise<Route> {
  return fetchAPI<Route>('/routes/optimize', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

// Compare routing algorithms
export async function compareRoutes(binIds: string[], startLat?: number, startLon?: number): Promise<RouteComparison> {
  return fetchAPI<RouteComparison>('/routes/compare', {
    method: 'POST',
    body: JSON.stringify({
      bin_ids: binIds,
      start_latitude: startLat,
      start_longitude: startLon,
    }),
  })
}

// Get all routes
export async function getRoutes(status?: string, crewId?: string): Promise<Route[]> {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (crewId) params.append('crew_id', crewId)

  const query = params.toString()
  return fetchAPI<any[]>(`/routes${query ? '?' + query : ''}`)
    .then(routes => routes.map(r => ({
      ...r,
      route_id: r.id,
      waypoints: typeof r.waypoints === 'string' ? JSON.parse(r.waypoints) : r.waypoints,
      bin_ids: typeof r.bin_ids === 'string' ? JSON.parse(r.bin_ids) : r.bin_ids,
    })))
}

// Get specific route
export async function getRoute(routeId: string): Promise<Route> {
  return fetchAPI<any>(`/routes/${routeId}`)
    .then(r => ({
      ...r,
      route_id: r.id,
      waypoints: typeof r.waypoints === 'string' ? JSON.parse(r.waypoints) : r.waypoints,
      bin_ids: typeof r.bin_ids === 'string' ? JSON.parse(r.bin_ids) : r.bin_ids,
    }))
}

// Update route status
export async function updateRouteStatus(
  routeId: string,
  status: string,
  actualTimeMinutes?: number,
  notes?: string
): Promise<Route> {
  return fetchAPI<any>(`/routes/${routeId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      actual_time_minutes: actualTimeMinutes,
      notes,
    }),
  }).then(r => ({
    ...r,
    route_id: r.id,
    waypoints: typeof r.waypoints === 'string' ? JSON.parse(r.waypoints) : r.waypoints,
    bin_ids: typeof r.bin_ids === 'string' ? JSON.parse(r.bin_ids) : r.bin_ids,
  }))
}

// Delete route
export async function deleteRoute(routeId: string): Promise<void> {
  return fetchAPI<void>(`/routes/${routeId}`, {
    method: 'DELETE',
  })
}

// Get route analytics
export async function getRouteAnalytics(): Promise<RouteAnalytics> {
  return fetchAPI<RouteAnalytics>('/routes/analytics/performance')
}