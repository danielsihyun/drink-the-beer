"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Calendar, Trophy, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// --- Design Tokens ---

const GLASS_CARD = "rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
const GLASS_PILL = "rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm transition-all hover:bg-white dark:hover:bg-white/[0.1]"
const GLASS_DROPDOWN = "overflow-hidden rounded-xl border border-neutral-200/50 dark:border-white/[0.08] bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl shadow-xl ring-1 ring-black/5 dark:ring-white/[0.06]"

// --- Types ---

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"
type Scope = "friends" | "global"

type LeaderboardEntry = {
  user_id: string
  username: string
  display_name: string
  avatar_path: string | null
  drink_count: number
  rank: number
  is_viewer: boolean
  avatarUrl?: string | null
}

const timeRangeOptions: { key: TimeRange; label: string }[] = [
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
]

function getTimeRangeLabel(value: TimeRange): string {
  return timeRangeOptions.find((opt) => opt.key === value)?.label ?? value
}

function getStartDate(timeRange: TimeRange): Date {
  const now = new Date()
  let startDate: Date

  switch (timeRange) {
    case "1W":
      startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      break
    case "1M":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      break
    case "3M":
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      break
    case "6M":
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      break
    case "1Y":
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      break
    case "YTD":
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  }
  startDate.setHours(0, 0, 0, 0)
  return startDate
}

// --- Components ---

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange
  onChange: (value: TimeRange) => void
}) {
  const [showMenu, setShowMenu] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showMenu])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className={cn(GLASS_PILL, "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-white/70")}
      >
        <Calendar className="h-4 w-4" />
        {getTimeRangeLabel(value)}
      </button>

      {showMenu && (
        <div className={cn("absolute right-0 top-full z-10 mt-2 w-44", GLASS_DROPDOWN)}>
          {timeRangeOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                onChange(opt.key)
                setShowMenu(false)
              }}
              className={cn(
                "w-full px-4 py-3 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/[0.08]",
                value === opt.key
                  ? "font-semibold text-neutral-900 dark:text-white bg-black/5 dark:bg-white/[0.06]"
                  : "text-neutral-600 dark:text-white/60"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ScopeToggle({
  value,
  onChange,
}: {
  value: Scope
  onChange: (value: Scope) => void
}) {
  return (
    <div className="flex rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] backdrop-blur-sm p-0.5">
      {(["friends", "global"] as Scope[]).map((scope) => (
        <button
          key={scope}
          type="button"
          onClick={() => onChange(scope)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
            value === scope
              ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
              : "text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70"
          )}
        >
          {scope === "friends" ? "Friends" : "Global"}
        </button>
      ))}
    </div>
  )
}

function PodiumAvatar({
  entry,
  size,
}: {
  entry: LeaderboardEntry
  size: "lg" | "md"
}) {
  const dim = size === "lg" ? "h-20 w-20" : "h-16 w-16"
  const iconDim = size === "lg" ? "h-10 w-10" : "h-8 w-8"

  return (
    <Link href={`/profile/${entry.username}`}>
      {entry.avatarUrl ? (
        <div className={cn("relative shrink-0 overflow-hidden rounded-full ring-2 shadow-sm border border-neutral-100 dark:border-white/[0.06]", dim,
          entry.rank === 1 ? "ring-amber-400" : entry.rank === 2 ? "ring-neutral-300 dark:ring-neutral-400" : "ring-amber-600"
        )}>
          <Image
            src={entry.avatarUrl}
            alt={entry.username}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-2 shadow-sm", dim,
          entry.rank === 1 ? "ring-amber-400" : entry.rank === 2 ? "ring-neutral-300 dark:ring-neutral-400" : "ring-amber-600"
        )}>
          <svg viewBox="0 0 24 24" fill="none" className={cn(iconDim, "text-neutral-400 dark:text-white/30")}>
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
          </svg>
        </div>
      )}
    </Link>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-amber-900 shadow-sm">
        1
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-600 text-xs font-bold text-neutral-700 dark:text-neutral-200 shadow-sm">
        2
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-amber-100 shadow-sm">
        3
      </div>
    )
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center text-sm font-semibold text-neutral-400 dark:text-white/30">
      {rank}
    </div>
  )
}

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const first = entries.find((e) => e.rank === 1)
  const second = entries.find((e) => e.rank === 2)
  const third = entries.find((e) => e.rank === 3)

  if (!first) return null

  return (
    <div className="flex items-end justify-center gap-3">
      {/* 2nd Place */}
      <div className="flex flex-col items-center flex-1">
        {second ? (
          <>
            <PodiumAvatar entry={second} size="md" />
            <div className="mt-2 text-center w-full px-1">
              <p className="text-[13px] font-semibold text-neutral-900 dark:text-white truncate">
                {second.display_name}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-white/40 truncate">
                @{second.username}
              </p>
            </div>
            <div className="mt-2 w-full">
              <div className="flex h-24 w-full items-start justify-center rounded-t-xl bg-neutral-200/60 dark:bg-white/[0.06]">
                <div className="pt-4 text-center">
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">{second.drink_count}</p>
                  <p className="text-[10px] text-neutral-500 dark:text-white/40">drinks</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="h-24" />
        )}
      </div>

      {/* 1st Place */}
      <div className="flex flex-col items-center flex-1">
        <div className="relative">
          <Trophy className="absolute -top-9 left-1/2 -translate-x-1/2 h-6 w-6 text-amber-400" />
          <PodiumAvatar entry={first} size="lg" />
        </div>
        <div className="mt-2 text-center w-full px-1">
          <p className="text-[15px] font-bold text-neutral-900 dark:text-white truncate">
            {first.display_name}
          </p>
          <p className="text-[12px] text-neutral-500 dark:text-white/40 truncate">
            @{first.username}
          </p>
        </div>
        <div className="mt-2 w-full">
          <div className="flex h-32 w-full items-start justify-center rounded-t-xl bg-amber-400/20 dark:bg-amber-400/10">
            <div className="pt-4 text-center">
              <p className="text-xl font-bold text-neutral-900 dark:text-white">{first.drink_count}</p>
              <p className="text-[10px] text-neutral-500 dark:text-white/40">drinks</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3rd Place */}
      <div className="flex flex-col items-center flex-1">
        {third ? (
          <>
            <PodiumAvatar entry={third} size="md" />
            <div className="mt-2 text-center w-full px-1">
              <p className="text-[13px] font-semibold text-neutral-900 dark:text-white truncate">
                {third.display_name}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-white/40 truncate">
                @{third.username}
              </p>
            </div>
            <div className="mt-2 w-full">
              <div className="flex h-20 w-full items-start justify-center rounded-t-xl bg-amber-600/15 dark:bg-amber-600/10">
                <div className="pt-4 text-center">
                  <p className="text-lg font-bold text-neutral-900 dark:text-white">{third.drink_count}</p>
                  <p className="text-[10px] text-neutral-500 dark:text-white/40">drinks</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="h-20" />
        )}
      </div>
    </div>
  )
}

