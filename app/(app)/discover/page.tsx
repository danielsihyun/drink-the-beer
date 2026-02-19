"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Loader2,
  Search,
  Plus,
  Check,
  Users,
  Sparkles,
  ChevronRight,
  Flame,
  BookOpen,
  Lightbulb,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

/* ── Types ─────────────────────────────────────────────────────── */

type SearchProfileRow = {
  id: string
  username: string
  display_name: string
  avatar_path: string | null
  friend_count: number
  drink_count: number
  outgoing_pending?: boolean
}

type UiPerson = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  friendCount: number
  drinkCount: number
  cheersCount: number
  outgoingPending?: boolean
  isFriend?: boolean
}

type TrendingDrink = {
  id: string | null
  name: string
  category: string
  imageUrl: string | null
  count: number
  percentChange: number | null
}

type SuggestedPerson = UiPerson & { mutualCount: number }

type DrinkCollection = {
  id: string
  name: string
  count: number
  emoji: string
  gradient: string
}

type RecommendedDrink = {
  id: string
  name: string
  category: string
  imageUrl: string | null
  reason: string
}

type DrinkOfTheDay = {
  id: string
  name: string
  category: string
  imageUrl: string | null
  description: string
  instructions: string | null
}






/* ── Constants ─────────────────────────────────────────────────── */

const DRINK_EMOJI: Record<string, string> = {
  Beer: "🍺",
  Wine: "🍷",
  Cocktail: "🍸",
  Shot: "🥃",
  Seltzer: "🥤",
  Spirit: "🥃",
  Other: "🍹",
}



/* ── Section Header ────────────────────────────────────────────── */

