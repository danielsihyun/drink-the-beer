"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Beer } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SignupPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const validateForm = () => {
    const errors: string[] = []

    if (!email || !username || !password || !confirmPassword) {
      errors.push("Please fill in all fields")
    }
    if (email && !email.includes("@")) {
      errors.push("Please enter a valid email address")
    }
    if (username && username.length < 3) {
      errors.push("Username must be at least 3 characters")
    }
    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push("Username can only contain letters, numbers, and underscores")
    }
    if (password && password.length < 8) {
      errors.push("Password must be at least 8 characters")
    }
    if (password && confirmPassword && password !== confirmPassword) {
      errors.push("Passwords do not match")
    }

    setValidationErrors(errors)
    return errors.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setValidationErrors([])

    if (!validateForm()) return

    setIsLoading(true)

    const supabase = createClient()

    // Optional: check username availability (requires SELECT policy on profiles)
    const { data: existing, error: checkErr } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle()

    if (checkErr) {
      setError(checkErr.message)
      setIsLoading(false)
      return
    }

    if (existing) {
      setError("That username is already taken.")
      setIsLoading(false)
      return
    }

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username },
      },
    })

    if (signUpErr) {
      setError(signUpErr.message)
      setIsLoading(false)
      return
    }

    // Since confirmations are OFF, Supabase may auto-create a session.
    // We want: signup -> go to login (NOT feed), so we sign out to prevent proxy redirecting /login -> /feed.
    if (data.session) {
      await supabase.auth.signOut()
    }

    setSuccess("Account created! Redirecting to login…")

    // Quick success toast time, then move to login
    setTimeout(() => {
      router.replace("/login?signup=success")
    }, 900)

    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 safe-area-inset">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Beer className="h-9 w-9 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Drink The Beer</h1>
          <p className="text-sm text-muted-foreground">Join the community of beer enthusiasts</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error banner (red) */}
            {(error || validationErrors.length > 0) && (
              <div className="space-y-1 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error && <div>{error}</div>}
                {validationErrors.map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
              </div>
            )}

            {/* Success banner (green) */}
            {success && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700">
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
                className="h-11"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="beermaster"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="h-11"
                autoComplete="username"
              />
              <p className="text-xs text-muted-foreground">
                At least 3 characters, letters, numbers, and underscores only
              </p>
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
                className="h-11"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="h-11"
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="h-11 w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Your photos and ratings are private by default.
          <br />
          Share only what you want with friends.
        </p>
      </div>
    </div>
  )
}
