"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
    getPrediction,
    analyzeBin,
    getAnomalies,
    getCollectionRecommendation,
    getUsagePattern,
    getAllPredictions,
    type BinAnalysis,
    type FillPrediction,
    type Anomaly,
    type CollectionRecommendation,
} from "@/lib/api-client"
import {
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Clock,
    Zap,
    AlertCircle,
    RefreshCw,
    Loader2,
    Activity,
    Gauge,
    Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MLPredictionsProps {
    binId: string
}

export function MLPredictions({ binId }: MLPredictionsProps) {
    const [analysis, setAnalysis] = useState<BinAnalysis | null>(null)
    const [loading, setLoading] = useState(true)
    const { toast } = useToast()

    const fetchAnalysis = async () => {
        try {
            setLoading(true)
            const data = await analyzeBin(binId)
            setAnalysis(data)
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to load ML analysis",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAnalysis()
    }, [binId])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!analysis) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>ML Analysis Unavailable</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Could not load ML analysis. Please try again or check system status.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Fill Prediction Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Fill Level Prediction
                            </CardTitle>
                            <CardDescription>
                                When will this bin reach full capacity?
                            </CardDescription>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={fetchAnalysis}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {analysis.prediction ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Current Fill Level</p>
                                    <p className="text-2xl font-bold">{analysis.current_fill}%</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Fill Rate</p>
                                    <p className="text-2xl font-bold">{analysis.prediction.fill_rate_per_hour}%/hour</p>
                                </div>
                            </div>

                            <Progress value={analysis.current_fill} className="h-3" />

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Time Until Full</p>
                                    <p className="text-xl font-bold text-amber-600">
                                        {analysis.prediction.hours_until_full?.toFixed(1)}h
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Predicted Full Time</p>
                                    <p className="text-sm font-semibold">
                                        {analysis.prediction.predicted_full_time
                                            ? new Date(analysis.prediction.predicted_full_time).toLocaleString()
                                            : "N/A"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t">
                                <div className="flex items-center gap-2">
                                    <Gauge className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Confidence</span>
                                </div>
                                <Badge variant="secondary">
                                    {(analysis.prediction.confidence! * 100).toFixed(0)}%
                                </Badge>
                            </div>

                            <p className="text-xs text-muted-foreground pt-2">
                                Based on {analysis.prediction.data_points_used} historical data points
                            </p>
                        </>
                    ) : (
                        <p className="text-muted-foreground">
                            Insufficient historical data. More telemetry needed for prediction.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Collection Recommendation Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Collection Recommendation
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                            <p className="font-semibold">Collection Required?</p>
                            <p className="text-sm text-muted-foreground">
                                {analysis.collection_recommendation.reason}
                            </p>
                        </div>
                        <Badge
                            variant={
                                analysis.collection_recommendation.should_collect ? "destructive" : "secondary"
                            }
                        >
                            {analysis.collection_recommendation.should_collect ? "YES" : "NO"}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Urgency Level</p>
                            <Badge
                                className={cn(
                                    "mt-1",
                                    analysis.collection_recommendation.urgency === "high"
                                        ? "bg-red-100 text-red-800"
                                        : analysis.collection_recommendation.urgency === "medium"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-green-100 text-green-800"
                                )}
                            >
                                {analysis.collection_recommendation.urgency.toUpperCase()}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Recommended Time</p>
                            <p className="text-sm font-semibold mt-1">
                                {analysis.collection_recommendation.recommended_time}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Anomalies Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Anomaly Detection
                    </CardTitle>
                    <CardDescription>
                        Unusual sensor readings detected
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {analysis.anomalies && analysis.anomalies.length > 0 ? (
                        <div className="space-y-3">
                            {analysis.anomalies.map((anomaly, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "p-4 rounded-lg border",
                                        anomaly.severity === "high"
                                            ? "border-red-200 bg-red-50"
                                            : "border-amber-200 bg-amber-50"
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-semibold capitalize">{anomaly.metric}</p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Current Value: <strong>{anomaly.current_value}</strong>
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Expected Range: {anomaly.expected_range[0]} -{" "}
                                                {anomaly.expected_range[1]}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Z-Score: {anomaly.z_score}
                                            </p>
                                        </div>
                                        <Badge
                                            variant={anomaly.severity === "high" ? "destructive" : "secondary"}
                                        >
                                            {anomaly.severity.toUpperCase()}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 p-4 rounded-lg border border-green-200 bg-green-50">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <p className="text-green-900">No anomalies detected. All readings are normal.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Usage Pattern Card */}
            {analysis.usage_pattern && Object.keys(analysis.usage_pattern).length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Hourly Usage Pattern
                        </CardTitle>
                        <CardDescription>
                            Average fill rate by hour of day
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {Object.entries(analysis.usage_pattern).map(([hour, rate]) => (
                                <div key={hour} className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Hour {hour}:00</span>
                                    <div className="flex-1 mx-4">
                                        <div className="h-2 rounded-full bg-gray-200">
                                            <div
                                                className="h-2 rounded-full bg-blue-500"
                                                style={{
                                                    width: `${Math.min((rate as number) * 5, 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-sm text-muted-foreground w-12 text-right">
                                        {(rate as number).toFixed(1)}%/h
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Analysis Timestamp */}
            <p className="text-xs text-muted-foreground text-center">
                Analysis generated at{" "}
                {new Date(analysis.analysis_timestamp).toLocaleString()}
            </p>
        </div>
    )
}
