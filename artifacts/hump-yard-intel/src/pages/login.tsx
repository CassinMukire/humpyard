// =============================================================================
// Login page — single-user (Cassin). Posts to /api/v1/auth/login, stores the
// token in localStorage, redirects to /.
//
// DISABLE_AUTH=true short-circuits the auth middleware and returns 200 to
// every request; this page is the path you'll use once auth is flipped on
// (Sep 18 freeze target).
// =============================================================================

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/v1-api";
import { Loader2, LogIn, AlertCircle } from "lucide-react";

const TOKEN_KEY = "decel_session_token";

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: ({ u, p }: { u: string; p: string }) => login(u, p),
    onSuccess: (data) => {
      setAuthToken(data.token);
      setLocation("/");
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center justify-center mb-2">
            <img src="/decel-logo.png" alt="DECEL" className="h-10 w-auto object-contain" />
          </div>
          <CardTitle className="text-center text-lg">DECEL Intel</CardTitle>
          <CardDescription className="text-center">
            Single-user v1. Sign in with your operator credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!username || !password) return;
              mutation.mutate({ u: username, p: password });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-mono uppercase tracking-wider">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="font-mono"
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wider">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="font-mono"
                disabled={mutation.isPending}
              />
            </div>

            {mutation.isError && (
              <div className="border border-red-600/50 bg-red-600/10 text-red-400 p-2.5 text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  {mutation.error instanceof Error ? mutation.error.message : "Login failed"}
                </span>
              </div>
            )}

            <Button
              type="submit"
              disabled={mutation.isPending || !username || !password}
              className="w-full font-mono text-xs uppercase tracking-wider"
            >
              {mutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <LogIn className="w-3.5 h-3.5 mr-1.5" />
              )}
              Sign in
            </Button>
          </form>

          <p className="text-[10px] text-muted-foreground font-mono mt-4 text-center">
            W35 demo: auth is disabled in this build. The page is here for the Sep 18 cutover.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