function SectionHeader({
  icon: Icon,
  label,
  action,
  onAction,
}: {
  icon?: React.ElementType
  label: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-neutral-400 dark:text-white/30" />}
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">
          {label}
        </div>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-0.5 text-xs font-medium text-neutral-400 dark:text-white/30 transition-colors hover:text-neutral-600 dark:hover:text-white/50"
        >
          {action}
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

/* ── PersonCard ────────────────────────────────────────────────── */

function PersonCard({
  avatarUrl,
  username,
  displayName,
  friendCount,
  drinkCount,
  cheersCount,
  subtitle,
  actions,
}: {
  avatarUrl: string | null
  username: string
  displayName: string
  friendCount: number
  drinkCount: number
  cheersCount?: number
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-4">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${username}`} className="flex items-center gap-3 flex-1 min-w-0 group/profile">
          {avatarUrl ? (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white dark:ring-neutral-800 shadow-sm border border-neutral-100 dark:border-white/[0.06]">
              <Image
                src={avatarUrl}
                alt="Profile"
                fill
                className="object-cover transition-transform duration-500 group-hover/profile:scale-110"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-2 ring-white dark:ring-neutral-800 shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-neutral-400 dark:text-white/30">
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
              </svg>
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight truncate">{displayName}</div>
            <div className="text-[13px] text-neutral-500 dark:text-white/40 font-medium truncate">@{username}</div>

            {subtitle ? (
              <div className="text-[13px] text-neutral-500 dark:text-white/40">{subtitle}</div>
            ) : (
              <div className="flex gap-4 text-[13px]">
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white">{friendCount}</span>{" "}
                  <span className="text-neutral-500 dark:text-white/40">friends</span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white">{drinkCount}</span>{" "}
                  <span className="text-neutral-500 dark:text-white/40">drinks</span>
                </div>
                {cheersCount !== undefined && (
                  <div>
                    <span className="font-semibold text-neutral-900 dark:text-white">{cheersCount}</span>{" "}
                    <span className="text-neutral-500 dark:text-white/40">cheers</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Link>

        {actions && <div className="shrink-0 flex items-center gap-1.5">{actions}</div>}
      </div>
    </article>
  )
}



/* ── Collection Card ───────────────────────────────────────────── */

function CollectionCard({ collection }: { collection: DrinkCollection }) {
  return (
    <Link
      href={`/discover/collections/${collection.id}`}
      className="flex items-center gap-3 rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-3.5 transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] active:scale-[0.98] w-full"
    >
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg",
        collection.gradient
      )}>
        {collection.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-neutral-900 dark:text-white truncate">{collection.name}</div>
        <div className="text-[12px] text-neutral-500 dark:text-white/35">{collection.count} drinks</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 dark:text-white/15" />
    </Link>
  )
}

/* ── Recommendation Card ───────────────────────────────────────── */

function RecommendationCard({ drink }: { drink: RecommendedDrink }) {
  return (
    <div className="flex items-center gap-4 rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-3 transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100/80 dark:bg-white/[0.06] border border-neutral-100 dark:border-white/[0.04]">
        {drink.imageUrl ? (
          <Image src={drink.imageUrl} alt={drink.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-3xl">{DRINK_EMOJI[drink.category] ?? "🍹"}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight">{drink.name}</div>
        <div className="text-[12px] text-neutral-500 dark:text-white/35">{drink.category}</div>
        <div className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
          {drink.reason}
        </div>
      </div>

      <Link
        href="/log"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black shadow-sm transition-all active:scale-95 hover:bg-neutral-800 dark:hover:bg-neutral-100"
        aria-label="Log this drink"
      >
        <Plus className="h-4 w-4" />
      </Link>
    </div>
  )
}

/* ── Main Component ────────────────────────────────────────────── */

export default function DiscoverPage() {
  const supabase = createClient()
  const router = useRouter()

  const [meId, setMeId] = React.useState<string | null>(null)
  const [friendIds, setFriendIds] = React.useState<Set<string>>(new Set())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Search
  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<UiPerson[]>([])
  const [outgoingPendingIds, setOutgoingPendingIds] = React.useState<Record<string, true>>({})

  // Trending
  const [trending, setTrending] = React.useState<TrendingDrink[]>([])

  // Suggested people (friends of friends)
  const [suggested, setSuggested] = React.useState<SuggestedPerson[]>([])

  // Drink of the day
  const [drinkOfTheDay, setDrinkOfTheDay] = React.useState<DrinkOfTheDay | null>(null)

  // Collections
  const [collections, setCollections] = React.useState<DrinkCollection[]>([])

  // Recommendations
  const [recommendations, setRecommendations] = React.useState<RecommendedDrink[]>([])

  // Toast
  const [toastMsg, setToastMsg] = React.useState<string | null>(null)
  const toastTimerRef = React.useRef<number | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3000)
  }

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  /* ── Initial load ─────────────────────────────────────────────── */

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!userRes.user) {
          router.replace("/login?redirectTo=%2Fdiscover")
          return
        }

        const userId = userRes.user.id
        setMeId(userId)

        // Get current friend IDs
        const { data: friendships } = await supabase
          .from("friendships")
          .select("requester_id, addressee_id")
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .eq("status", "accepted")

        const myFriendIds = new Set(
          (friendships ?? []).map((f: any) =>
            f.requester_id === userId ? f.addressee_id : f.requester_id
          )
        )
        setFriendIds(myFriendIds)

        // Load discover data & suggested in parallel
        const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
        if (sessErr) throw sessErr
        const token = sessRes.session?.access_token

        await Promise.all([
          // Discover API: trending, drinkOfTheDay, collections, recommendations
          (async () => {
            if (!token) return
            try {
              const res = await fetch("/api/discover", {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (!res.ok) throw new Error("Discover API failed")
              const data = await res.json()
              setTrending(data.trending ?? [])
              setDrinkOfTheDay(data.drinkOfTheDay ?? null)
              setCollections(data.collections ?? [])
              setRecommendations(data.recommendations ?? [])
            } catch (e) {
              console.error("Failed to load discover data:", e)
            }
          })(),
          loadSuggested(userId, myFriendIds),
        ])
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [supabase, router])

  /* ── Suggested people (friends of friends) ────────────────────── */

  async function loadSuggested(userId: string, myFriendIds: Set<string>) {
    try {
      if (myFriendIds.size === 0) {
        setSuggested([])
        return
      }

      const friendIdArray = Array.from(myFriendIds)

      const { data: fofRows } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(
          friendIdArray.map(id => `requester_id.eq.${id}`).join(",") +
          "," +
          friendIdArray.map(id => `addressee_id.eq.${id}`).join(",")
        )
        .limit(500)

      const mutualCounts: Record<string, number> = {}

      for (const row of fofRows ?? []) {
        const personA = row.requester_id
        const personB = row.addressee_id

        if (myFriendIds.has(personA) && personB !== userId && !myFriendIds.has(personB)) {
          mutualCounts[personB] = (mutualCounts[personB] || 0) + 1
        }
        if (myFriendIds.has(personB) && personA !== userId && !myFriendIds.has(personA)) {
          mutualCounts[personA] = (mutualCounts[personA] || 0) + 1
        }
      }

      const topSuggestions = Object.entries(mutualCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      if (topSuggestions.length === 0) {
        setSuggested([])
        return
      }

      const suggestedIds = topSuggestions.map(([id]) => id)
      const mutualMap = new Map(topSuggestions)

      const { data: profiles } = await supabase
        .from("profile_public_stats")
        .select("id, username, display_name, avatar_path, friend_count, drink_count")
        .in("id", suggestedIds)

      const avatarUrls = await Promise.all(
        (profiles ?? []).map((p: any) =>
          p.avatar_path
            ? supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60).then(r => r.data?.signedUrl ?? null)
            : Promise.resolve(null)
        )
      )

      const { data: pendingOut } = await supabase
        .from("friendships")
        .select("addressee_id")
        .eq("requester_id", userId)
        .eq("status", "pending")
        .in("addressee_id", suggestedIds)

      const pendingOutIds = new Set((pendingOut ?? []).map((r: any) => r.addressee_id))

      const mapped: SuggestedPerson[] = (profiles ?? []).map((p: any, i: number) => ({
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: avatarUrls[i],
        friendCount: p.friend_count ?? 0,
        drinkCount: p.drink_count ?? 0,
        cheersCount: 0,
        mutualCount: mutualMap.get(p.id) ?? 0,
        outgoingPending: pendingOutIds.has(p.id),
      }))

      mapped.sort((a, b) => b.mutualCount - a.mutualCount)
      setSuggested(mapped)
    } catch (e) {
      console.error("Failed to load suggestions:", e)
    }
  }

  /* ── Search ───────────────────────────────────────────────────── */

  React.useEffect(() => {
    if (!meId) return
    const q = query.trim()
    if (!q.length) {
      setSearchResults([])
      return
    }

    const t = window.setTimeout(async () => {
      setSearching(true)
      try {
        const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
        if (sessErr) throw sessErr
        const token = sessRes.session?.access_token
        if (!token) throw new Error("Missing session token.")

        const res = await fetch("/api/profile/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ q }),
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error ?? "Search failed.")

        const base = (json?.items ?? []) as SearchProfileRow[]
        const filtered = base.filter((p) => p.id !== meId)

        const filteredIds = filtered.map((p) => p.id)

        const [avatarUrls, cheersCountMap] = await Promise.all([
          Promise.all(
            filtered.map((p) =>
              p.avatar_path
                ? supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60).then(r => r.data?.signedUrl ?? null)
                : Promise.resolve(null)
            )
          ),
          // Batch fetch cheers received for each user
          (async () => {
            if (filteredIds.length === 0) return new Map<string, number>()
            // Get all drink log IDs grouped by user
            const { data: logRows } = await supabase
              .from("drink_logs")
              .select("id, user_id")
              .in("user_id", filteredIds)
            const logsByUser = new Map<string, string[]>()
            for (const r of (logRows ?? []) as { id: string; user_id: string }[]) {
              const arr = logsByUser.get(r.user_id) ?? []
              arr.push(r.id)
              logsByUser.set(r.user_id, arr)
            }
            const allLogIds = (logRows ?? []).map((r: any) => r.id)
            if (allLogIds.length === 0) return new Map<string, number>()
            const { data: cheersRows } = await supabase
              .from("drink_cheers")
              .select("drink_log_id")
              .in("drink_log_id", allLogIds)
            // Count cheers per user
            const countMap = new Map<string, number>()
            for (const c of (cheersRows ?? []) as { drink_log_id: string }[]) {
              for (const [uid, logs] of logsByUser) {
                if (logs.includes(c.drink_log_id)) {
                  countMap.set(uid, (countMap.get(uid) ?? 0) + 1)
                  break
                }
              }
            }
            return countMap
          })(),
        ])

        const mapped: UiPerson[] = filtered.map((p, i) => ({
          id: p.id,
          username: p.username,
          displayName: p.display_name,
          avatarUrl: avatarUrls[i],
          friendCount: p.friend_count ?? 0,
          drinkCount: p.drink_count ?? 0,
          cheersCount: cheersCountMap.get(p.id) ?? 0,
          outgoingPending: !!p.outgoing_pending || !!outgoingPendingIds[p.id],
          isFriend: friendIds.has(p.id),
        }))

        setSearchResults(mapped)
      } catch (e: any) {
        setError(e?.message ?? "Search failed.")
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => window.clearTimeout(t)
  }, [query, meId, supabase, friendIds, outgoingPendingIds])

  /* ── Add Friend ───────────────────────────────────────────────── */

  async function addFriend(friendId: string) {
    setError(null)
    try {
      const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) throw sessErr
      const token = sessRes.session?.access_token
      if (!token) throw new Error("Missing session token.")

      const res = await fetch("/api/friends/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendId }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Could not add friend.")

      if (json?.autoAccepted) {
        showToast("Friend added!")
        setSearchResults((prev) => prev.map((p) => (p.id === friendId ? { ...p, isFriend: true } : p)))
        setSuggested((prev) => prev.filter((p) => p.id !== friendId))
        setFriendIds((prev) => new Set([...prev, friendId]))
      } else {
        showToast("Request sent!")
        setOutgoingPendingIds((prev) => ({ ...prev, [friendId]: true }))
        setSearchResults((prev) => prev.map((p) => (p.id === friendId ? { ...p, outgoingPending: true } : p)))
        setSuggested((prev) => prev.map((p) => (p.id === friendId ? { ...p, outgoingPending: true } : p)))
      }

      window.dispatchEvent(new Event("refresh-nav-badges"))
    } catch (e: any) {
      setError(e?.message ?? "Could not add friend.")
    }
  }

  /* ── Add Friend Button ────────────────────────────────────────── */

  function AddButton({ person }: { person: UiPerson }) {
    const isPending = person.outgoingPending || outgoingPendingIds[person.id]

    if (isPending) {
      return (
        <button
          type="button"
          disabled
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-neutral-400 dark:text-white/30"
          aria-label="Request pending"
        >
          <Check className="h-4 w-4" />
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={() => addFriend(person.id)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black shadow-sm transition-all active:scale-95 hover:bg-neutral-800 dark:hover:bg-neutral-100"
        aria-label="Add friend"
      >
        <Plus className="h-4 w-4" />
      </button>
    )
  }



  /* ── Skeleton ─────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="container max-w-md mx-auto px-0 py-4 space-y-6">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Discover</h2>

        {/* Search skeleton */}
        <div className="flex items-center gap-3 rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl px-4 py-3">
          <Search className="h-4 w-4 text-neutral-400 dark:text-white/25" />
          <span className="text-sm text-neutral-300 dark:text-white/20">Search drinks, people, bars…</span>
        </div>

        {/* Suggested skeleton */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">People you may know</div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3.5 w-36 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                  <div className="h-3 w-24 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-28 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                </div>
                <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Trending skeleton */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">Trending this week</div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                    <div className="h-3 w-12 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drink of the day skeleton */}
        <div className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-5 flex flex-col items-center gap-3">
          <div className="h-3 w-24 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          <div className="h-5 w-36 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
          <div className="h-3 w-48 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          <div className="h-10 w-36 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse mt-1" />
        </div>

        {/* You might enjoy skeleton */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">You might enjoy</div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3.5 w-28 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                  <div className="h-3 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                  <div className="h-5 w-36 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                </div>
                <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Collections skeleton */}
        <div className="space-y-3 pb-24">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">Collections</div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-28 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                    <div className="h-3 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                  </div>
                  <div className="h-4 w-4 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── Whether search is active ─────────────────────────────────── */
  const isSearchActive = query.trim().length > 0

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div className="container max-w-md mx-auto px-0 py-4 pb-24">
      <h2 className="mb-6 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Discover</h2>

      {/* Toast */}
      {toastMsg && (
        <div className="mb-6 animate-in slide-in-from-top-4 fade-in duration-500 rounded-[2rem] border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/10 backdrop-blur-md px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {toastMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-[2rem] border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className={cn(
          "flex items-center gap-3 rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl px-4 py-3 transition-all duration-200",
          "focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10 focus-within:bg-white dark:focus-within:bg-white/[0.06]"
        )}>
          <Search className="h-4 w-4 text-neutral-400 dark:text-white/25" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drinks, people, bars…"
            className="w-full bg-transparent text-sm text-neutral-900 dark:text-white placeholder:text-neutral-300 dark:placeholder:text-white/20 outline-none"
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-neutral-400 dark:text-white/30" />}
        </div>
      </div>

      {/* Search Results (replaces rest of page when active) */}
      {isSearchActive ? (
        <div className="space-y-3">
          <SectionHeader label="Search results" />

          {searchResults.length === 0 && !searching ? (
            <div className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-5 text-center text-sm text-neutral-400 dark:text-white/40">
              No matches found.
            </div>
          ) : (
            searchResults.map((p) => (
              <PersonCard
                key={p.id}
                avatarUrl={p.avatarUrl}
                username={p.username}
                displayName={p.displayName}
                friendCount={p.friendCount}
                drinkCount={p.drinkCount}
                cheersCount={p.cheersCount}
                actions={!p.isFriend ? <AddButton person={p} /> : undefined}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Suggested People ─────────────────────────────── */}
          {suggested.length > 0 && (
            <div className="space-y-3">
              <SectionHeader icon={Users} label="People you may know" />

              {suggested.map((p) => (
                <PersonCard
                  key={p.id}
                  avatarUrl={p.avatarUrl}
                  username={p.username}
                  displayName={p.displayName}
                  friendCount={p.friendCount}
                  drinkCount={p.drinkCount}
                  subtitle={`${p.mutualCount} mutual friend${p.mutualCount === 1 ? "" : "s"}`}
                  actions={<AddButton person={p} />}
                />
              ))}
            </div>
          )}

          {/* ── Trending Drinks ──────────────────────────────── */}
          {trending.length > 0 && (
            <div className="space-y-3">
              <SectionHeader icon={Flame} label="Trending this week" />

              <div className="grid grid-cols-2 gap-3">
                {trending.map((drink, i) => (
                  <div
                    key={drink.id ?? `trending-${i}`}
                    className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-4 transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100/80 dark:bg-white/[0.06]">
                        {drink.imageUrl ? (
                          <Image src={drink.imageUrl} alt={drink.name} fill className="object-cover" unoptimized />
                        ) : (
                          <span className="text-lg">{DRINK_EMOJI[drink.category] ?? "🍹"}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-neutral-900 dark:text-white truncate">{drink.name}</div>
                        <div className="text-[13px] text-neutral-500 dark:text-white/40">{drink.count} logs</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Drink of the Day ─────────────────────────────── */}
          {drinkOfTheDay && (
            <div className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden relative">
              {drinkOfTheDay.imageUrl && (
                <div className="relative h-40 w-full bg-neutral-100 dark:bg-white/[0.04]">
                  <Image src={drinkOfTheDay.imageUrl} alt={drinkOfTheDay.name} fill className="object-cover" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-neutral-900 via-transparent to-transparent" />
                </div>
              )}

              <div className={cn("p-5 text-center relative", !drinkOfTheDay.imageUrl && "pt-6")}>
                {!drinkOfTheDay.imageUrl && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-5xl opacity-10">🏆</div>
                )}

                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400/60">
                  Drink of the day
                </div>
                <div className="text-xl font-bold text-neutral-900 dark:text-white mt-2">
                  {DRINK_EMOJI[drinkOfTheDay.category] ?? "🍸"} {drinkOfTheDay.name}
                </div>
                <div className="text-[13px] text-neutral-500 dark:text-white/40 mt-1 mb-4">{drinkOfTheDay.description}</div>

                <Link
                  href="/log"
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-500/20 bg-amber-50/80 dark:bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-400 transition-all active:scale-95 hover:bg-amber-100 dark:hover:bg-amber-500/15"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Log this drink
                </Link>
              </div>
            </div>
          )}

          {/* ── You Might Enjoy (Recommendations) ────────────── */}
          {recommendations.length > 0 && (
            <div className="space-y-3">
              <SectionHeader icon={Lightbulb} label="You might enjoy" />

              {recommendations.map((d) => (
                <RecommendationCard key={d.id} drink={d} />
              ))}
            </div>
          )}

          {/* ── Collections ──────────────────────────────────── */}
          {collections.length > 0 && (
            <div className="space-y-3">
              <SectionHeader icon={BookOpen} label="Collections" />

              <div className="space-y-2">
                {collections.map((c) => (
                  <CollectionCard key={c.id} collection={c} />
                ))}
              </div>
            </div>
          )}

          {/* ── Empty state if nothing to show ────────────────── */}
          {trending.length === 0 && suggested.length === 0 && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-neutral-300 dark:border-white/15 bg-white/50 dark:bg-white/[0.04]">
                <Sparkles className="h-8 w-8 text-neutral-400 dark:text-white/25" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Nothing to show yet</h3>
              <p className="mt-2 max-w-xs text-sm text-neutral-500 dark:text-white/45 leading-relaxed">
                Search for people above or start logging drinks to see trends and suggestions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}