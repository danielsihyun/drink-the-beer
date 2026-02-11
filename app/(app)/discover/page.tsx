"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Search, Plus, Check, TrendingUp, Users, Sparkles } from "lucide-react"
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
  outgoingPending?: boolean
}

type TrendingDrink = {
  drinkType: string
  count: number
  percentChange: number | null
}

type SuggestedPerson = UiPerson & { mutualCount: number }

/* ── PersonCard ────────────────────────────────────────────────── */

function PersonCard({
  avatarUrl,
  username,
  displayName,
  friendCount,
  drinkCount,
  subtitle,
  actions,
}: {
  avatarUrl: string | null
  username: string
  displayName: string
  friendCount: number
  drinkCount: number
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
              </div>
            )}
          </div>
        </Link>

        {actions && <div className="shrink-0 flex items-center gap-1.5">{actions}</div>}
      </div>
    </article>
  )
}

/* ── Drink type icon helper ────────────────────────────────────── */

const DRINK_EMOJI: Record<string, string> = {
  Beer: "🍺",
  Wine: "🍷",
  Cocktail: "🍸",
  Shot: "🥃",
  Seltzer: "🥤",
  Spirit: "🥃",
  Other: "🍹",
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

        // Load trending & suggested in parallel
        await Promise.all([
          loadTrending(userId),
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

  /* ── Trending drinks (last 7 days vs prior 7 days) ────────────── */

  async function loadTrending(userId: string) {
    try {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      // All drink logs from last 14 days (global/community)
      const { data: recentLogs } = await supabase
        .from("drink_logs")
        .select("drink_type, created_at")
        .gte("created_at", twoWeeksAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000)

      const thisWeek: Record<string, number> = {}
      const lastWeek: Record<string, number> = {}

      for (const log of recentLogs ?? []) {
        const logDate = new Date(log.created_at)
        if (logDate >= weekAgo) {
          thisWeek[log.drink_type] = (thisWeek[log.drink_type] || 0) + 1
        } else {
          lastWeek[log.drink_type] = (lastWeek[log.drink_type] || 0) + 1
        }
      }

      const allTypes = new Set([...Object.keys(thisWeek), ...Object.keys(lastWeek)])
      const trendingList: TrendingDrink[] = []

      for (const type of allTypes) {
        const current = thisWeek[type] || 0
        const previous = lastWeek[type] || 0
        const percentChange = previous > 0
          ? Math.round(((current - previous) / previous) * 100)
          : current > 0 ? 100 : null

        if (current > 0) {
          trendingList.push({ drinkType: type, count: current, percentChange })
        }
      }

      trendingList.sort((a, b) => b.count - a.count)
      setTrending(trendingList.slice(0, 5))
    } catch (e) {
      console.error("Failed to load trending:", e)
    }
  }

  /* ── Suggested people (friends of friends) ────────────────────── */

  async function loadSuggested(userId: string, myFriendIds: Set<string>) {
    try {
      if (myFriendIds.size === 0) {
        setSuggested([])
        return
      }

      const friendIdArray = Array.from(myFriendIds)

      // Get friendships of my friends
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

      // Count mutual friends for each potential suggestion
      const mutualCounts: Record<string, number> = {}

      for (const row of fofRows ?? []) {
        const personA = row.requester_id
        const personB = row.addressee_id

        // For each friendship, figure out which side is my friend and which is the FoF
        if (myFriendIds.has(personA) && personB !== userId && !myFriendIds.has(personB)) {
          mutualCounts[personB] = (mutualCounts[personB] || 0) + 1
        }
        if (myFriendIds.has(personB) && personA !== userId && !myFriendIds.has(personA)) {
          mutualCounts[personA] = (mutualCounts[personA] || 0) + 1
        }
      }

      // Sort by mutual count, take top 10
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

      // Check for existing outgoing pending requests
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
        mutualCount: mutualMap.get(p.id) ?? 0,
        outgoingPending: pendingOutIds.has(p.id),
      }))

      // Sort by mutual count descending
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
        const filtered = base.filter((p) => p.id !== meId && !friendIds.has(p.id))

        const avatarUrls = await Promise.all(
          filtered.map((p) =>
            p.avatar_path
              ? supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60).then(r => r.data?.signedUrl ?? null)
              : Promise.resolve(null)
          )
        )

        const mapped: UiPerson[] = filtered.map((p, i) => ({
          id: p.id,
          username: p.username,
          displayName: p.display_name,
          avatarUrl: avatarUrls[i],
          friendCount: p.friend_count ?? 0,
          drinkCount: p.drink_count ?? 0,
          outgoingPending: !!p.outgoing_pending || !!outgoingPendingIds[p.id],
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
        setSearchResults((prev) => prev.filter((p) => p.id !== friendId))
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
          <span className="text-sm text-neutral-300 dark:text-white/20">Search people by username or name…</span>
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

        {/* Suggested skeleton */}
        <div className="space-y-3 pb-24">
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
            placeholder="Search people by username or name…"
            className="w-full bg-transparent text-sm text-neutral-900 dark:text-white placeholder:text-neutral-300 dark:placeholder:text-white/20 outline-none"
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-neutral-400 dark:text-white/30" />}
        </div>
      </div>

      {/* Search Results (replaces rest of page when active) */}
      {isSearchActive ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">Search results</div>

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
                actions={<AddButton person={p} />}
              />
            ))
          )}
        </div>
      ) : (
        <>
          {/* ── Trending Drinks ────────────────────────────────── */}
          {trending.length > 0 && (
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-neutral-400 dark:text-white/30" />
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">Trending this week</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {trending.map((drink, i) => (
                  <div
                    key={drink.drinkType}
                    className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-4 transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100/80 dark:bg-white/[0.06] text-lg">
                        {DRINK_EMOJI[drink.drinkType] ?? "🍹"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-neutral-900 dark:text-white truncate">{drink.drinkType}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] text-neutral-500 dark:text-white/40">{drink.count} logs</span>
                          {drink.percentChange !== null && drink.percentChange !== 0 && (
                            <span className={cn(
                              "text-[11px] font-semibold",
                              drink.percentChange > 0
                                ? "text-emerald-500 dark:text-emerald-400"
                                : "text-red-400 dark:text-red-400"
                            )}>
                              {drink.percentChange > 0 ? "+" : ""}{drink.percentChange}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Suggested People ───────────────────────────────── */}
          {suggested.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-neutral-400 dark:text-white/30" />
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">People you may know</div>
              </div>

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
        </>
      )}
    </div>
  )
}