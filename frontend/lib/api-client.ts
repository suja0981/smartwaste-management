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

// Generic fetch wrapper with error handling
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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