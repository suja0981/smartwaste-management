"use client";

/**
 * contexts/auth-context.tsx — Phase 2 complete rewrite.
 *
 * Supports:
 *   - Google Sign-In via Firebase
 *   - Email/Password via Firebase
 *   - Legacy local login (POST /auth/login) — kept for admin accounts
 *     that were created before Firebase was added
 *
 * After any successful sign-in we exchange the Firebase ID token for our
 * own backend JWT.  Every API call then uses that JWT — no Firebase SDK
 * calls outside this file.
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    ReactNode,
} from "react";
import {
    auth,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    firebaseSignOut,
    getFirebaseIdToken,
    onAuthStateChanged,
    User as FirebaseUser,
} from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BackendUser {
    id: number;
    email: string;
    full_name: string;
    role: "admin" | "user";
    is_active: boolean;
}

interface AuthContextType {
    // State
    user: BackendUser | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;

    // Actions
    loginWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    registerWithEmailPassword: (
        email: string,
        password: string,
        fullName: string
    ) => Promise<void>;
    /** Legacy local login — still works for admin accounts without Firebase */
    loginLocal: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "swm_token";
const REFRESH_TOKEN_KEY = "swm_refresh_token";
const USER_KEY = "swm_user";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<BackendUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ── Persist / restore session ────────────────────────────────────────────

    const persistSession = useCallback(
        (jwt: string, backendUser: BackendUser, refreshToken?: string) => {
            localStorage.setItem(TOKEN_KEY, jwt);
            if (refreshToken) {
                localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
            }
            localStorage.setItem(USER_KEY, JSON.stringify(backendUser));
            setToken(jwt);
            setUser(backendUser);
        },
        []
    );

    const clearSession = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    }, []);

    // ── Exchange Firebase ID token for our backend JWT ────────────────────────

    const refreshAccessToken = useCallback(async (): Promise<void> => {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) return;

        try {
            const res = await fetch(`${API_BASE}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (!res.ok) {
                // Refresh failed - clear session and force re-login
                clearSession();
                return;
            }

            const data = await res.json();
            persistSession(data.access_token, data.user, data.refresh_token);
        } catch (error) {
            // Network error - keep existing token
        }
    }, [persistSession, clearSession]);

    const exchangeFirebaseToken = useCallback(
        async (firebaseUser: FirebaseUser): Promise<void> => {
            const idToken = await getFirebaseIdToken(firebaseUser);

            const res = await fetch(`${API_BASE}/auth/firebase`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_token: idToken }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Failed to authenticate with backend");
            }

            const data = await res.json();
            persistSession(data.access_token, data.user, data.refresh_token);
        },
        [persistSession]
    );

    // ── Listen to Firebase auth state ─────────────────────────────────────────
    // This fires on page load, after Google sign-in, and after sign-out.

    useEffect(() => {
        // Restore from localStorage first (instant — no flicker)
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                // Firebase user is signed in — keep backend token fresh
                try {
                    await exchangeFirebaseToken(firebaseUser);
                } catch {
                    // If exchange fails (e.g. backend down) keep existing token
                }
            } else {
                // Firebase signed out — but keep local-login sessions alive
                // (they don't have a Firebase user)
                const stillHasLocalToken = localStorage.getItem(TOKEN_KEY);
                if (!stillHasLocalToken) {
                    clearSession();
                }
            }
            setIsLoading(false);
        });

        return unsubscribe;
    }, [exchangeFirebaseToken, clearSession]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const loginWithGoogle = useCallback(async () => {
        const result = await signInWithGoogle();
        // onAuthStateChanged fires automatically — but we also exchange here
        // for immediate response (no waiting for the listener)
        await exchangeFirebaseToken(result.user);
    }, [exchangeFirebaseToken]);

    const loginWithEmail = useCallback(
        async (email: string, password: string) => {
            const result = await signInWithEmail(email, password);
            await exchangeFirebaseToken(result.user);
        },
        [exchangeFirebaseToken]
    );

    const registerWithEmailPassword = useCallback(
        async (email: string, password: string, fullName: string) => {
            // 1. Create Firebase account
            const result = await registerWithEmail(email, password);
            // 2. Also register in our backend (so full_name is stored)
            const res = await fetch(`${API_BASE}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, full_name: fullName }),
            });
            if (!res.ok) {
                // Clean up the Firebase account if our backend rejected it
                await result.user.delete();
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Registration failed");
            }
            const data = await res.json();
            persistSession(data.access_token, data.user, data.refresh_token);
        },
        [persistSession]
    );

    /** Legacy local login — for admin accounts created before Firebase */
    const loginLocal = useCallback(
        async (email: string, password: string) => {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Invalid email or password");
            }
            const data = await res.json();
            persistSession(data.access_token, data.user, data.refresh_token);
        },
        [persistSession]
    );

    const logout = useCallback(async () => {
        // Call backend logout to revoke the JWT
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }).catch(() => { }); // Ignore errors
        } catch {
            // Silently fail - still clear local session
        }

        await firebaseSignOut().catch(() => { }); // don't throw if no Firebase session
        clearSession();
    }, [token, clearSession]);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                isAuthenticated: !!token && !!user,
                isAdmin: user?.role === "admin",
                loginWithGoogle,
                loginWithEmail,
                registerWithEmailPassword,
                loginLocal,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used inside <AuthProvider>");
    }
    return ctx;
}