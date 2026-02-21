"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowLeft, Calendar, X, Swords, Clock, Trophy, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// --- Types ---

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"

type Duel = {
  id: string
  challenger_id: string
  challenged_id: string
  category: "total_drinks" | "drink_types"
  duration: string
  status: "pending" | "active" | "completed" | "declined" | "cancelled"
  start_date: string | null
  end_date: string | null
  challenger_score: number
  challenged_score: number
  winner_id: string | null
  created_at: string
  // Joined profile data
  opponent: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  amChallenger: boolean
}

const timeRangeOptions: { key: TimeRange; label: string }[] = [
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
]

const CATEGORY_LABELS: Record<string, string> = {
  total_drinks: "Total Drinks",
  drink_types: "Drink Types",
}

const CATEGORY_ICONS: Record<string, string> = {
  total_drinks: "🍺",
  drink_types: "🎨",
}

// --- Helpers ---

function getTimeRangeLabel(value: TimeRange): string {
  return timeRangeOptions.find((opt) => opt.key === value)?.label ?? value
}

function timeLeft(endDate: string): string {
  const end = new Date(endDate)
  const now = new Date()
  const diff = end.getTime() - now.getTime()
  if (diff <= 0) return "Ended"
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  if (days > 0) return `${days}d ${remainingHours}h left`
  if (hours > 0) return `${hours}h left`
  const mins = Math.floor(diff / (1000 * 60))
  return `${mins}m left`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
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
    if (showMenu) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMenu])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"
      >
        <Calendar className="h-4 w-4" />
        {getTimeRangeLabel(value)}
      </button>
      {showMenu && (
        <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-xl border bg-background shadow-lg">
          {timeRangeOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => { onChange(opt.key); setShowMenu(false) }}
              className={cn(
                "w-full px-4 py-3 text-left text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-foreground/5",
                value === opt.key ? "font-semibold" : ""
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

function OpponentAvatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl: string | null; size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "h-9 w-9" : "h-11 w-11"
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5"

  if (avatarUrl) {
    return (
      <div className={cn("relative overflow-hidden rounded-full", sizeClasses)}>
        <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized />
      </div>
    )
  }
  return (
    <div className={cn("flex items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08]", sizeClasses)}>
      <svg viewBox="0 0 24 24" fill="none" className={cn("text-neutral-400 dark:text-white/30", iconSize)}>
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
      </svg>
    </div>
  )
}

// --- Duel Card ---

function DuelCard({
  duel,
  userId,
  onAccept,
  onDecline,
  accepting,
}: {
  duel: Duel
  userId: string
  onAccept?: (id: string) => void
  onDecline?: (id: string) => void
  accepting?: string | null
}) {
  const myScore = duel.amChallenger ? duel.challenger_score : duel.challenged_score
  const theirScore = duel.amChallenger ? duel.challenged_score : duel.challenger_score
  const isPending = duel.status === "pending"
  const isActive = duel.status === "active"
  const isCompleted = duel.status === "completed"
  const iWon = duel.winner_id === userId
  const needsResponse = isPending && !duel.amChallenger

  return (
    <div className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-md px-4 py-3.5">
      <div className="flex items-center gap-3">
        <OpponentAvatar name={duel.opponent.displayName} avatarUrl={duel.opponent.avatarUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-neutral-900 dark:text-white truncate">
              {duel.opponent.displayName}
            </span>
            <span className="text-[11px] text-neutral-400 dark:text-white/30">
              @{duel.opponent.username}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px]">{CATEGORY_ICONS[duel.category]}</span>
            <span className="text-[12px] text-neutral-500 dark:text-white/40 font-medium">
              {CATEGORY_LABELS[duel.category]}
            </span>
            <span className="text-[10px] text-neutral-300 dark:text-white/15">·</span>
            <span className="text-[12px] text-neutral-400 dark:text-white/30">{duel.duration}</span>
          </div>
        </div>

        {/* Status badge / scores */}
        {isActive && duel.end_date && (
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold tabular-nums" style={{ color: myScore >= theirScore ? "#3478F6" : "#a3a3a3" }}>
                {myScore}
              </span>
              <span className="text-[11px] text-neutral-300 dark:text-white/20">–</span>
              <span className="text-[15px] font-bold tabular-nums" style={{ color: theirScore >= myScore ? "#3478F6" : "#a3a3a3" }}>
                {theirScore}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 justify-end">
              <Clock className="h-3 w-3 text-neutral-400 dark:text-white/30" />
              <span className="text-[11px] text-neutral-400 dark:text-white/30">{timeLeft(duel.end_date)}</span>
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="shrink-0 flex items-center gap-1.5">
            {iWon ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400">
                <Trophy className="h-3 w-3" /> Won
              </span>
            ) : duel.winner_id ? (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-neutral-100 dark:bg-white/[0.06] text-neutral-500 dark:text-white/40">
                Lost
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-neutral-100 dark:bg-white/[0.06] text-neutral-500 dark:text-white/40">
                Tied
              </span>
            )}
          </div>
        )}

        {isPending && duel.amChallenger && (
          <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
            Pending
          </span>
        )}
      </div>

      {/* Accept / Decline for incoming requests */}
      {needsResponse && onAccept && onDecline && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-100 dark:border-white/[0.04]">
          <button
            type="button"
            onClick={() => onDecline(duel.id)}
            className="flex-1 rounded-xl py-2.5 text-[13px] font-medium border border-neutral-200 dark:border-white/[0.08] text-neutral-600 dark:text-white/50 hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onAccept(duel.id)}
            disabled={accepting === duel.id}
            className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: "#3478F6" }}
          >
            {accepting === duel.id ? "Accepting…" : "Accept"}
          </button>
        </div>
      )}
    </div>
  )
}

