/**
 * lib/useRealtimeBins.ts
 *
 * Phase 3 — Real-time bin updates hook.
 *
 * Connects to the backend WebSocket at ws://host/ws?token=<jwt>.
 * Handles reconnection with exponential back-off automatically.
 * Merges incoming bin_update events into a local state map so the
 * dashboard re-renders only when a bin's data actually changes.
 *
 * Usage:
 *   const { binUpdates, connected, alertQueue } = useRealtimeBins(token);
 *
 * binUpdates is a Map<binId, BinUpdate> — merge with your existing bins list.
 * alertQueue is an array of alert events (bin >80%, bin >90%) for toasts.
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BinUpdate {
  event: "bin_update";
  bin_id: string;
  fill_level_percent: number;
  status: string;
  battery_percent: number | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  timestamp: string;
}

export interface BinAlert {
  event: "bin_alert";
  bin_id: string;
  level: "warning" | "critical";
  message: string;
  timestamp: string;
}

interface UseRealtimeBinsReturn {
  /** Latest update per bin — merge with your bins list */
  binUpdates: Map<string, BinUpdate>;
  /** True when the WebSocket is OPEN */
  connected: boolean;
  /** Recent alerts for toast notifications; shifts off after maxAlerts */
  alertQueue: BinAlert[];
  /** Manually dismiss an alert from the queue */
  dismissAlert: (index: number) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
  .replace(/^http/, "ws"); // http → ws, https → wss

const INITIAL_RETRY_MS = 2_000;
const MAX_RETRY_MS = 30_000;
const MAX_ALERTS = 10;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRealtimeBins(
  token: string | null,
  enabled: boolean = true
): UseRealtimeBinsReturn {
  const [binUpdates, setBinUpdates] = useState<Map<string, BinUpdate>>(new Map());
  const [connected, setConnected] = useState(false);
  const [alertQueue, setAlertQueue] = useState<BinAlert[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const retryDelay = useRef(INITIAL_RETRY_MS);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (!token || !enabled || unmounted.current) return;

    const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      if (unmounted.current) return socket.close();
      setConnected(true);
      retryDelay.current = INITIAL_RETRY_MS; // reset back-off on success
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.event === "bin_update") {
          setBinUpdates((prev) => {
            const next = new Map(prev);
            next.set(data.bin_id, data as BinUpdate);
            return next;
          });
        } else if (data.event === "bin_alert") {
          setAlertQueue((prev) => [data as BinAlert, ...prev].slice(0, MAX_ALERTS));
        } else if (data.event === "pong") {
          // heartbeat acknowledged — nothing to do
        }
      } catch (e) {
        console.warn("[WS] Failed to parse message", e);
      }
    };

    socket.onclose = () => {
      if (unmounted.current) return;
      setConnected(false);
      ws.current = null;

      // Exponential back-off reconnect
      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, MAX_RETRY_MS);
        connect();
      }, retryDelay.current);
    };

    socket.onerror = () => {
      socket.close(); // triggers onclose → reconnect logic
    };
  }, [token, enabled]);

  // Ping every 30s to keep connection alive through load balancers
  useEffect(() => {
    if (!connected || !ws.current) return;
    const ping = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send("ping");
      }
    }, 30_000);
    return () => clearInterval(ping);
  }, [connected]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const dismissAlert = useCallback((index: number) => {
    setAlertQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return { binUpdates, connected, alertQueue, dismissAlert };
}