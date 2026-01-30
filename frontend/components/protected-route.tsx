'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'

export function ProtectedRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth()
    const router = useRouter()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
                <Card className="p-8 shadow-lg">
                    <div className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600">Loading...</p>
                    </div>
                </Card>
            </div>
        )
    }

    if (!isAuthenticated) {
        router.push('/login')
        return null
    }

    return <>{children}</>
}

export function AdminOnlyRoute({ children }: { children: ReactNode }) {
    const { isAdmin, isLoading, isAuthenticated } = useAuth()
    const router = useRouter()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
                <Card className="p-8 shadow-lg">
                    <div className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600">Loading...</p>
                    </div>
                </Card>
            </div>
        )
    }

    if (!isAuthenticated) {
        router.push('/login')
        return null
    }

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
                <Card className="p-8 shadow-lg max-w-md">
                    <div className="text-center space-y-4">
                        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
                        <p className="text-gray-600">You do not have permission to access this page.</p>
                        <p className="text-sm text-gray-500">Admin access required.</p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                </Card>
            </div>
        )
    }

    return <>{children}</>
}