// --- My Duels Sheet ---

function MyDuelsSheet({
  open,
  onClose,
  duels,
  userId,
  loading,
  onAccept,
  onDecline,
  accepting,
}: {
  open: boolean
  onClose: () => void
  duels: Duel[]
  userId: string
  loading: boolean
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  accepting: string | null
}) {
  const backdropRef = React.useRef<HTMLDivElement>(null)

  const pendingIncoming = duels.filter((d) => d.status === "pending" && !d.amChallenger)
  const pendingOutgoing = duels.filter((d) => d.status === "pending" && d.amChallenger)
  const active = duels.filter((d) => d.status === "active")
  const completed = duels.filter((d) => d.status === "completed").slice(0, 10)

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 max-h-[80vh] rounded-[1.5rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white dark:bg-neutral-900 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-neutral-600 dark:text-white/60" />
            <h3 className="text-[17px] font-bold text-neutral-900 dark:text-white">My Duels</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-colors"
          >
            <X className="h-5 w-5 text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 pb-5 flex-1">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-white/[0.08]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-24 rounded bg-neutral-100 dark:bg-white/[0.06]" />
                      <div className="h-2.5 w-32 rounded bg-neutral-100 dark:bg-white/[0.06]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : duels.length === 0 ? (
            <div className="text-center py-12">
              <Swords className="h-10 w-10 text-neutral-200 dark:text-white/10 mx-auto mb-3" />
              <p className="text-sm text-neutral-400 dark:text-white/30">No duels yet</p>
              <p className="text-xs text-neutral-300 dark:text-white/20 mt-1">Challenge a friend from their versus page!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Pending incoming */}
              {pendingIncoming.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">
                    Incoming Challenges ({pendingIncoming.length})
                  </p>
                  <div className="space-y-2.5">
                    {pendingIncoming.map((duel) => (
                      <DuelCard
                        key={duel.id} duel={duel} userId={userId}
                        onAccept={onAccept} onDecline={onDecline} accepting={accepting}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Active */}
              {active.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">
                    Active ({active.length})
                  </p>
                  <div className="space-y-2.5">
                    {active.map((duel) => (
                      <DuelCard key={duel.id} duel={duel} userId={userId} />
                    ))}
                  </div>
                </div>
              )}

              {/* Pending outgoing */}
              {pendingOutgoing.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">
                    Sent ({pendingOutgoing.length})
                  </p>
                  <div className="space-y-2.5">
                    {pendingOutgoing.map((duel) => (
                      <DuelCard key={duel.id} duel={duel} userId={userId} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed */}
              {completed.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">
                    Completed
                  </p>
                  <div className="space-y-2.5">
                    {completed.map((duel) => (
                      <DuelCard key={duel.id} duel={duel} userId={userId} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Main Page ---

export default function MyVersusPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userId, setUserId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [duelsLoading, setDuelsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M")
  const [duelsOpen, setDuelsOpen] = React.useState(false)
  const [duels, setDuels] = React.useState<Duel[]>([])
  const [accepting, setAccepting] = React.useState<string | null>(null)

  // Stats for overview
  const [totalDuels, setTotalDuels] = React.useState(0)
  const [wins, setWins] = React.useState(0)
  const [activeDuels, setActiveDuels] = React.useState(0)
  const [pendingCount, setPendingCount] = React.useState(0)

  React.useEffect(() => {
    async function load() {
      setError(null)
      setLoading(true)

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!userRes.user) { router.replace("/login"); return }

        const currentUserId = userRes.user.id
        setUserId(currentUserId)

        await loadDuels(currentUserId)
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase])

  async function loadDuels(uid: string) {
    setDuelsLoading(true)
    try {
      // Fetch all duels where user is participant
      const { data: duelsData, error: duelsErr } = await supabase
        .from("duels")
        .select("*")
        .or(`challenger_id.eq.${uid},challenged_id.eq.${uid}`)
        .order("created_at", { ascending: false })

      if (duelsErr) throw duelsErr

      const rawDuels = duelsData ?? []

      // Gather opponent IDs
      const opponentIds = new Set<string>()
      rawDuels.forEach((d) => {
        const oppId = d.challenger_id === uid ? d.challenged_id : d.challenger_id
        opponentIds.add(oppId)
      })

      // Fetch opponent profiles
      const profileMap: Record<string, { id: string; username: string; displayName: string; avatarUrl: string | null }> = {}
      if (opponentIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_path")
          .in("id", Array.from(opponentIds))

        if (profiles) {
          for (const p of profiles) {
            let avatarUrl = null
            if (p.avatar_path) {
              const { data: urlData } = await supabase.storage
                .from("profile-photos")
                .createSignedUrl(p.avatar_path, 60 * 60)
              avatarUrl = urlData?.signedUrl ?? null
            }
            profileMap[p.id] = {
              id: p.id,
              username: p.username,
              displayName: p.display_name || p.username,
              avatarUrl,
            }
          }
        }
      }

      const mapped: Duel[] = rawDuels.map((d) => {
        const amChallenger = d.challenger_id === uid
        const oppId = amChallenger ? d.challenged_id : d.challenger_id
        return {
          ...d,
          opponent: profileMap[oppId] ?? { id: oppId, username: "unknown", displayName: "Unknown", avatarUrl: null },
          amChallenger,
        }
      })

      setDuels(mapped)
      setTotalDuels(mapped.filter((d) => d.status === "completed").length)
      setWins(mapped.filter((d) => d.status === "completed" && d.winner_id === uid).length)
      setActiveDuels(mapped.filter((d) => d.status === "active").length)
      setPendingCount(mapped.filter((d) => d.status === "pending" && !d.amChallenger).length)
    } catch (e) {
      console.error("Failed to load duels:", e)
    } finally {
      setDuelsLoading(false)
    }
  }

  async function handleAccept(duelId: string) {
    if (!userId) return
    setAccepting(duelId)
    try {
      const now = new Date()
      const duel = duels.find((d) => d.id === duelId)
      if (!duel) return

      let endDate: Date
      switch (duel.duration) {
        case "1D": endDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); break
        case "3D": endDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); break
        case "1W": endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); break
        default: endDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
      }

      const { error: err } = await supabase
        .from("duels")
        .update({ status: "active", start_date: now.toISOString(), end_date: endDate.toISOString() })
        .eq("id", duelId)

      if (err) throw err
      await loadDuels(userId)
    } catch (e) {
      console.error("Failed to accept duel:", e)
    } finally {
      setAccepting(null)
    }
  }

  async function handleDecline(duelId: string) {
    if (!userId) return
    try {
      await supabase.from("duels").update({ status: "declined" }).eq("id", duelId)
      await loadDuels(userId)
    } catch (e) {
      console.error("Failed to decline duel:", e)
    }
  }

  return (
    <div className="container max-w-2xl px-0 sm:px-4 py-1.5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm p-2 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-neutral-700 dark:text-white/70" />
          </button>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Versus</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* My Duels button */}
          <button
            type="button"
            onClick={() => setDuelsOpen(true)}
            className="relative inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            <Swords className="h-4 w-4" />
            My Duels
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "#3478F6" }}>
                {pendingCount}
              </span>
            )}
          </button>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Completed", value: totalDuels },
          { label: "Won", value: wins },
          { label: "Active", value: activeDuels },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-4 text-center"
          >
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stat.value}</p>
            <p className="text-[11px] text-neutral-400 dark:text-white/30 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Active duels inline */}
      {!loading && duels.filter((d) => d.status === "active").length > 0 && (
        <div className="mb-4">
          <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5 px-1">
            Active Duels
          </p>
          <div className="space-y-2.5">
            {duels.filter((d) => d.status === "active").map((duel) => (
              <DuelCard key={duel.id} duel={duel} userId={userId ?? ""} />
            ))}
          </div>
        </div>
      )}

      {/* Pending incoming inline */}
      {!loading && duels.filter((d) => d.status === "pending" && !d.amChallenger).length > 0 && (
        <div className="mb-4">
          <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5 px-1">
            Incoming Challenges
          </p>
          <div className="space-y-2.5">
            {duels.filter((d) => d.status === "pending" && !d.amChallenger).map((duel) => (
              <DuelCard
                key={duel.id} duel={duel} userId={userId ?? ""}
                onAccept={handleAccept} onDecline={handleDecline} accepting={accepting}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && duels.filter((d) => d.status === "active" || (d.status === "pending" && !d.amChallenger)).length === 0 && (
        <div className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 px-5 py-12 text-center">
          <Swords className="h-12 w-12 text-neutral-200 dark:text-white/10 mx-auto mb-3" />
          <p className="text-[15px] font-medium text-neutral-500 dark:text-white/40">No active duels</p>
          <p className="text-[13px] text-neutral-400 dark:text-white/25 mt-1">
            Visit a friend's profile and tap Versus to challenge them!
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-white/[0.08]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-24 rounded bg-neutral-100 dark:bg-white/[0.06]" />
                  <div className="h-2.5 w-32 rounded bg-neutral-100 dark:bg-white/[0.06]" />
                </div>
                <div className="h-8 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My Duels sheet */}
      <MyDuelsSheet
        open={duelsOpen}
        onClose={() => setDuelsOpen(false)}
        duels={duels}
        userId={userId ?? ""}
        loading={duelsLoading}
        onAccept={handleAccept}
        onDecline={handleDecline}
        accepting={accepting}
      />
    </div>
  )
}