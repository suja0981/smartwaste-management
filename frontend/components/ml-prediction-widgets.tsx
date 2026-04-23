"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getPredictedAlerts, getAllPredictions, getMLStats } from "@/lib/api-client"
import { Clock, TrendingUp, Brain, AlertTriangle, Zap, Activity, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function MLPredictionsCard() {
  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["predictions-widget"],
    queryFn: async () => {
      const result = await getAllPredictions()
      return result.predictions.slice(0, 4)
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-600" />
              ML Fill Predictions
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Upcoming bins most likely to reach capacity soon
            </CardDescription>
          </div>
          <Badge className="border-violet-200 bg-violet-50 text-violet-700">
            <Zap className="h-3 w-3 mr-1" />
            Forecast
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {predictions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Building predictions...</p>
              <p className="text-sm mt-1">ML models need more data points</p>
            </div>
          ) : (
            predictions.map((pred) => (
              <div
                key={pred.bin_id}
                className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm">{pred.bin_id}</h4>
                    <p className="text-xs text-muted-foreground">
                      Current fill: {pred.current_fill}%
                    </p>
                  </div>
                  {pred.confidence != null && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {Math.round(pred.confidence * 100)}% confidence
                    </Badge>
                  )}
                </div>

                {pred.hours_until_full != null ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-violet-50 p-3 dark:bg-violet-950/20">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-violet-600" />
                        <span className="font-medium text-violet-700 dark:text-violet-300">
                          Full in {pred.hours_until_full.toFixed(1)} hours
                        </span>
                      </div>
                      {pred.predicted_full_time && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Expected {new Date(pred.predicted_full_time).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Fill rate
                      </p>
                      {pred.fill_rate_per_hour != null ? (
                        <>
                          <p className="mt-1 text-lg font-semibold">
                            {pred.fill_rate_per_hour.toFixed(2)}%/h
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Based on the latest telemetry trend
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Fill rate is still being calculated.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-violet-600" />
                      <span className="font-medium">Analyzing fill pattern</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      More telemetry is needed before a reliable ETA can be shown.
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" className="w-full rounded-xl">
            <a href="/predictions">View all predictions</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function PredictedAlertsCard() {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["predicted-alerts"],
    queryFn: async () => {
      const result = await getPredictedAlerts(24)
      return result.alerts.slice(0, 5)
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-500/10 text-red-600 border-red-500/20'
      case 'medium':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      default:
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
    }
  }

  if (isLoading) {
    return (
      <Card className="border-0 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
        <CardContent className="p-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-900/20 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Predicted Alerts
            </CardTitle>
            <CardDescription className="mt-1">Bins likely to need attention soon</CardDescription>
          </div>
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
            Next 24h
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No urgent predictions</p>
              <p className="text-sm mt-1">All bins within normal capacity</p>
            </div>
          ) : (
            alerts.map((alert, idx) => (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 p-4 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-sm">{alert.bin_id}</h4>
                    <p className="text-xs text-muted-foreground">{alert.location}</p>
                  </div>
                  <Badge className={cn("text-xs", getUrgencyColor(alert.urgency))}>
                    {alert.urgency}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-orange-600">
                      Full in {alert.hours_until_full.toFixed(1)} hours
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current fill: {alert.current_fill}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Predicted: {new Date(alert.predicted_time).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function MLStatsCard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["ml-stats"],
    queryFn: getMLStats,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  if (isLoading || !stats) {
    return (
      <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
        <CardContent className="p-6 flex items-center justify-center min-h-[150px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      <CardContent className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
            <Brain className="h-6 w-6" />
          </div>
          <Activity className="h-5 w-5 opacity-75" />
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-emerald-50/80">ML Service Status</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold">{stats?.status || "unknown"}</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-emerald-50/60">Bins Tracked</p>
              <p className="text-lg font-bold">{stats?.statistics?.total_bins_tracked ?? 0}</p>
            </div>
            <div>
              <p className="text-emerald-50/60">Data Points</p>
              <p className="text-lg font-bold">{stats?.statistics?.total_data_points ?? 0}</p>
            </div>
            <div>
              <p className="text-emerald-50/60">With Predictions</p>
              <p className="text-lg font-bold">{stats?.statistics?.bins_with_predictions ?? 0}</p>
            </div>
            <div>
              <p className="text-emerald-50/60">Coverage</p>
              <p className="text-lg font-bold">{(stats?.statistics?.prediction_coverage ?? 0).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
