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