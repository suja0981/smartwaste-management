"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { PredictionOverview } from "@/components/prediction-overview"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function PredictionsPage() {
    return (
        <ProtectedRoute>
            <DashboardLayout>
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">ML Predictions & Analytics</h1>
                        <p className="text-muted-foreground mt-2">
                            AI-powered forecasting for bin fullness, anomaly detection, and collection optimization
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Info Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-blue-600" />
                                    About ML Predictions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Our machine learning system continuously analyzes historical telemetry data to predict when bins will reach capacity,
                                    detect anomalies in sensor readings, and recommend optimal collection schedules. The predictions become more accurate
                                    as more data is collected.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Predictions Overview */}
                        <PredictionOverview />
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    )
}
