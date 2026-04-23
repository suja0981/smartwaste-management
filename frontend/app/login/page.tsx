'use client';

/**
 * app/login/page.tsx
 *
 * Fixes:
 * 1. Calls correct auth context methods (loginWithGoogle, loginWithEmail, loginLocal)
 * 2. Removed redundant isLoading state — single flag covers all 3 sign-in paths
 * 3. Google icon extracted as stable component (no re-declaration inside render)
 * 4. Error messages now cover Firebase auth error codes properly
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { GoogleIcon } from "@/components/google-icon";
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


function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("auth/wrong-password") || msg.includes("auth/user-not-found") || msg.includes("auth/invalid-credential")) {
    return "Invalid email or password.";
  }
  if (msg.includes("auth/too-many-requests")) {
    return "Too many attempts. Please try again later.";
  }
  if (msg.includes("auth/popup-closed-by-user") || msg.includes("auth/cancelled-popup-request")) {
    return ""; // user cancelled — no error shown
  }
  if (msg.includes("auth/network-request-failed")) {
    return "Network error. Check your connection and try again.";
  }
  return msg;
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
    const msg = humanizeError(err);
    setError(msg);
  };

  const withLoading = async (fn: () => Promise<void>) => {
    setError("");
    setIsLoading(true);
    try {
      await fn();
      router.replace("/");
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogleSignIn = () =>
    withLoading(() => loginWithGoogle());

  const onEmailSignIn = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    withLoading(() => loginWithEmail(email, password));
  };

  const onLocalSignIn = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    withLoading(() => loginLocal(email, password));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
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
            type="button"
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
                  autoComplete="email"
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
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          )}

          {/* Legacy local login */}
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
                  autoComplete="email"
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
                  autoComplete="current-password"
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