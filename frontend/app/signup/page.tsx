'use client';

/**
 * app/signup/page.tsx
 *
 * Fixes:
 * 1. Calls registerWithEmailPassword (alias for register in auth-context)
 * 2. Consolidated loading/error state with withLoading helper
 * 3. Added autoComplete attributes for accessibility
 * 4. Password strength hint shown consistently
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


const PASSWORD_HINT =
  "Min 8 chars, uppercase, lowercase, number, and a special character (e.g. Admin@1234)";

function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("auth/email-already-in-use") || msg.includes("already registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (msg.includes("auth/weak-password")) {
    return "Password is too weak. " + PASSWORD_HINT;
  }
  if (msg.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (msg.includes("auth/network-request-failed")) {
    return "Network error. Check your connection and try again.";
  }
  return msg;
}

export default function SignupPage() {
  const { loginWithGoogle, registerWithEmailPassword } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const withLoading = async (fn: () => Promise<void>) => {
    setError("");
    setIsLoading(true);
    try {
      await fn();
      router.replace("/");
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogleSignUp = () =>
    withLoading(() => loginWithGoogle());

  const onEmailSignUp = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    withLoading(() => registerWithEmailPassword(email, password, fullName));
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
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>Smart Waste Management System</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={onGoogleSignUp}
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

          <form onSubmit={onEmailSignUp} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Rajesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
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
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="underline hover:text-foreground transition-colors">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}