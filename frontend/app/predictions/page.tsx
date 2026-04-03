"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { PredictionOverview } from "@/components/prediction-overview"
import { PredictionServiceHealth } from "@/components/prediction-service-health"
import { PredictionCollectionPriority } from "@/components/prediction-collection-priority"
import { ProtectedRoute } from "@/components/protected-route"
import { Brain, Zap, Shield, TrendingUp } from "lucide-react"

export default function PredictionsPage() {
    return (
        <ProtectedRoute>
            <DashboardLayout>
                <div className="space-y-8">

                    {/* ── Page Header ─────────────────────────────────────── */}
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30">
                                    <Brain className="h-5 w-5 text-violet-600" />
                                </div>
                                <h1 className="text-3xl font-bold tracking-tight">
                                    Predictive Intelligence
                                </h1>
                            </div>
                            <p className="text-sm text-muted-foreground ml-12">
                                Stabilized forecasting with confidence scoring, anomaly detection, and optimized collection routes
                            </p>
                        </div>
                    </div>

                    {/* ── Key Features ─────────────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            {
                                icon: <TrendingUp className="h-4 w-4" />,
                                bg: "from-violet-50 to-transparent dark:from-violet-950/20",
                                title: "Fill Prediction",
                                desc: "With outlier removal & confidence scores",
                                color: "text-violet-600",
                            },
                            {
                                icon: <Shield className="h-4 w-4" />,
                                bg: "from-blue-50 to-transparent dark:from-blue-950/20",
                                title: "Anomaly Detection",
                                desc: "Real-time sensor issue identification",
                                color: "text-blue-600",
                            },
                            {
                                icon: <Zap className="h-4 w-4" />,
                                bg: "from-amber-50 to-transparent dark:from-amber-950/20",
                                title: "Urgency Scoring",
                                desc: "Confidence-weighted prioritization",
                                color: "text-amber-600",
                            },
                            {
                                icon: <Brain className="h-4 w-4" />,
                                bg: "from-emerald-50 to-transparent dark:from-emerald-950/20",
                                title: "Service Health",
                                desc: "System coverage & data quality",
                                color: "text-emerald-600",
                            },
                        ].map((item) => (
                            <div
                                key={item.title}
                                className={`flex flex-col gap-2 p-4 rounded-xl bg-gradient-to-br ${item.bg} border border-transparent hover:border-primary/20 transition-colors`}
                            >
                                <div className={`p-2 rounded-lg bg-white dark:bg-slate-900 w-fit ${item.color}`}>
                                    {item.icon}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold leading-tight">{item.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        {item.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Service Health Dashboard ────────────────────────── */}
                    <PredictionServiceHealth />

                    {/* ── Collection Priority & Alerts ────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <PredictionOverview />
                        </div>
                        <div>
                            <PredictionCollectionPriority />
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    )
}