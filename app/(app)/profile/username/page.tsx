"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Plus, Edit2, BarChart3, Shield } from "lucide-react"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"

interface DrinkLog {
  id: string
  timestamp: string
  photoUrl: string
  drinkType: DrinkType
  caption?: string
}

const MOCK_PROFILE = {
  username: "you",
  displayName: "Your Name",
  joinDate: "January 2024",
  friendCount: 24,
  drinkCount: 87,
  avatarColor: "#4ECDC4",
}

const MOCK_DRINK_LOGS: DrinkLog[] = [
  {
    id: "1",
    timestamp: "2 hours ago",
    photoUrl: "/beer-glass-bar.jpg",
    drinkType: "Beer",
    caption: "Trying out the new IPA at the local brewery!",
  },
  {
    id: "2",
    timestamp: "1 day ago",
    photoUrl: "/wine-glass-restaurant.jpg",
    drinkType: "Wine",
  },
  {
    id: "3",
    timestamp: "2 days ago",
    photoUrl: "/cocktail-mojito.png",
    drinkType: "Cocktail",
    caption: "Friday night vibes 🍹",
  },
  {
    id: "4",
    timestamp: "3 days ago",
    photoUrl: "/seltzer-can.jpg",
    drinkType: "Seltzer",
  },
  {
    id: "5",
    timestamp: "4 days ago",
    photoUrl: "/whiskey-glass.jpg",
    drinkType: "Spirit",
    caption: "Celebrating the weekend!",
  },
  {
    id: "6",
    timestamp: "5 days ago",
    photoUrl: "/beer-pint.jpg",
    drinkType: "Beer",
  },
  {
    id: "7",
    timestamp: "6 days ago",
    photoUrl: "/wine-red-glass.jpg",
    drinkType: "Wine",
    caption: "Dinner with friends",
  },
  {
    id: "8",
    timestamp: "1 week ago",
    photoUrl: "/cocktail-martini.jpg",
    drinkType: "Cocktail",
  },
]

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Profile header skeleton */}
      <div className="animate-pulse rounded-2xl border bg-background/50 p-4">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 rounded-full bg-foreground/10" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-32 rounded bg-foreground/10" />
            <div className="h-3 w-24 rounded bg-foreground/10" />
            <div className="flex gap-4">
              <div className="h-3 w-20 rounded bg-foreground/10" />
              <div className="h-3 w-20 rounded bg-foreground/10" />
            </div>
          </div>
        </div>
      </div>

      {/* Actions skeleton */}
      <div className="flex gap-2">
        <div className="h-10 flex-1 animate-pulse rounded-full bg-foreground/10" />
        <div className="h-10 flex-1 animate-pulse rounded-full bg-foreground/10" />
      </div>

      {/* Timeline skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border bg-background/50 p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-foreground/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-foreground/10" />
                <div className="h-2 w-16 rounded bg-foreground/10" />
              </div>
            </div>
            <div className="mt-3 h-64 rounded-xl bg-foreground/10" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed">
        <Plus className="h-8 w-8 opacity-50" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">No logs yet</h3>
      <p className="mb-6 max-w-sm text-sm opacity-70">Start logging drinks to build your timeline.</p>
      <Link
        href="/log"
        className="inline-flex items-center gap-2 rounded-full border bg-black px-4 py-2 text-sm font-medium text-white"
      >
        <Plus className="h-4 w-4" />
        Log Drink
      </Link>
    </div>
  )
}

function DrinkLogCard({ log }: { log: DrinkLog }) {
  return (
    <article className="rounded-2xl border bg-background/50 p-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: MOCK_PROFILE.avatarColor }}
        >
          {MOCK_PROFILE.username[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{MOCK_PROFILE.username}</p>
          <p className="text-xs opacity-60">{log.timestamp}</p>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border">
        <Image
          src={log.photoUrl || "/placeholder.svg"}
          alt={`${log.drinkType} drink`}
          width={400}
          height={400}
          className="h-64 w-full object-cover"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
          {log.drinkType}
        </span>
      </div>

      {log.caption && <p className="mt-3 text-sm leading-relaxed">{log.caption}</p>}
    </article>
  )
}

export default function ProfilePage() {
  const [loading, setLoading] = React.useState(true)
  const [logs, setLogs] = React.useState<DrinkLog[]>([])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setLogs(MOCK_DRINK_LOGS)
      setLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="container max-w-2xl px-4 py-6">
      <h2 className="mb-4 text-2xl font-bold">Profile</h2>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
          {/* Profile Header */}
          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="flex items-start gap-4">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{ backgroundColor: MOCK_PROFILE.avatarColor }}
              >
                {MOCK_PROFILE.username[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">{MOCK_PROFILE.displayName}</h3>
                <p className="text-sm opacity-60">@{MOCK_PROFILE.username}</p>
                <p className="mt-2 text-xs opacity-50">Joined {MOCK_PROFILE.joinDate}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <div>
                    <span className="font-bold">{MOCK_PROFILE.friendCount}</span>{" "}
                    <span className="opacity-60">Friends</span>
                  </div>
                  <div>
                    <span className="font-bold">{MOCK_PROFILE.drinkCount}</span>{" "}
                    <span className="opacity-60">Drinks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => alert("Edit profile coming soon!")}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-black px-4 py-2 text-sm font-medium text-white"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </button>
            <Link
              href="/analytics"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium"
            >
              <BarChart3 className="h-4 w-4" />
              View Analytics
            </Link>
          </div>

          {/* Privacy Section */}
          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 opacity-60" />
              <div>
                <h4 className="text-sm font-semibold">Privacy</h4>
                <p className="mt-1 text-xs leading-relaxed opacity-70">
                  Your photos are private by default and only visible to friends you've connected with.
                </p>
              </div>
            </div>
          </div>

          {/* My Drink Timeline */}
          <div>
            <h3 className="mb-4 text-lg font-bold">My Timeline</h3>
            {logs.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                {logs.map((log) => (
                  <DrinkLogCard key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
