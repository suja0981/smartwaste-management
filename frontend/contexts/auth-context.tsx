'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface User {
    id: number
    email: string
    full_name: string
    role: 'admin' | 'user'
    is_active: boolean
}

export interface AuthContextType {
    user: User | null
    token: string | null
    isLoading: boolean
    isAdmin: boolean
    login: (email: string, password: string) => Promise<void>
    signup: (email: string, password: string, fullName: string) => Promise<void>
    logout: () => void
    isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Load token from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('authToken')
        if (storedToken) {
            setToken(storedToken)
            // Optionally verify token and get user info
            verifyToken(storedToken)
        } else {
            setIsLoading(false)
        }
    }, [])

    async function verifyToken(authToken: string) {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            })
            if (response.ok) {
                const userData = await response.json()
                setUser(userData)
            } else {
                localStorage.removeItem('authToken')
                setToken(null)
            }
        } catch (error) {
            console.error('Token verification failed:', error)
            localStorage.removeItem('authToken')
            setToken(null)
        } finally {
            setIsLoading(false)
        }
    }

    async function login(email: string, password: string) {
        setIsLoading(true)
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Login failed')
            }

            const data = await response.json()
            const authToken = data.access_token
            setToken(authToken)
            setUser(data.user)
            localStorage.setItem('authToken', authToken)
        } catch (error) {
            throw error
        } finally {
            setIsLoading(false)
        }
    }

    async function signup(email: string, password: string, fullName: string) {
        setIsLoading(true)
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, full_name: fullName }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Signup failed')
            }

            const data = await response.json()
            const authToken = data.access_token
            setToken(authToken)
            setUser(data.user)
            localStorage.setItem('authToken', authToken)
        } catch (error) {
            throw error
        } finally {
            setIsLoading(false)
        }
    }

    function logout() {
        setUser(null)
        setToken(null)
        localStorage.removeItem('authToken')
    }

    const value: AuthContextType = {
        user,
        token,
        isLoading,
        isAdmin: user?.role === 'admin' || false,
        login,
        signup,
        logout,
        isAuthenticated: !!user && !!token,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