function LeaderboardRow({
  entry,
  isViewer,
  isPinned,
}: {
  entry: LeaderboardEntry
  isViewer: boolean
  isPinned?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors",
        isViewer
          ? "bg-amber-50/40 dark:bg-amber-500/[0.04] border border-amber-200/30 dark:border-amber-500/[0.08]"
          : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
        isPinned && "border-t border-neutral-200/60 dark:border-white/[0.08]"
      )}
    >
      <RankBadge rank={entry.rank} />

      <Link href={`/profile/${entry.username}`} className="flex items-center gap-3 flex-1 min-w-0">
        {entry.avatarUrl ? (
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
            <Image
              src={entry.avatarUrl}
              alt={entry.username}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-1 ring-black/5 dark:ring-white/10">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-neutral-400 dark:text-white/30">
              <circle cx="12" cy="8" r="4" fill="currentColor" />
              <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight truncate">
            {entry.display_name}
            {isViewer && <span className="ml-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">(You)</span>}
          </p>
          <p className="text-[13px] text-neutral-500 dark:text-white/40 font-medium truncate">@{entry.username}</p>
        </div>
      </Link>

      <div className="shrink-0 text-right">
        <p className="text-lg font-bold text-neutral-900 dark:text-white">{entry.drink_count}</p>
        <p className="text-[11px] text-neutral-500 dark:text-white/40">drinks</p>
      </div>
    </div>
  )
}

// --- Main Page ---

