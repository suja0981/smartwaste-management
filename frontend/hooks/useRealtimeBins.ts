"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Bin } from "@/lib/api-client"

export interface BinUpdate {
  event: "bin_update"
  bin_id: string
  fill_level_percent: number
  status: string
  battery_percent: number | null
  temperature_c: number | null
  humidity_percent: number | null
  timestamp: string
}

export interface BinAlert {
  event: "bin_alert"
  bin_id: string
  level: "warning" | "critical"
  message: string
  timestamp: string
}

interface UseRealtimeBinsReturn {
  binUpdates: Map<string, BinUpdate>
  connected: boolean
  alertQueue: BinAlert[]
  dismissAlert: (index: number) => void
}

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
  /^http/,
  "ws"
)
const INITIAL_RETRY_MS = 2_000
const MAX_RETRY_MS = 30_000
const MAX_ALERTS = 10

function mergeBin(bin: Bin, update: BinUpdate): Bin {
  return {
    ...bin,
    fill_level_percent: update.fill_level_percent,
    status: update.status,
    battery_percent: update.battery_percent ?? undefined,
    temperature_c: update.temperature_c ?? undefined,
    humidity_percent: update.humidity_percent ?? undefined,
    last_telemetry: update.timestamp,
  }
}

export function mergeRealtimeBinUpdates(
  bins: Bin[],
  updates: Map<string, BinUpdate>
): Bin[] {
  if (bins.length === 0 || updates.size === 0) return bins

  let changed = false
  const nextBins = bins.map((bin) => {
    const update = updates.get(bin.id)
    if (!update) return bin

    const merged = mergeBin(bin, update)
    if (
      merged.fill_level_percent !== bin.fill_level_percent ||
      merged.status !== bin.status ||
      merged.battery_percent !== bin.battery_percent ||
      merged.temperature_c !== bin.temperature_c ||
      merged.humidity_percent !== bin.humidity_percent ||
      merged.last_telemetry !== bin.last_telemetry
    ) {
      changed = true
      return merged
    }

    return bin
  })

  return changed ? nextBins : bins
}

export function useRealtimeBins(
  token: string | null,
  enabled = true
): UseRealtimeBinsReturn {
  const [binUpdates, setBinUpdates] = useState<Map<string, BinUpdate>>(new Map())
  const [connected, setConnected] = useState(false)
  const [alertQueue, setAlertQueue] = useState<BinAlert[]>([])

  const ws = useRef<WebSocket | null>(null)
  const retryDelay = useRef(INITIAL_RETRY_MS)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmounted = useRef(false)

  const connect = useCallback(() => {
    if (!token || !enabled || unmounted.current) return

    const socket = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`)
    ws.current = socket

    socket.onopen = () => {
      if (unmounted.current) {
        socket.close()
        return
      }
      setConnected(true)
      retryDelay.current = INITIAL_RETRY_MS
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.event === "bin_update") {
          setBinUpdates((prev) => {
            const next = new Map(prev)
            next.set(data.bin_id, data as BinUpdate)
            return next
          })
          return
        }

        if (data.event === "bin_alert") {
          setAlertQueue((prev) => [data as BinAlert, ...prev].slice(0, MAX_ALERTS))
        }
      } catch (error) {
        console.warn("[realtime] failed to parse websocket message", error)
      }
    }

    socket.onclose = () => {
      if (unmounted.current) return
      setConnected(false)
      ws.current = null

      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, MAX_RETRY_MS)
        connect()
      }, retryDelay.current)
    }

    socket.onerror = () => {
      socket.close()
    }
  }, [enabled, token])

  useEffect(() => {
    if (!connected || !ws.current) return

    const ping = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send("ping")
      }
    }, 30_000)

    return () => clearInterval(ping)
  }, [connected])

  useEffect(() => {
    unmounted.current = false

    if (enabled && token) {
      connect()
    } else {
      setConnected(false)
      setBinUpdates(new Map())
      setAlertQueue([])
    }

    return () => {
      unmounted.current = true
      if (retryTimer.current) clearTimeout(retryTimer.current)
      ws.current?.close()
      ws.current = null
    }
  }, [connect, enabled, token])

  const dismissAlert = useCallback((index: number) => {
    setAlertQueue((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
  }, [])

  return { binUpdates, connected, alertQueue, dismissAlert }
}
