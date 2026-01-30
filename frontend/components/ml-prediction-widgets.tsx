"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  getPredictedAlerts,
  getAllPredictions,
  getMLStats,
  type PredictedAlert,
  type FillPrediction,
  type MLStats
} from "@/lib/api-client"
import { Clock, TrendingUp, Brain, AlertTriangle, Zap, Activity, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function MLPredictionsCard() {
  const [predictions, setPredictions] = useState<FillPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchPredictions = async () => {
    try {
      const data = await getAllPredictions()
      setPredictions(data.predictions.slice(0, 5))
      setLoading(false)
    } catch (error) {
      console.error('Prediction fetch error:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPredictions()
    const interval = setInterval(fetchPredictions, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) {
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
      <CardHeader className="border-b bg-gradient-to-r from-violet-50/50 to-transparent dark:from-violet-900/20 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-5 w-5 text-violet-600" />
              ML Fill Predictions
            </CardTitle>
            <CardDescription className="mt-1">AI-powered capacity forecasting</CardDescription>
          </div>
          <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20">
            <Zap className="h-3 w-3 mr-1" />
            Smart AI
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
                className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 p-4 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-sm">{pred.bin_id}</h4>
                    <p className="text-xs text-muted-foreground">
                      Current: {pred.current_fill}%
                    </p>
                  </div>
                  {pred.confidence && (
                    <Badge variant="outline" className="text-xs">
                      {Math.round(pred.confidence * 100)}% confidence
                    </Badge>
                  )}
                </div>

                {pred.hours_until_full ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-violet-600" />
                      <span className="font-medium text-violet-600">
                        Full in {pred.hours_until_full.toFixed(1)} hours
                      </span>
                    </div>
                    {pred.fill_rate_per_hour && (
                      <p className="text-xs text-muted-foreground">
                        Filling at {pred.fill_rate_per_hour.toFixed(2)}% per hour
                      </p>
                    )}
                    {pred.predicted_full_time && (
                      <p className="text-xs text-muted-foreground">
                        Expected: {new Date(pred.predicted_full_time).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Analyzing fill patterns...</p>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" className="w-full rounded-xl border-2">
            <a href="/predictions">View All Predictions →</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function PredictedAlertsCard() {
  const [alerts, setAlerts] = useState<PredictedAlert[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchAlerts = async () => {
    try {
      const data = await getPredictedAlerts(24)
      setAlerts(data.alerts.slice(0, 5))
      setLoading(false)
    } catch (error) {
      console.error('Predicted alerts fetch error:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

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

  if (loading) {
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
  const [stats, setStats] = useState<MLStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const data = await getMLStats()
      setStats(data)
      setLoading(false)
    } catch (error) {
      console.error('ML stats fetch error:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  if (loading || !stats) {
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
              <h3 className="text-3xl font-bold">{stats.status}</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-emerald-50/60">Bins Tracked</p>
              <p className="text-lg font-bold">{stats.statistics.total_bins_tracked}</p>
            </div>
            <div>
              <p className="text-emerald-50/60">Data Points</p>
              <p className="text-lg font-bold">{stats.statistics.total_data_points}</p>
            </div>
            <div>
              <p className="text-emerald-50/60">With Predictions</p>
              <p className="text-lg font-bold">{stats.statistics.bins_with_predictions}</p>
            </div>
            <div>
              <p className="text-emerald-50/60">Coverage</p>
              <p className="text-lg font-bold">{stats.statistics.prediction_coverage.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}