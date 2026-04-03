"use client"

import { useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import {
    getAllPredictions,
    getPredictedAlerts,
    syncPredictionTasks,
} from "@/lib/api-client"
import {
    TrendingUp,
    RefreshCw,
    Loader2,
    Zap,
    Brain,
    ChevronUp,
    ChevronDown,
    Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fillLevelConfig(fill: number) {
    if (fill >= 80) return { color: "text-red-600", bar: "bg-red-500", variant: "destructive" as const }
    if (fill >= 50) return { color: "text-amber-600", bar: "bg-amber-500", variant: "secondary" as const }
    return { color: "text-green-600", bar: "bg-green-500", variant: "outline" as const }
}

function formatHours(h: number) {
    if (h < 1) return `${Math.round(h * 60)}m`
    if (h < 24) return `${h.toFixed(1)}h`
    return `${(h / 24).toFixed(1)}d`
}

// ─── Timeframe toggle ─────────────────────────────────────────────────────────

const TIMEFRAMES = [12, 24, 48] as const

interface TimeframeToggleProps {
    value: number
    onChange: (v: number) => void
    loading: boolean
    onRefresh: () => void
}

function TimeframeToggle({ value, onChange, loading, onRefresh }: TimeframeToggleProps) {
    return (
        <div className="flex items-center gap-1">
            {TIMEFRAMES.map((t) => (
                <button
                    key={t}
                    onClick={() => onChange(t)}
                    className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                        value === t
                            ? "bg-foreground text-background shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                >
                    {t}h
                </button>
            ))}
            <button
                onClick={onRefresh}
                disabled={loading}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all ml-1"
                title="Refresh"
            >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PredictionOverview() {
    const [syncingTasks, setSyncingTasks] = useState(false)
    const [lastSyncMessage, setLastSyncMessage] = useState("")
    const [timeframe, setTimeframe] = useState(24)
    const [sortBy, setSortBy] = useState<"fill" | "rate" | "time">("fill")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
    const { toast } = useToast()
    const { isAdmin } = useAuth()
    const queryClient = useQueryClient()

    const { data: predsRes, isLoading: predsLoading, isFetching: predsFetching } = useQuery({
        queryKey: ["predictions"],
        queryFn: getAllPredictions,
        refetchInterval: 30_000,
        staleTime: 15_000,
    })

    const { data: alertsRes, isLoading: alertsLoading, isFetching: alertsFetching } = useQuery({
        queryKey: ["predicted-alerts", timeframe],
        queryFn: () => getPredictedAlerts(timeframe),
        refetchInterval: 30_000,
        staleTime: 15_000,
    })

    const predictions = predsRes?.predictions ?? []
    const alerts = alertsRes?.alerts ?? []
    const loading = predsLoading || alertsLoading
    const refreshing = predsFetching || alertsFetching

    function handleRefresh() {
        queryClient.invalidateQueries({ queryKey: ["predictions"] })
        queryClient.invalidateQueries({ queryKey: ["predicted-alerts", timeframe] })
    }

    // ── Derived values ────────────────────────────────────────────────────────

    const sortedPredictions = [...predictions].sort((a, b) => {
        let va = 0, vb = 0
        if (sortBy === "fill") { va = a.current_fill ?? 0; vb = b.current_fill ?? 0 }
        if (sortBy === "rate") { va = a.fill_rate_per_hour ?? 0; vb = b.fill_rate_per_hour ?? 0 }
        if (sortBy === "time") { va = a.hours_until_full ?? Infinity; vb = b.hours_until_full ?? Infinity }
        return sortDir === "desc" ? vb - va : va - vb
    })

    function toggleSort(col: typeof sortBy) {
        if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        else { setSortBy(col); setSortDir("desc") }
    }

    function SortIcon({ col }: { col: typeof sortBy }) {
        if (sortBy !== col) return <Minus className="h-3 w-3 opacity-30" />
        return sortDir === "desc"
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronUp className="h-3 w-3" />
    }

    const handleSyncPredictionTasks = useCallback(async () => {
        setSyncingTasks(true)
        try {
            const result = await syncPredictionTasks(timeframe)
            const summary = `${result.created} created, ${result.updated} refreshed, ${result.skipped_existing} already open`
            setLastSyncMessage(summary)
            toast({
                title: "Prediction tasks synced",
                description: summary,
            })
        } catch (error) {
            toast({
                title: "Prediction task sync failed",
                description: error instanceof Error ? error.message : "Could not create tasks from predicted alerts.",
                variant: "destructive",
            })
        } finally {
            setSyncingTasks(false)
        }
    }, [timeframe, toast])

    // ── Loading state ─────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 h-64 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Loading ML predictions…</p>
            </div>
        )
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">

            {/* ── All Fill Predictions Table ─────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <TrendingUp className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-base">All Fill Predictions</CardTitle>
                                <CardDescription className="text-xs mt-0.5">
                                    Click column headers to sort · {predictions.length} active predictions
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {isAdmin && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSyncPredictionTasks}
                                    disabled={syncingTasks}
                                >
                                    {syncingTasks ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Zap className="mr-2 h-4 w-4" />
                                    )}
                                    Create Tasks
                                </Button>
                            )}
                            <TimeframeToggle
                                value={timeframe}
                                onChange={setTimeframe}
                                loading={refreshing}
                                onRefresh={handleRefresh}
                            />
                        </div>
                    </div>
                    {lastSyncMessage && (
                        <p className="pt-2 text-xs text-muted-foreground">
                            Latest task sync: {lastSyncMessage}
                        </p>
                    )}
                </CardHeader>
                <CardContent className="pt-0">
                    {sortedPredictions.length > 0 ? (
                        <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                        <th className="text-left py-2.5 px-4 font-medium">Bin ID</th>
                                        <th className="text-left py-2.5 px-4 font-medium">
                                            <button
                                                onClick={() => toggleSort("fill")}
                                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                                            >
                                                Fill Level <SortIcon col="fill" />
                                            </button>
                                        </th>
                                        <th className="text-left py-2.5 px-4 font-medium hidden md:table-cell">
                                            <button
                                                onClick={() => toggleSort("rate")}
                                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                                            >
                                                Fill Rate <SortIcon col="rate" />
                                            </button>
                                        </th>
                                        <th className="text-left py-2.5 px-4 font-medium">
                                            <button
                                                onClick={() => toggleSort("time")}
                                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                                            >
                                                Time to Full <SortIcon col="time" />
                                            </button>
                                        </th>
                                        <th className="text-left py-2.5 px-4 font-medium hidden lg:table-cell">
                                            Confidence
                                        </th>
                                        <th className="text-left py-2.5 px-4 font-medium hidden lg:table-cell">
                                            Data Points
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedPredictions.map((pred, idx) => {
                                        const fill = pred.current_fill ?? 0
                                        const fillCfg = fillLevelConfig(fill)
                                        const hours = pred.hours_until_full
                                        const timeClass =
                                            hours == null
                                                ? "text-muted-foreground"
                                                : hours <= 6
                                                    ? "text-red-600 font-semibold"
                                                    : hours <= 12
                                                        ? "text-amber-600 font-semibold"
                                                        : "text-muted-foreground"
                                        const conf = (pred.confidence ?? 0) * 100

                                        return (
                                            <tr
                                                key={pred.bin_id}
                                                className={cn(
                                                    "border-b last:border-0 transition-colors hover:bg-muted/30",
                                                    idx % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                                                )}
                                            >
                                                {/* Bin ID */}
                                                <td className="py-3 px-4 font-mono font-medium text-xs">
                                                    {pred.bin_id}
                                                </td>

                                                {/* Fill level with mini bar */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-1.5 rounded-full bg-gray-100 shrink-0 hidden sm:block">
                                                            <div
                                                                className={cn("h-1.5 rounded-full transition-all", fillCfg.bar)}
                                                                style={{ width: `${fill}%` }}
                                                            />
                                                        </div>
                                                        <span className={cn("font-semibold tabular-nums text-xs", fillCfg.color)}>
                                                            {fill}%
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Fill rate */}
                                                <td className="py-3 px-4 tabular-nums text-xs text-muted-foreground hidden md:table-cell">
                                                    {pred.fill_rate_per_hour != null
                                                        ? `${pred.fill_rate_per_hour.toFixed(2)}%/h`
                                                        : "—"}
                                                </td>

                                                {/* Time to full */}
                                                <td className={cn("py-3 px-4 tabular-nums text-xs", timeClass)}>
                                                    {hours != null ? formatHours(hours) : "—"}
                                                </td>

                                                {/* Confidence */}
                                                <td className="py-3 px-4 hidden lg:table-cell">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-12 h-1.5 rounded-full bg-gray-100">
                                                            <div
                                                                className={cn(
                                                                    "h-1.5 rounded-full",
                                                                    conf >= 70
                                                                        ? "bg-emerald-500"
                                                                        : conf >= 40
                                                                            ? "bg-amber-500"
                                                                            : "bg-gray-400"
                                                                )}
                                                                style={{ width: `${conf}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs tabular-nums text-muted-foreground">
                                                            {conf.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Data points */}
                                                <td className="py-3 px-4 text-xs tabular-nums text-muted-foreground hidden lg:table-cell">
                                                    {pred.data_points_used ?? "—"}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                            <Brain className="h-10 w-10 opacity-25" />
                            <div className="text-center">
                                <p className="font-medium text-sm">No predictions available</p>
                                <p className="text-xs mt-1 max-w-xs">
                                    Send telemetry data to your bins to start generating fill predictions.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
