"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { RefreshCw, UserPlus, Plus } from "lucide-react"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"

interface FeedItem {
  id: string
  username: string
  avatarColor: string
  timestamp: string
  photoUrl: string
  drinkType: DrinkType
  caption?: string
}

const MOCK_FEED: FeedItem[] = [
  {
    id: "1",
    username: "sarah_m",
    avatarColor: "#FF6B6B",
    timestamp: "2 hours ago",
    photoUrl: "/beer-glass-bar.jpg",
    drinkType: "Beer",
    caption: "First IPA of the day at my favorite brewery!",
  },
  {
    id: "2",
    username: "mike_drinks",
    avatarColor: "#4ECDC4",
    timestamp: "3 hours ago",
    photoUrl: "/wine-glass-restaurant.jpg",
    drinkType: "Wine",
  },
  {
    id: "3",
    username: "emma_j",
    avatarColor: "#FFE66D",
    timestamp: "5 hours ago",
    photoUrl: "/cocktail-mojito.png",
    drinkType: "Cocktail",
    caption: "Summer vibes with the crew 🌴",
  },
]

function LoadingSkeleton() {
  return (
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
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-16 rounded-full bg-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed">
        <Plus className="h-8 w-8 opacity-50" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">No activity yet</h3>
      <p className="mb-6 max-w-sm text-sm opacity-70">Add friends or log your first drink to get started.</p>
      <div className="flex gap-3">
        <Link
          href="/friends"
          className="inline-flex items-center gap-2 rounded-full border bg-black px-4 py-2 text-sm font-medium text-white"
        >
          <UserPlus className="h-4 w-4" />
          Add Friends
        </Link>
        <Link href="/log" className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          Log Drink
        </Link>
      </div>
    </div>
  )
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <article className="rounded-2xl border bg-background/50 p-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: item.avatarColor }}
        >
          {item.username[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{item.username}</p>
          <p className="text-xs opacity-60">{item.timestamp}</p>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border">
        <Image
          src={item.photoUrl || "/placeholder.svg"}
          alt={`${item.username}'s ${item.drinkType}`}
          width={400}
          height={400}
          className="h-64 w-full object-cover"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
          {item.drinkType}
        </span>
      </div>

      {item.caption && <p className="mt-3 text-sm leading-relaxed">{item.caption}</p>}
    </article>
  )
}

export default function FeedPage() {
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<FeedItem[]>([])
  const [refreshing, setRefreshing] = React.useState(false)

  React.useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => {
      setItems(MOCK_FEED)
      setLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => {
      setItems(MOCK_FEED)
      setRefreshing(false)
    }, 600)
  }

  return (
    <div className="container max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Feed</h2>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading || refreshing ? (
        <LoadingSkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
