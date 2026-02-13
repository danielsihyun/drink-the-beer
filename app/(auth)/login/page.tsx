"use client"

import type React from "react"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Wine } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("signup") === "success") {
      setSuccess("Account created. Please sign in.")
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!email || !password) {
      setError("Please fill in all fields")
      setIsLoading(false)
      return
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address")
      setIsLoading(false)
      return
    }

    const supabase = createClient()
    const redirectTo = searchParams.get("redirectTo") ?? "/feed"

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })

    const { data } = await supabase.auth.getSession()
    console.log("session exists?", Boolean(data.session))

    if (signInErr) {
      setError(signInErr.message)
      setIsLoading(false)
      return
    }

    router.replace(redirectTo)
    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 safe-area-inset">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="flex h-18 w-18 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-primary/20">
            <span className="text-4xl">🍹</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">drinkr</h1>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Track, analyze, and discover drinks with your friends
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Sign in to pick up where you left off</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-11 rounded-xl"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-11 rounded-xl"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm">
            <span className="text-muted-foreground">New here? </span>
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          Your photos and ratings are private by default.
          <br />
          Share only what you want with friends.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 safe-area-inset">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="flex h-18 w-18 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-primary/20 animate-pulse">
              <span className="text-4xl">🍹</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">drinkr</h1>
          </div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}