/**
 * pages/driver/index.tsx
 *
 * Phase 4 — Driver Mobile View (PWA)
 *
 * This is the simplified view for crew leaders in the field.
 * Designed for Android phones — large tap targets, minimal chrome.
 *
 * Features:
 *  - Login with existing admin/user account
 *  - See tasks assigned to your crew
 *  - See active route with bin list and fill levels
 *  - Mark tasks complete from the field
 *  - Sends GPS updates every 60s while a route is active
 *
 * Install this page on Android:
 *  1. Open in Chrome on Android
 *  2. Tap ⋮ → "Add to Home screen"
 *  The manifest.json + service worker make it installable as a PWA.
 */

import { useEffect, useState, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DriverTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  location: string;
  bin_id?: string;
  estimated_time_minutes?: number;
  due_date?: string;
}

interface DriverWaypoint {
  bin_id: string;
  location: string;
  latitude?: number;
  longitude?: number;
  fill_level: number;
  order: number;
  estimated_collection_time: number;
}

interface DriverRoute {
  id: string;
  status: string;
  total_distance_km: number;
  estimated_time_minutes: number;
  waypoints: DriverWaypoint[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const GPS_INTERVAL_MS = 60_000; // update location every 60s

// ─── Helpers ─────────────────────────────────────────────────────────────────

const priorityColor = (p: string) =>
  ({ high: "#ef4444", medium: "#f59e0b", low: "#22c55e" }[p] ?? "#6b7280");

const fillColor = (lvl: number) =>
  lvl >= 90 ? "#ef4444" : lvl >= 80 ? "#f59e0b" : "#22c55e";

function FillBar({ level }: { level: number }) {
  return (
    <div style={{ background: "#e5e7eb", borderRadius: 6, height: 10, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${level}%`, height: "100%", background: fillColor(level), transition: "width 0.4s" }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DriverPage() {
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [route, setRoute] = useState<DriverRoute | null>(null);
  const [tab, setTab] = useState<"tasks" | "route">("tasks");
  const [toast, setToast] = useState("");
  const gpsTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem("driver_token");
    if (saved) setToken(saved);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setLoginError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Invalid email or password");
      const data = await res.json();
      localStorage.setItem("driver_token", data.access_token);
      setToken(data.access_token);
    } catch (e: any) {
      setLoginError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("driver_token");
    setToken("");
    setTasks([]);
    setRoute(null);
    if (gpsTimer.current) clearInterval(gpsTimer.current);
  };

  // ── Data fetching ─────────────────────────────────────────────────────────

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [tasksRes, routeRes] = await Promise.all([
        fetch(`${API}/driver/tasks`, { headers: authHeaders() }),
        fetch(`${API}/driver/route/current`, { headers: authHeaders() }),
      ]);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (routeRes.ok) {
        const r = await routeRes.json();
        setRoute(r);
      }
    } catch (e) {
      console.error("Fetch failed", e);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── GPS updates ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token || !route) {
      if (gpsTimer.current) clearInterval(gpsTimer.current);
      return;
    }

    const sendLocation = () => {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          fetch(`${API}/driver/location`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          }).catch(() => {});
        },
        () => {} // silently ignore if GPS denied
      );
    };

    sendLocation();
    gpsTimer.current = setInterval(sendLocation, GPS_INTERVAL_MS);
    return () => { if (gpsTimer.current) clearInterval(gpsTimer.current); };
  }, [token, route, authHeaders]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const completeTask = async (taskId: string) => {
    try {
      const res = await fetch(`${API}/driver/tasks/${taskId}/complete`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      showToast("✅ Task marked complete");
    } catch {
      showToast("❌ Could not complete task");
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ── Not logged in ──────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.loginIcon}>🗑️</div>
          <h1 style={styles.loginTitle}>Smart Waste</h1>
          <p style={styles.loginSubtitle}>Driver Portal</p>

          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {loginError && <p style={styles.error}>{loginError}</p>}
          <button style={styles.loginBtn} onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    );
  }

  // ── Logged in ─────────────────────────────────────────────────────────────

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <span style={{ fontSize: 20 }}>🗑️ Smart Waste</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.refreshBtn} onClick={fetchData}>↻</button>
          <button style={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {/* Tab bar */}
      <nav style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === "tasks" ? styles.tabActive : {}) }}
          onClick={() => setTab("tasks")}
        >
          📋 Tasks {tasks.length > 0 && <span style={styles.badge}>{tasks.length}</span>}
        </button>
        <button
          style={{ ...styles.tab, ...(tab === "route" ? styles.tabActive : {}) }}
          onClick={() => setTab("route")}
        >
          🗺️ Route {route && <span style={{ ...styles.badge, background: "#22c55e" }}>Active</span>}
        </button>
      </nav>

      {/* Content */}
      <main style={styles.main}>
        {tab === "tasks" && (
          <div>
            {tasks.length === 0 ? (
              <div style={styles.empty}>
                <div style={{ fontSize: 48 }}>✅</div>
                <p>No pending tasks</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <span style={{ ...styles.priorityDot, background: priorityColor(task.priority) }} />
                    <span style={styles.cardTitle}>{task.title}</span>
                  </div>
                  <p style={styles.cardSub}>📍 {task.location}</p>
                  {task.estimated_time_minutes && (
                    <p style={styles.cardSub}>⏱ ~{task.estimated_time_minutes} min</p>
                  )}
                  {task.due_date && (
                    <p style={styles.cardSub}>
                      📅 Due: {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  )}
                  <button
                    style={styles.doneBtn}
                    onClick={() => completeTask(task.id)}
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
              <div style={styles.empty}>
                <div style={{ fontSize: 48 }}>🚛</div>
                <p>No active route</p>
                <p style={{ fontSize: 14, color: "#6b7280" }}>
                  Ask admin to activate a route for your crew
                </p>
              </div>
            ) : (
              <>
                <div style={styles.routeSummary}>
                  <div style={styles.routeStat}>
                    <span style={styles.routeStatNum}>{route.total_distance_km.toFixed(1)}</span>
                    <span style={styles.routeStatLabel}>km</span>
                  </div>
                  <div style={styles.routeStat}>
                    <span style={styles.routeStatNum}>{Math.round(route.estimated_time_minutes)}</span>
                    <span style={styles.routeStatLabel}>min est.</span>
                  </div>
                  <div style={styles.routeStat}>
                    <span style={styles.routeStatNum}>{route.waypoints.length}</span>
                    <span style={styles.routeStatLabel}>bins</span>
                  </div>
                </div>

                {route.waypoints.map((wp) => (
                  <div key={wp.bin_id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <span style={styles.orderBadge}>{wp.order}</span>
                      <span style={styles.cardTitle}>{wp.bin_id}</span>
                      <span style={{ ...styles.fillTag, color: fillColor(wp.fill_level) }}>
                        {wp.fill_level}%
                      </span>
                    </div>
                    <p style={styles.cardSub}>📍 {wp.location}</p>
                    <FillBar level={wp.fill_level} />
                    {wp.latitude && wp.longitude && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${wp.latitude},${wp.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.mapsLink}
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

      {/* Toast notification */}
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  app: {
    maxWidth: 480,
    margin: "0 auto",
    minHeight: "100vh",
    background: "#f3f4f6",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: "relative",
  },
  // Login
  loginContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#1a73e8",
    padding: 16,
  },
  loginCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 32,
    width: "100%",
    maxWidth: 360,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
  },
  loginIcon: { fontSize: 48, textAlign: "center" },
  loginTitle: { margin: 0, textAlign: "center", fontSize: 24, fontWeight: 700 },
  loginSubtitle: { margin: 0, textAlign: "center", color: "#6b7280", fontSize: 14 },
  input: {
    padding: "14px 16px",
    borderRadius: 10,
    border: "1.5px solid #d1d5db",
    fontSize: 16,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  error: { color: "#ef4444", fontSize: 14, margin: 0 },
  loginBtn: {
    padding: "14px",
    borderRadius: 10,
    background: "#1a73e8",
    color: "#fff",
    fontWeight: 700,
    fontSize: 16,
    border: "none",
    cursor: "pointer",
    marginTop: 4,
  },
  // App shell
  header: {
    background: "#1a73e8",
    color: "#fff",
    padding: "16px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontWeight: 700,
    fontSize: 16,
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  refreshBtn: {
    background: "rgba(255,255,255,0.2)",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 18,
    cursor: "pointer",
  },
  logoutBtn: {
    background: "rgba(255,255,255,0.15)",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  tabs: {
    display: "flex",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    position: "sticky",
    top: 56,
    zIndex: 9,
  },
  tab: {
    flex: 1,
    padding: "14px 0",
    border: "none",
    background: "transparent",
    fontWeight: 600,
    fontSize: 14,
    color: "#6b7280",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: {
    color: "#1a73e8",
    borderBottom: "3px solid #1a73e8",
  },
  badge: {
    background: "#ef4444",
    color: "#fff",
    borderRadius: 10,
    fontSize: 11,
    padding: "1px 6px",
    fontWeight: 700,
  },
  main: { padding: "12px 12px 80px" },
  // Cards
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  cardHeader: { display: "flex", alignItems: "center", gap: 8 },
  priorityDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  cardTitle: { fontWeight: 700, fontSize: 15, flex: 1 },
  cardSub: { margin: 0, fontSize: 13, color: "#6b7280" },
  doneBtn: {
    marginTop: 4,
    padding: "12px",
    background: "#22c55e",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    width: "100%",
  },
  // Route
  routeSummary: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  routeStat: {
    flex: 1,
    background: "#fff",
    borderRadius: 10,
    padding: "12px 8px",
    textAlign: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  routeStatNum: { display: "block", fontSize: 22, fontWeight: 800, color: "#1a73e8" },
  routeStatLabel: { fontSize: 12, color: "#6b7280" },
  orderBadge: {
    width: 24,
    height: 24,
    background: "#1a73e8",
    color: "#fff",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  fillTag: { fontWeight: 800, fontSize: 15 },
  mapsLink: {
    display: "block",
    marginTop: 4,
    color: "#1a73e8",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    color: "#6b7280",
    gap: 8,
    textAlign: "center",
  },
  toast: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1f2937",
    color: "#fff",
    padding: "12px 24px",
    borderRadius: 24,
    fontSize: 14,
    fontWeight: 600,
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
    zIndex: 100,
    whiteSpace: "nowrap",
  },
};