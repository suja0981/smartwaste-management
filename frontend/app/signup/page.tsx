'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { AlertCircle, CheckCircle } from 'lucide-react'

export default function SignupPage() {
    const [formData, setFormData] = useState({
        email: '',
        fullName: '',
        password: '',
        confirmPassword: '',
    })
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const { signup, isAuthenticated } = useAuth()

    if (isAuthenticated) {
        router.push('/')
        return null
    }

    function validatePassword(password: string): string | null {
        if (password.length < 8) {
            return 'Password must be at least 8 characters long'
        }
        if (!/[A-Z]/.test(password)) {
            return 'Password must contain at least one uppercase letter'
        }
        if (!/[a-z]/.test(password)) {
            return 'Password must contain at least one lowercase letter'
        }
        if (!/[0-9]/.test(password)) {
            return 'Password must contain at least one number'
        }
        return null
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        // Validation
        if (!formData.email || !formData.fullName || !formData.password) {
            setError('All fields are required')
            return
        }

        const passwordError = validatePassword(formData.password)
        if (passwordError) {
            setError(passwordError)
            return
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setIsLoading(true)

        try {
            await signup(formData.email, formData.password, formData.fullName)
            router.push('/')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Signup failed. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
                        Waste Management
                    </h1>
                    <p className="text-gray-600">AI-Powered Smart Waste Collection</p>
                </div>

                <Card className="p-8 shadow-2xl border-0 bg-white/95 backdrop-blur">
                    <h2 className="text-2xl font-bold mb-2 text-gray-900">Create Account</h2>
                    <p className="text-gray-600 mb-6">Join our smart waste management system</p>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                                Full Name
                            </label>
                            <Input
                                id="fullName"
                                type="text"
                                placeholder="John Doe"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={isLoading}
                            />
                            <p className="mt-2 text-xs text-gray-600">
                                Must be at least 8 characters with uppercase, lowercase, and numbers
                            </p>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm Password
                            </label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={isLoading}
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50"
                        >
                            {isLoading ? 'Creating Account...' : 'Create Account'}
                        </Button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-center text-gray-600 text-sm">
                            Already have an account?{' '}
                            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                                Sign In
                            </Link>
                        </p>
                    </div>

                    {/* Password requirements info */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs font-semibold text-blue-900 mb-3">Password Requirements:</p>
                        <ul className="space-y-2 text-xs text-blue-800">
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                At least 8 characters
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                One uppercase letter
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                One lowercase letter
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                One number
                            </li>
                        </ul>
                    </div>
                </Card>

                <p className="text-center text-gray-600 text-sm mt-6">
                    By signing up, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    )
}
