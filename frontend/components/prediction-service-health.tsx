"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getMLStats } from "@/lib/api-client"
import { BarChart3, Activity, TrendingUp, Zap, Loader2, RefreshCw, Database, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"

export function PredictionServiceHealth() {
    const { data: stats, isLoading, refetch, dataUpdatedAt } = useQuery({
        queryKey: ["ml-stats"],
        queryFn: getMLStats,
        refetchInterval: 30_000,
        staleTime: 15_000,
    })
    const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-8 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (!stats) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Service Health</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Unable to load service statistics</p>
                </CardContent>
            </Card>
        )
    }

    const coverage = stats.statistics?.prediction_coverage ?? 0
    const dataPoints = stats.statistics?.total_data_points ?? 0
    const totalBins = stats.statistics?.total_bins_tracked ?? 0
    const binsWithPred = stats.statistics?.bins_with_predictions ?? 0

    const coverageStatus = coverage >= 80 ? "optimal" : coverage >= 60 ? "warning" : "low"
    const statusConfig = {
        optimal: { color: "text-green-600", bg: "bg-green-50", badge: "bg-green-100 text-green-700" },
        warning: { color: "text-amber-600", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700" },
        low: { color: "text-red-600", bg: "bg-red-50", badge: "bg-red-100 text-red-700" },
    }
    const config = statusConfig[coverageStatus as keyof typeof statusConfig]

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-emerald-600" />
                            Prediction Service Health
                        </CardTitle>
                        <CardDescription>Real-time system status and data quality</CardDescription>
                    </div>
                    <button
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Status Indicator */}
                <div className={cn("flex items-center gap-3 p-4 rounded-lg", config.bg)}>
                    <div className="flex h-3 w-3">
                        <span className={cn("animate-ping absolute inline-flex h-3 w-3 rounded-full opacity-75", config.color)} />
                        <span className={cn("relative inline-flex rounded-full h-3 w-3", config.color.replace("text-", "bg-"))} />
                    </div>
                    <div className="flex-1">
                        <p className={cn("font-semibold text-sm", config.color)}>
                            {coverageStatus === "optimal" ? "Optimal" : coverageStatus === "warning" ? "Warning" : "Low Coverage"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {coverage.toFixed(1)}% of bins have reliable predictions
                        </p>
                    </div>
                    <Badge className={config.badge}>{coverage.toFixed(0)}%</Badge>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* Total Bins */}
                    <div className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChart3 className="h-4 w-4 text-slate-600" />
                            <p className="text-xs font-medium text-muted-foreground">Bins Tracked</p>
                        </div>
                        <p className="text-2xl font-bold">{totalBins}</p>
                        <p className="text-xs text-muted-foreground mt-1">{binsWithPred} with predictions</p>
                    </div>

                    {/* Data Points */}
                    <div className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                            <Database className="h-4 w-4 text-purple-600" />
                            <p className="text-xs font-medium text-muted-foreground">Data Points</p>
                        </div>
                        <p className="text-2xl font-bold">
                            {dataPoints >= 1000 ? `${(dataPoints / 1000).toFixed(1)}K` : dataPoints}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">In memory</p>
                    </div>

                    {/* Avg per Bin */}
                    <div className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                            <Gauge className="h-4 w-4 text-blue-600" />
                            <p className="text-xs font-medium text-muted-foreground">Avg History</p>
                        </div>
                        <p className="text-2xl font-bold">{totalBins > 0 ? (dataPoints / totalBins).toFixed(0) : "—"}</p>
                        <p className="text-xs text-muted-foreground mt-1">points per bin</p>
                    </div>

                    {/* Min Required */}
                    <div className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-amber-600" />
                            <p className="text-xs font-medium text-muted-foreground">Min Required</p>
                        </div>
                        <p className="text-2xl font-bold">20</p>
                        <p className="text-xs text-muted-foreground mt-1">data points</p>
                    </div>
                </div>

                {/* Coverage Progress */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Prediction Coverage</p>
                        <p className="text-xs text-muted-foreground">
                            {binsWithPred} of {totalBins} bins ready
                        </p>
                    </div>
                    <Progress value={coverage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                        {coverage < 80
                            ? "Collecting baseline data. Coverage will improve as more telemetry is received."
                            : "Service is operating at optimal capacity."}
                    </p>
                </div>

                {/* Last Updated */}
                {lastRefresh && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                        Updated {Math.round((Date.now() - lastRefresh.getTime()) / 1000)}s ago
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