export default function LeaderboardPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([])
  const [viewerId, setViewerId] = React.useState<string | null>(null)
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M")
  const [scope, setScope] = React.useState<Scope>("friends")

  const fetchLeaderboard = React.useCallback(async (tr: TimeRange, sc: Scope) => {
    setError(null)
    setLoading(true)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      if (!userRes.user) {
        router.replace("/login?redirectTo=%2Fleaderboard")
        return
      }

      const userId = userRes.user.id
      setViewerId(userId)

      const startDate = getStartDate(tr)

      const { data, error: rpcErr } = await supabase.rpc("get_leaderboard", {
        p_viewer_id: userId,
        p_scope: sc,
        p_start_date: startDate.toISOString(),
        p_limit: 50,
      })

      if (rpcErr) throw rpcErr

      const rows = (data ?? []) as LeaderboardEntry[]

      // Resolve avatar URLs
      const avatarUrls = await Promise.all(
        rows.map((r) =>
          r.avatar_path
            ? supabase.storage
                .from("profile-photos")
                .createSignedUrl(r.avatar_path, 60 * 60)
                .then((res) => res.data?.signedUrl ?? null)
            : Promise.resolve(null)
        )
      )

      const enriched = rows.map((r, i) => ({
        ...r,
        avatarUrl: avatarUrls[i],
      }))

      setEntries(enriched)
    } catch (e: any) {
      setError(e?.message ?? "Could not load leaderboard.")
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  React.useEffect(() => {
    fetchLeaderboard(timeRange, scope)
  }, [timeRange, scope, fetchLeaderboard])

  // Split entries into podium (top 3), rest (4+), and pinned viewer
  const podiumEntries = entries.filter((e) => e.rank <= 3)
  const restEntries = entries.filter((e) => e.rank > 3 && !e.is_viewer)
  const viewerEntry = entries.find((e) => e.is_viewer)
  const viewerInTop3 = viewerEntry ? viewerEntry.rank <= 3 : false
  const viewerInRest = viewerEntry ? viewerEntry.rank > 3 : false
  const pinnedViewer = viewerEntry && !viewerInTop3 && !viewerInRest ? viewerEntry : null

  // If viewer is rank 4+, include them in the rest list at their position
  const fullRestEntries = React.useMemo(() => {
    if (!viewerEntry || viewerInTop3) return restEntries
    // Viewer is 4+ — merge them into the list
    const combined = [...restEntries]
    if (viewerInRest) {
      // Viewer is already excluded from restEntries, add them back
    }
    // Actually rebuild from entries rank > 3
    return entries.filter((e) => e.rank > 3)
  }, [entries, viewerEntry, viewerInTop3, viewerInRest, restEntries])

  // --- Skeleton ---
  if (loading) {
    return (
      <div className="container max-w-md mx-auto px-0 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Leaderboard</h2>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        <div className="flex justify-center">
          <ScopeToggle value={scope} onChange={setScope} />
        </div>

        {/* Combined skeleton */}
        <div className={cn(GLASS_CARD, "overflow-hidden")}>
          <div className="px-6 pt-6">
            <div className="flex items-end justify-center gap-3">
              {[20, 28, 16].map((h, i) => (
                <div key={i} className="flex flex-col items-center flex-1 gap-2">
                  <div className={cn("rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse", i === 1 ? "h-20 w-20" : "h-16 w-16")} />
                  <div className="h-3 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                  <div className={cn("w-full rounded-t-xl bg-neutral-100 dark:bg-white/[0.06] animate-pulse")} style={{ height: `${h * 4}px` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="mx-5 border-t border-neutral-200/40 dark:border-white/[0.06]" />
          <div className="p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-7 w-7 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-28 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                  <div className="h-3 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                </div>
                <div className="h-5 w-8 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="pb-24" />
      </div>
    )
  }

  return (
    <div className="container max-w-md mx-auto px-0 py-4 pb-24">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Leaderboard</h2>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Scope Toggle */}
      <div className="mb-5 flex justify-center">
        <ScopeToggle value={scope} onChange={setScope} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-[2rem] border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!error && entries.length === 0 && (
        <div className="mt-12 flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-neutral-300 dark:border-white/15 bg-white/50 dark:bg-white/[0.04] text-neutral-400 dark:text-white/25">
            <Trophy className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">No activity yet</h3>
          <p className="mt-2 max-w-xs text-sm text-neutral-500 dark:text-white/45 leading-relaxed">
            {scope === "friends"
              ? "Add some friends and start logging drinks to see the leaderboard."
              : "No drinks logged in this time period."}
          </p>
        </div>
      )}

      {/* Combined Leaderboard Card */}
      {entries.length > 0 && (
        <div className={cn(GLASS_CARD, "overflow-hidden")}>
          {/* Podium */}
          {podiumEntries.length > 0 && (
            <div className="px-6 pt-12">
              <Podium entries={podiumEntries} />
            </div>
          )}

          {/* Divider between podium and list */}
          {fullRestEntries.length > 0 && podiumEntries.length > 0 && (
            <div className="mx-5 border-t border-neutral-200/40 dark:border-white/[0.06]" />
          )}

          {/* Scrollable List (4th place onwards) */}
          {fullRestEntries.length > 0 && (
            <div className="p-2">
              {fullRestEntries.map((entry) => (
                <LeaderboardRow
                  key={entry.user_id}
                  entry={entry}
                  isViewer={entry.is_viewer}
                />
              ))}
            </div>
          )}

          {/* Pinned viewer row (when they're beyond the loaded results) */}
          {pinnedViewer && (
            <div className="p-2 pt-0">
              <div className="mx-4 my-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-dashed border-neutral-200 dark:border-white/[0.08]" />
                  <span className="text-[10px] font-medium text-neutral-400 dark:text-white/25 uppercase tracking-wider">Your rank</span>
                  <div className="flex-1 border-t border-dashed border-neutral-200 dark:border-white/[0.08]" />
                </div>
              </div>
              <LeaderboardRow
                entry={pinnedViewer}
                isViewer
                isPinned
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}