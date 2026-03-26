"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
    getAllPredictions,
    getPredictedAlerts,
    type FillPrediction,
    type PredictedAlert,
    type MLStats,
} from "@/lib/api-client"
import {
    TrendingUp,
    AlertTriangle,
    Clock,
    RefreshCw,
    Loader2,
    Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function PredictionOverview() {
    const [predictions, setPredictions] = useState<FillPrediction[]>([])
    const [predictedAlerts, setPredictedAlerts] = useState<PredictedAlert[]>([])
    const [loading, setLoading] = useState(true)
    const [timeframe, setTimeframe] = useState(24) // hours
    const { toast } = useToast()

    const fetchPredictions = async () => {
        try {
            setLoading(true)
            const [allPreds, alerts] = await Promise.all([
                getAllPredictions(),
                getPredictedAlerts(timeframe),
            ])
            setPredictions(allPreds.predictions || [])
            setPredictedAlerts(alerts.alerts || [])
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to load predictions",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPredictions()
    }, [timeframe])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const criticalAlerts = predictedAlerts.filter((a) => a.urgency === "high")
    const highFillBins = predictions.filter((p) => p.current_fill! >= 80)

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Bins Tracked
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{predictions.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            With fill predictions
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            High Fill Level
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{highFillBins.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Bins above 80% capacity
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Critical Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "text-2xl font-bold",
                            criticalAlerts.length > 0 ? "text-red-600" : "text-green-600"
                        )}>
                            {criticalAlerts.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Next {timeframe} hours
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Predicted Alerts Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Predicted Collection Alerts
                            </CardTitle>
                            <CardDescription>
                                Bins predicted to reach full capacity in the next {timeframe} hours
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant={timeframe === 12 ? "default" : "outline"}
                                onClick={() => setTimeframe(12)}
                            >
                                12h
                            </Button>
                            <Button
                                size="sm"
                                variant={timeframe === 24 ? "default" : "outline"}
                                onClick={() => setTimeframe(24)}
                            >
                                24h
                            </Button>
                            <Button
                                size="sm"
                                variant={timeframe === 48 ? "default" : "outline"}
                                onClick={() => setTimeframe(48)}
                            >
                                48h
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={fetchPredictions}
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {predictedAlerts.length > 0 ? (
                        <div className="space-y-3">
                            {predictedAlerts.map((alert) => (
                                <div
                                    key={alert.bin_id}
                                    className={cn(
                                        "p-4 rounded-lg border-l-4",
                                        alert.urgency === "high"
                                            ? "border-l-red-500 bg-red-50"
                                            : "border-l-amber-500 bg-amber-50"
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold">{alert.bin_id}</p>
                                                <Badge
                                                    variant={
                                                        alert.urgency === "high" ? "destructive" : "secondary"
                                                    }
                                                >
                                                    {alert.urgency.toUpperCase()}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                📍 {alert.location}
                                            </p>
                                            <p className="text-sm mt-2">
                                                Currently at <strong>{alert.current_fill}%</strong> • Will be
                                                full in <strong>{alert.hours_until_full.toFixed(1)}h</strong>
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Predicted full time:{" "}
                                                {new Date(alert.predicted_time).toLocaleString()}
                                            </p>
                                        </div>
                                        <Clock className={cn(
                                            "h-5 w-5 flex-shrink-0",
                                            alert.urgency === "high" ? "text-red-600" : "text-amber-600"
                                        )} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center rounded-lg border-2 border-dashed border-green-200 bg-green-50">
                            <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
                            <p className="text-green-900 font-semibold">All Clear!</p>
                            <p className="text-sm text-green-800 mt-1">
                                No bins are predicted to fill up in the next {timeframe} hours.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Fill Predictions List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        All Fill Predictions
                    </CardTitle>
                    <CardDescription>
                        Fill rate and time to capacity for all bins
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left font-medium py-3 px-2">Bin ID</th>
                                    <th className="text-left font-medium py-3 px-2">Fill Level</th>
                                    <th className="text-left font-medium py-3 px-2">Fill Rate</th>
                                    <th className="text-left font-medium py-3 px-2">Time Till Full</th>
                                    <th className="text-left font-medium py-3 px-2">Confidence</th>
                                    <th className="text-left font-medium py-3 px-2">Data Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                {predictions.length > 0 ? (
                                    predictions.map((pred) => (
                                        <tr key={pred.bin_id} className="border-b hover:bg-gray-50">
                                            <td className="py-3 px-2 font-medium">{pred.bin_id}</td>
                                            <td className="py-3 px-2">
                                                <Badge
                                                    variant={
                                                        pred.current_fill! >= 80
                                                            ? "destructive"
                                                            : pred.current_fill! >= 50
                                                                ? "secondary"
                                                                : "outline"
                                                    }
                                                >
                                                    {pred.current_fill}%
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-2">
                                                {pred.fill_rate_per_hour?.toFixed(2)}%/h
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className={cn(
                                                    pred.hours_until_full! <= 6
                                                        ? "text-red-600 font-semibold"
                                                        : pred.hours_until_full! <= 12
                                                            ? "text-amber-600 font-semibold"
                                                            : "text-gray-600"
                                                )}>
                                                    {pred.hours_until_full?.toFixed(1)}h
                                                </span>
                                            </td>
                                            <td className="py-3 px-2">
                                                {(pred.confidence! * 100).toFixed(0)}%
                                            </td>
                                            <td className="py-3 px-2 text-muted-foreground">
                                                {pred.data_points_used}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                            No predictions available. Send telemetry data first.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
