'use client';

/**
 * app/login/page.tsx — Phase 2 login page.
 *
 * Three sign-in paths:
 *   1. Google Sign-In (Firebase popup)
 *   2. Email + Password (Firebase)
 *   3. Local login link (for legacy admin accounts)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Google "G" SVG icon (no external image dependency)
function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
            />
            <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#34A853"
            />
            <path
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
            />
            <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
            />
        </svg>
    );
}

export default function LoginPage() {
    const { loginWithGoogle, loginWithEmail, loginLocal } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showLocalLogin, setShowLocalLogin] = useState(false);

    const handleError = (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Sign in failed";
        // Make Firebase error codes human-readable
        if (msg.includes("auth/wrong-password") || msg.includes("auth/user-not-found")) {
            setError("Invalid email or password.");
        } else if (msg.includes("auth/too-many-requests")) {
            setError("Too many attempts. Please try again later.");
        } else if (msg.includes("auth/popup-closed-by-user")) {
            setError(""); // user cancelled — don't show an error
        } else {
            setError(msg);
        }
    };

    const onGoogleSignIn = async () => {
        setError("");
        setIsLoading(true);
        try {
            await loginWithGoogle();
            router.push("/");
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const onEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            await loginWithEmail(email, password);
            router.push("/");
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const onLocalSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            await loginLocal(email, password);
            router.push("/");
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-2">
                        {/* Replace with your logo if you have one */}
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                            W
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Smart Waste Management</CardTitle>
                    <CardDescription>Sign in to your account</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Google Sign-In */}
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={onGoogleSignIn}
                        disabled={isLoading}
                    >
                        <GoogleIcon />
                        <span className="ml-2">Continue with Google</span>
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">or</span>
                        </div>
                    </div>

                    {/* Email + Password (Firebase) */}
                    {!showLocalLogin && (
                        <form onSubmit={onEmailSignIn} className="space-y-3">
                            <div className="space-y-1">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? "Signing in…" : "Sign in"}
                            </Button>
                        </form>
                    )}

                    {/* Legacy local login (for admin accounts pre-Firebase) */}
                    {showLocalLogin && (
                        <form onSubmit={onLocalSignIn} className="space-y-3">
                            <Alert>
                                <AlertDescription className="text-xs">
                                    Local login — for admin accounts created before Firebase was enabled.
                                </AlertDescription>
                            </Alert>
                            <div className="space-y-1">
                                <Label htmlFor="local-email">Email</Label>
                                <Input
                                    id="local-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="local-password">Password</Label>
                                <Input
                                    id="local-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? "Signing in…" : "Sign in (local)"}
                            </Button>
                        </form>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <button
                            type="button"
                            className="underline hover:text-foreground transition-colors"
                            onClick={() => {
                                setShowLocalLogin((v) => !v);
                                setError("");
                            }}
                        >
                            {showLocalLogin ? "Use Firebase sign-in" : "Admin / local login"}
                        </button>
                        <a
                            href="/signup"
                            className="underline hover:text-foreground transition-colors"
                        >
                            Create account
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
