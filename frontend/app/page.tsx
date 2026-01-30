'use client'

import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import {
  ModernDashboardStats,
  ModernBinStatus,
  ModernAIAlerts
} from "@/components/modern-dashboard-widgets"
import { MLPredictionsCard, PredictedAlertsCard, MLStatsCard } from "@/components/ml-prediction-widgets"

export default function HomePage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-8 pb-8">
          {/* Hero Section with Gradient */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-700 p-8 text-white shadow-2xl">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h1 className="text-5xl font-bold tracking-tight">
                    Smart Waste Management
                  </h1>
                  <p className="text-lg text-cyan-50/90 max-w-2xl">
                    AI-powered monitoring and optimization for your waste collection network
                  </p>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-full animate-pulse"></div>
                    <div className="relative bg-white/10 backdrop-blur-md p-6 rounded-full border border-white/20">
                      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Animated circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          </div>

          {/* Stats Grid */}
          <ModernDashboardStats />

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ModernBinStatus />
            <ModernAIAlerts />
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <a href="/bins" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-semibold">Manage Bins</h3>
                  <svg className="w-6 h-6 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <p className="text-emerald-50/80 text-sm">Monitor and control all waste bins</p>
              </div>
            </a>

            <a href="/crew" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-pink-600 p-6 text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-semibold">Crew Management</h3>
                  <svg className="w-6 h-6 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <p className="text-orange-50/80 text-sm">Assign tasks and track teams</p>
              </div>
            </a>

            <a href="/reports" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-6 text-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-semibold">View Reports</h3>
                  <svg className="w-6 h-6 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <p className="text-violet-50/80 text-sm">Analytics and insights</p>
              </div>
            </a>
          </div>

          {/* ML Predictions and Alerts */}
          <div className="grid gap-6 lg:grid-cols-3">
            <MLPredictionsCard />
            <PredictedAlertsCard />
            <MLStatsCard />
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}