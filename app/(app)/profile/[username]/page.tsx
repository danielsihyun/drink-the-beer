"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowUpDown, Lock, Clock, UserPlus, Loader2, Medal, BarChart3, X } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { ProfileShowcase, MedalDetailModal } from "@/components/showcase-medals"

// --- Types ---

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"
type Granularity = "Drink" | "Day" | "Month" | "Year"
type Difficulty = "bronze" | "silver" | "gold" | "diamond"

type Achievement = {
  id: string
  category: string
  name: string
  description: string
  requirement_type: string
  requirement_value: string
  difficulty: Difficulty
  icon: string
}

type UserAchievement = {
  achievement_id: string
  unlocked_at: string
}

type DrinkLogRow = {
  id: string
  user_id: string
  photo_path: string
  drink_type: DrinkType
  caption: string | null
  created_at: string
}

type ProfileRow = {
  id: string
  username: string
  display_name: string
  avatar_path: string | null
  friend_count: number | null
  drink_count: number | null
  showcase_achievements: string[] | null
}

type ProfileMetaRow = {
  created_at: string | null
}

type UiProfile = {
  id: string
  username: string
  displayName: string
  joinDate: string
  friendCount: number
  drinkCount: number
  avatarUrl: string | null
  showcaseAchievements: string[]
}

type FriendshipStatus = "none" | "friends" | "pending_outgoing" | "pending_incoming"

interface DrinkLog {
  id: string
  visibleUsername?: string
  userId: string
  photoPath: string
  createdAt: string
  timestampLabel: string
  photoUrl: string
  drinkType: DrinkType
  caption?: string
  cheersCount: number
  cheeredByMe: boolean
}

interface CheersUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

interface GroupedDrinks {
  label: string
  drinks: DrinkLog[]
  count: number
}

// --- Helpers ---

function formatCardTimestamp(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  const month = d.toLocaleString("en-US", { month: "short" })
  const day = d.getDate()
  const year2 = String(d.getFullYear()).slice(-2)

  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  if (hours === 0) hours = 12

  return `${month} ${day}, ${year2}' at ${hours}:${minutes}${ampm}`
}

function formatJoinDate(isoOrNull: string | null) {
  if (!isoOrNull) return "—"
  const d = new Date(isoOrNull)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d)
}

function formatGroupLabel(iso: string, granularity: Exclude<Granularity, "Drink">) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  if (granularity === "Day") {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(d)
  }

  if (granularity === "Month") {
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d)
  }

  return new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(d)
}

// --- Icons ---

function CheersIcon({ filled = false, className }: { filled?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 -4 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <g transform={filled ? "rotate(15, 8, 16)" : "translate(2,0)"}>
        {filled && (
          <path
            d="M5 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2L5 9z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        <path
          d="M4 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3L4 6z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M8 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M5 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      <g transform={filled ? "rotate(-15, 24, 16)" : "translate(-2,0)"}>
        {filled && (
          <path
            d="M21 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2l-.8-4z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        <path
          d="M20 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3l-1-7z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M24 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M21 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      {filled && (
        <g stroke="#fbbf24">
          <path d="M16 -0.5v3" strokeWidth="1.5" />
          <g transform="translate(16, 0) scale(-1, 1) translate(-16, 0)">
            <path d="M19 3l2-2" strokeWidth="1.5" />
          </g>
          <path d="M19 3l2-2" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  )
}

// --- Shared Components ---

function CheersListModal({
  drinkLogId,
  cheersCount,
  onClose,
}: {
  drinkLogId: string
  cheersCount: number
  onClose: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [users, setUsers] = React.useState<CheersUser[]>([])
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  React.useEffect(() => {
    async function fetchCheers() {
      setLoading(true)
      setError(null)
      
      try {
        const { data: cheersData, error: cheersErr } = await supabase
          .from("drink_cheers")
          .select("user_id, created_at")
          .eq("drink_log_id", drinkLogId)
          .order("created_at", { ascending: false })

        if (cheersErr) throw cheersErr

        if (!cheersData || cheersData.length === 0) {
          setUsers([])
          setLoading(false)
          return
        }

        const userIds = [...new Set(cheersData.map((c) => c.user_id))]

        const { data: profilesData, error: profilesErr } = await supabase
          .from("profile_public_stats")
          .select("id, username, display_name, avatar_path")
          .in("id", userIds)

        if (profilesErr) throw profilesErr

        const profilesMap = new Map(
          (profilesData ?? []).map((p: any) => [p.id, p])
        )

        const avatarPaths = cheersData.map((cheer: any) => {
          const profile = profilesMap.get(cheer.user_id)
          return profile?.avatar_path ?? null
        })

        const avatarUrls = await Promise.all(
          avatarPaths.map((path: string | null) =>
            path
              ? supabase.storage.from("profile-photos").createSignedUrl(path, 60 * 60).then(r => r.data?.signedUrl ?? null)
              : Promise.resolve(null)
          )
        )

        const cheersUsers: CheersUser[] = cheersData.map((cheer: any, i: number) => {
          const profile = profilesMap.get(cheer.user_id)
          return {
            id: profile?.id ?? cheer.user_id,
            username: profile?.username ?? "Unknown",
            displayName: profile?.display_name ?? profile?.username ?? "Unknown",
            avatarUrl: avatarUrls[i],
          }
        })

        setUsers(cheersUsers)
      } catch (e: any) {
        setError(e?.message ?? "Failed to load cheers")
      } finally {
        setLoading(false)
      }
    }

    fetchCheers()
  }, [drinkLogId, supabase])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-[360px] overflow-hidden rounded-3xl border border-white/20 dark:border-white/[0.08] bg-white/90 dark:bg-neutral-900/90 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-10 duration-300">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/[0.06] px-5 py-4">
          <div className="text-base font-semibold text-neutral-900 dark:text-white">
            Cheers {cheersCount > 0 && `(${cheersCount})`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/5 dark:bg-white/10 p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-neutral-500 dark:text-white/60" />
          </button>
        </div>

        <div className="max-h-[280px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400 dark:text-white/40" />
            </div>
          ) : error ? (
            <div className="px-5 py-6 text-center text-sm text-red-400">
              {error}
            </div>
          ) : users.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-neutral-400 dark:text-white/40">
              No cheers yet
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/[0.06]">
              {users.map((user) => (
                <Link
                  key={user.id}
                  href={`/profile/${user.username}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  onClick={onClose}
                >
                  {user.avatarUrl ? (
                    <div className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
                      <Image
                        src={user.avatarUrl}
                        alt={user.username}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-1 ring-black/5 dark:ring-white/10">
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-neutral-400 dark:text-white/30">
                        <circle cx="12" cy="8" r="4" fill="currentColor" />
                        <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{user.displayName}</p>
                    <p className="text-xs text-neutral-500 dark:text-white/40 truncate">@{user.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Loading / Empty / Locked States ---

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Profile card skeleton */}
      <div className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-5">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-32 rounded bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            <div className="h-3 w-24 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="flex gap-4">
              <div className="h-3 w-20 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-20 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Card skeletons */}
      <div className="space-y-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="h-3 w-20 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              </div>
            </div>
            <div className="mt-4 aspect-square w-full rounded-2xl bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">No logs yet</h3>
      <p className="max-w-sm text-sm text-neutral-500 dark:text-white/50">This user hasn't logged any drinks.</p>
    </div>
  )
}

function LockedState({
  username,
  friendshipStatus,
  onSendRequest,
  requestBusy,
}: {
  username: string
  friendshipStatus: FriendshipStatus
  onSendRequest: () => void
  requestBusy: boolean
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 dark:border-white/15 bg-white/50 dark:bg-white/[0.04]">
        <Lock className="h-8 w-8 text-neutral-400 dark:text-white/25" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">This account is private</h3>
      <p className="max-w-sm text-sm text-neutral-500 dark:text-white/50">
        Send {username} a friend request to see their drinks.
      </p>

      {friendshipStatus === "none" && (
        <button
          type="button"
          onClick={onSendRequest}
          disabled={requestBusy}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-black dark:bg-white px-5 py-2.5 text-sm font-medium text-white dark:text-black shadow-sm transition-all hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-95 disabled:opacity-60"
        >
          {requestBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Add Friend
        </button>
      )}
    </div>
  )
}

function PendingRequestState({ username }: { username: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 dark:border-white/15 bg-white/50 dark:bg-white/[0.04]">
        <Clock className="h-8 w-8 text-neutral-400 dark:text-white/25" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">Friend request sent</h3>
      <p className="max-w-sm text-sm text-neutral-500 dark:text-white/50">
        Waiting for {username} to accept your request.
      </p>
    </div>
  )
}

// --- Card Components ---

function DrinkLogCard({
  log,
  profile,
  onToggleCheers,
  onShowCheersList,
  cheersBusy,
  cheersAnimating,
}: {
  log: DrinkLog
  profile: UiProfile
  onToggleCheers: (log: DrinkLog) => void
  onShowCheersList: (log: DrinkLog) => void
  cheersBusy: boolean
  cheersAnimating: boolean
}) {
  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          {profile.avatarUrl ? (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white dark:ring-neutral-800 shadow-sm border border-neutral-100 dark:border-white/[0.06]">
              <Image src={profile.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-2 ring-white dark:ring-neutral-800 shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-neutral-400 dark:text-white/30">
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
              </svg>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight">{profile.username}</span>
            <span className="text-[13px] text-neutral-500 dark:text-white/40 font-medium">{log.timestampLabel}</span>
          </div>
        </div>

        <span className="mt-1.5 inline-flex items-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1 text-xs font-medium text-neutral-500 dark:text-white/50">
          {log.drinkType}
        </span>
      </div>

      {/* Photo — full bleed */}
      <div>
        <div className="relative aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-white/[0.04]">
          <Image
            src={log.photoUrl || "/placeholder.svg"}
            alt={`${log.drinkType} drink`}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      </div>

      {/* Actions & Caption */}
      <div className="flex flex-col gap-2 px-5 pt-4 pb-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleCheers(log)}
            disabled={cheersBusy}
            className={cn(
              "relative flex items-center justify-center transition-all duration-300 active:scale-90",
              cheersAnimating ? "scale-125" : "hover:scale-105"
            )}
          >
            {cheersAnimating && (
              <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/20" />
            )}
            <CheersIcon filled={log.cheeredByMe} className={cn("h-8 w-8", log.cheeredByMe ? "text-amber-500" : "text-neutral-800 dark:text-white/50")} />
          </button>

          {log.cheersCount > 0 && (
            <button
              type="button"
              onClick={() => onShowCheersList(log)}
              className="text-[15px] font-semibold text-neutral-900 dark:text-white hover:text-neutral-600 dark:hover:text-white/70 transition-colors"
            >
              {log.cheersCount} <span className="font-normal text-neutral-500 dark:text-white/40">cheers</span>
            </button>
          )}
        </div>

        {log.caption && (
          <div className="pl-1">
            <p className="text-[15px] leading-relaxed text-neutral-800 dark:text-white/75">{log.caption}</p>
          </div>
        )}
      </div>
    </article>
  )
}

function GroupedDrinkCard({ 
  group, 
  profile,
  onToggleCheers,
  onShowCheersList,
  cheersBusy,
  cheersAnimating,
}: { 
  group: GroupedDrinks
  profile: UiProfile
  onToggleCheers: (log: DrinkLog) => void
  onShowCheersList: (log: DrinkLog) => void
  cheersBusy: Record<string, boolean>
  cheersAnimating: Record<string, boolean>
}) {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  const currentDrink = group.drinks[currentIndex]

  const handleScroll = React.useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    
    const scrollLeft = container.scrollLeft
    const itemWidth = container.offsetWidth
    const newIndex = Math.round(scrollLeft / itemWidth)
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < group.drinks.length) {
      setCurrentIndex(newIndex)
    }
  }, [currentIndex, group.drinks.length])

  const scrollToIndex = (index: number) => {
    const container = scrollContainerRef.current
    if (!container) return
    
    const itemWidth = container.offsetWidth
    container.scrollTo({
      left: itemWidth * index,
      behavior: 'smooth'
    })
  }

  if (!currentDrink) return null

  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          {profile.avatarUrl ? (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white dark:ring-neutral-800 shadow-sm border border-neutral-100 dark:border-white/[0.06]">
              <Image src={profile.avatarUrl || "/placeholder.svg"} alt="Profile" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-2 ring-white dark:ring-neutral-800 shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-neutral-400 dark:text-white/30">
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
              </svg>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight">{profile.username}</span>
            <span className="text-[13px] text-neutral-500 dark:text-white/40 font-medium">{currentDrink.timestampLabel}</span>
          </div>
        </div>

        <span className="mt-1.5 inline-flex items-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1 text-xs font-medium text-neutral-500 dark:text-white/50">
          {currentDrink.drinkType}
        </span>
      </div>

      {/* Photo carousel — full bleed */}
      <div className="relative">
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {group.drinks.map((drink) => (
            <div 
              key={drink.id}
              className="relative aspect-square w-full flex-shrink-0 snap-start snap-always bg-neutral-100 dark:bg-white/[0.04]"
            >
              <Image
                src={drink.photoUrl || "/placeholder.svg"}
                alt={`${drink.drinkType} drink`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>

        {group.drinks.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {group.drinks.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  scrollToIndex(index)
                }}
                className={cn(
                  "h-2 rounded-full transition-all duration-200",
                  index === currentIndex
                    ? "bg-white w-4"
                    : "bg-white/50 hover:bg-white/70 w-2"
                )}
                aria-label={`Go to drink ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions & Caption */}
      <div className="flex flex-col gap-2 px-5 pt-4 pb-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleCheers(currentDrink)}
            disabled={cheersBusy[currentDrink.id]}
            className={cn(
              "relative flex items-center justify-center transition-all duration-300 active:scale-90",
              cheersAnimating[currentDrink.id] ? "scale-125" : "hover:scale-105"
            )}
          >
            {cheersAnimating[currentDrink.id] && (
              <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/20" />
            )}
            <CheersIcon filled={currentDrink.cheeredByMe} className={cn("h-8 w-8", currentDrink.cheeredByMe ? "text-amber-500" : "text-neutral-800 dark:text-white/50")} />
          </button>

          {currentDrink.cheersCount > 0 && (
            <button
              type="button"
              onClick={() => onShowCheersList(currentDrink)}
              className="text-[15px] font-semibold text-neutral-900 dark:text-white hover:text-neutral-600 dark:hover:text-white/70 transition-colors"
            >
              {currentDrink.cheersCount} <span className="font-normal text-neutral-500 dark:text-white/40">cheers</span>
            </button>
          )}
        </div>

        {currentDrink.caption && (
          <div className="pl-1">
            <p className="text-[15px] leading-relaxed text-neutral-800 dark:text-white/75">{currentDrink.caption}</p>
          </div>
        )}
      </div>
    </article>
  )
}

// --- Main Page ---

export default function UserProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const username = params.username as string

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [viewerId, setViewerId] = React.useState<string | null>(null)
  const [profile, setProfile] = React.useState<UiProfile | null>(null)
  const [logs, setLogs] = React.useState<DrinkLog[]>([])
  const [friendshipStatus, setFriendshipStatus] = React.useState<FriendshipStatus>("none")

  const [granularity, setGranularity] = React.useState<Granularity>("Day")
  const [showSortMenu, setShowSortMenu] = React.useState(false)
  const sortMenuRef = React.useRef<HTMLDivElement>(null)

  const [achievements, setAchievements] = React.useState<Achievement[]>([])
  const [userAchievements, setUserAchievements] = React.useState<UserAchievement[]>([])
  const [selectedMedal, setSelectedMedal] = React.useState<Achievement | null>(null)

  const [cheersBusy, setCheersBusy] = React.useState<Record<string, boolean>>({})
  const [cheersAnimating, setCheersAnimating] = React.useState<Record<string, boolean>>({})
  const [cheersListPost, setCheersListPost] = React.useState<DrinkLog | null>(null)

  const [requestBusy, setRequestBusy] = React.useState(false)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false)
      }
    }
    if (showSortMenu) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showSortMenu])

  // Lock body scroll when medal detail modal is open
  const scrollYRef = React.useRef(0)
  React.useEffect(() => {
    if (selectedMedal) {
      scrollYRef.current = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollYRef.current}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      if (scrollYRef.current) {
        window.scrollTo(0, scrollYRef.current)
      }
    }
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
    }
  }, [selectedMedal])

  const loadCheersState = React.useCallback(
    async (postIds: string[], currentViewerId: string) => {
      if (!postIds.length) return

      const { data, error: rpcErr } = await supabase.rpc("get_cheers_state", {
        post_ids: postIds,
        viewer_id: currentViewerId,
      })

      if (rpcErr) throw rpcErr

      const rows = (data ?? []) as Array<{
        drink_log_id: string
        cheers_count: number
        cheered: boolean
      }>

      const byId = new Map<string, { count: number; cheered: boolean }>()
      for (const r of rows) {
        byId.set(r.drink_log_id, { count: Number(r.cheers_count ?? 0), cheered: Boolean(r.cheered) })
      }

      setLogs((prev) =>
        prev.map((it) => {
          const s = byId.get(it.id)
          if (!s) return it
          return { ...it, cheersCount: s.count, cheeredByMe: s.cheered }
        }),
      )
    },
    [supabase],
  )

  const load = React.useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      if (!userRes.user) {
        router.replace("/login?redirectTo=%2Ffeed")
        return
      }

      const currentUserId = userRes.user.id
      setViewerId(currentUserId)

      const { data: prof, error: profErr } = await supabase
        .from("profile_public_stats")
        .select("id,username,display_name,avatar_path,friend_count,drink_count,showcase_achievements")
        .eq("username", username)
        .single()

      if (profErr) {
        if (profErr.code === "PGRST116") {
          setError("User not found")
          setLoading(false)
          return
        }
        throw profErr
      }

      const p = prof as ProfileRow

      if (p.id === currentUserId) {
        router.replace("/profile/me")
        return
      }

      const { data: friendshipData, error: friendshipErr } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id, status")
        .or(
          `and(requester_id.eq.${currentUserId},addressee_id.eq.${p.id}),and(requester_id.eq.${p.id},addressee_id.eq.${currentUserId})`
        )
        .limit(1)
        .maybeSingle()

      if (friendshipErr) throw friendshipErr

      let status: FriendshipStatus = "none"
      if (friendshipData) {
        if (friendshipData.status === "accepted") {
          status = "friends"
        } else if (friendshipData.status === "pending") {
          if (friendshipData.requester_id === currentUserId) {
            status = "pending_outgoing"
          } else {
            status = "pending_incoming"
          }
        }
      }
      setFriendshipStatus(status)

      const { data: meta, error: metaErr } = await supabase
        .from("profile_public_stats")
        .select("created_at")
        .eq("id", p.id)
        .single()
      if (metaErr) throw metaErr
      const m = meta as ProfileMetaRow

      let avatarSignedUrl: string | null = null
      if (p.avatar_path) {
        const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60)
        avatarSignedUrl = data?.signedUrl ?? null
      }

      // Fetch achievements for showcase
      const { data: achievementsData } = await supabase
        .from("achievements")
        .select("*")
      setAchievements((achievementsData ?? []) as Achievement[])

      const { data: userAchievementsData } = await supabase
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", p.id)
      setUserAchievements((userAchievementsData ?? []) as UserAchievement[])

      const ui: UiProfile = {
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        joinDate: formatJoinDate(m.created_at),
        friendCount: p.friend_count ?? 0,
        drinkCount: p.drink_count ?? 0,
        avatarUrl: avatarSignedUrl,
        showcaseAchievements: p.showcase_achievements ?? [],
      }
      setProfile(ui)

      if (status === "friends") {
        const { data: rows, error: logsErr } = await supabase
          .from("drink_logs")
          .select("id,user_id,photo_path,drink_type,caption,created_at")
          .eq("user_id", p.id)
          .order("created_at", { ascending: false })
          .limit(200)
        if (logsErr) throw logsErr

        const base = (rows ?? []) as DrinkLogRow[]

        const photoUrls = await Promise.all(
          base.map((r) =>
            supabase.storage.from("drink-photos").createSignedUrl(r.photo_path, 60 * 60).then(res => res.data?.signedUrl ?? "")
          )
        )

        const mapped: DrinkLog[] = base.map((r, i) => ({
          id: r.id,
          userId: r.user_id,
          photoPath: r.photo_path,
          createdAt: r.created_at,
          timestampLabel: formatCardTimestamp(r.created_at),
          photoUrl: photoUrls[i],
          drinkType: r.drink_type,
          caption: r.caption ?? undefined,
          cheersCount: 0,
          cheeredByMe: false,
        }))

        setLogs(mapped)

        const ids = mapped.map((m) => m.id)
        await loadCheersState(ids, currentUserId)
      } else {
        setLogs([])
      }
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong loading this profile.")
    } finally {
      setLoading(false)
    }
  }, [router, supabase, username, loadCheersState])

  React.useEffect(() => {
    load()
  }, [load])

  // Realtime subscription for friendship changes
  React.useEffect(() => {
    if (!viewerId || !profile?.id) return

    const profileUserId = profile.id

    let friendshipId: string | null = null

    const fetchFriendshipId = async () => {
      const { data } = await supabase
        .from("friendships")
        .select("id")
        .or(
          `and(requester_id.eq.${viewerId},addressee_id.eq.${profileUserId}),and(requester_id.eq.${profileUserId},addressee_id.eq.${viewerId})`
        )
        .maybeSingle()

      friendshipId = data?.id ?? null
    }

    fetchFriendshipId()

    const friendshipsChannel = supabase
      .channel(`profile-friendships-${profileUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        (payload) => {
          const newRow = payload.new as any
          const oldRow = payload.old as any

          let shouldReload = false

          if (payload.eventType === "DELETE") {
            const deletedId = oldRow?.id
            if (deletedId && deletedId === friendshipId) {
              shouldReload = true
            }
          } else {
            const involvesViewerAndProfile =
              (newRow?.requester_id === viewerId && newRow?.addressee_id === profileUserId) ||
              (newRow?.requester_id === profileUserId && newRow?.addressee_id === viewerId) ||
              (oldRow?.requester_id === viewerId && oldRow?.addressee_id === profileUserId) ||
              (oldRow?.requester_id === profileUserId && oldRow?.addressee_id === viewerId)

            if (involvesViewerAndProfile) {
              shouldReload = true
              if (payload.eventType === "INSERT" && newRow?.id) {
                friendshipId = newRow.id
              }
            }
          }

          if (shouldReload) {
            load().then(() => {
              fetchFriendshipId()
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(friendshipsChannel)
    }
  }, [viewerId, profile?.id, supabase, load])

  async function sendFriendRequest() {
    if (!viewerId || !profile?.id) return
    setRequestBusy(true)

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
        body: JSON.stringify({ friendId: profile.id }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Could not send request.")

      await load()

      window.dispatchEvent(new Event("refresh-nav-badges"))
    } catch (e: any) {
      setError(e?.message ?? "Could not send friend request.")
    } finally {
      setRequestBusy(false)
    }
  }

  async function toggleCheers(log: DrinkLog) {
    if (!viewerId) return
    if (cheersBusy[log.id]) return

    const nextCheered = !log.cheeredByMe
    const nextCount = Math.max(0, log.cheersCount + (nextCheered ? 1 : -1))

    if (nextCheered) {
      setCheersAnimating((p) => ({ ...p, [log.id]: true }))
      setTimeout(() => setCheersAnimating((p) => ({ ...p, [log.id]: false })), 600)
    }

    setCheersBusy((p) => ({ ...p, [log.id]: true }))
    setLogs((prev) =>
      prev.map((p) =>
        p.id === log.id ? { ...p, cheeredByMe: nextCheered, cheersCount: nextCount } : p,
      ),
    )

    try {
      const { data, error: rpcErr } = await supabase.rpc("toggle_cheer", {
        p_drink_log_id: log.id,
        p_user_id: viewerId,
      })
      if (rpcErr) throw rpcErr

      const row = Array.isArray(data) ? data[0] : data
      const cheered = Boolean(row?.cheered)
      const cheers_count = Number(row?.cheers_count ?? nextCount)

      setLogs((prev) =>
        prev.map((p) =>
          p.id === log.id ? { ...p, cheeredByMe: cheered, cheersCount: cheers_count } : p,
        ),
      )
    } catch {
      setLogs((prev) =>
        prev.map((p) =>
          p.id === log.id ? { ...p, cheeredByMe: log.cheeredByMe, cheersCount: log.cheersCount } : p,
        ),
      )
    } finally {
      setCheersBusy((p) => ({ ...p, [log.id]: false }))
    }
  }

  const getGroupedDrinks = (): GroupedDrinks[] => {
    if (granularity === "Drink") return []
    const groups: Record<string, DrinkLog[]> = {}

    for (const log of logs) {
      const label = formatGroupLabel(log.createdAt, granularity)
      if (!groups[label]) groups[label] = []
      groups[label].push(log)
    }

    return Object.entries(groups).map(([label, drinks]) => ({
      label,
      drinks: [...drinks].reverse(),
      count: drinks.length,
    }))
  }

  const groupedDrinks = getGroupedDrinks()

  const getUnlockDate = (achievementId: string): string | null => {
    const ua = userAchievements.find(u => u.achievement_id === achievementId)
    return ua?.unlocked_at ?? null
  }

  const renderTimeline = () => {
    if (friendshipStatus === "pending_outgoing") {
      return <PendingRequestState username={profile?.username ?? username} />
    }

    if (friendshipStatus === "none" || friendshipStatus === "pending_incoming") {
      return (
        <LockedState
          username={profile?.username ?? username}
          friendshipStatus={friendshipStatus}
          onSendRequest={sendFriendRequest}
          requestBusy={requestBusy}
        />
      )
    }

    if (logs.length === 0) {
      return <EmptyState />
    }

    return (
      <div className="space-y-5">
        {granularity === "Drink"
          ? logs.map((log) => (
              <DrinkLogCard
                key={log.id}
                log={log}
                profile={profile!}
                onToggleCheers={toggleCheers}
                onShowCheersList={(log) => setCheersListPost(log)}
                cheersBusy={!!cheersBusy[log.id]}
                cheersAnimating={!!cheersAnimating[log.id]}
              />
            ))
          : groupedDrinks.map((group, index) => (
              <GroupedDrinkCard 
                key={`${group.label}-${index}`} 
                group={group}
                profile={profile!}
                onToggleCheers={toggleCheers}
                onShowCheersList={(log) => setCheersListPost(log)}
                cheersBusy={cheersBusy}
                cheersAnimating={cheersAnimating}
              />
            ))}
      </div>
    )
  }

  const showSortControls = friendshipStatus === "friends" && logs.length > 0

  return (
    <div className="container max-w-2xl px-0 sm:px-4 py-1.5">
      {/* Page Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm p-2 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-neutral-700 dark:text-white/70" />
        </button>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Profile</h2>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : profile ? (
        <div className="space-y-4 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
          {/* PROFILE CARD */}
          <div className="relative rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-5">
            {/* Showcase Medals — read-only */}
            <div className="absolute top-4 right-4">
              <ProfileShowcase
                showcaseIds={profile.showcaseAchievements}
                achievements={achievements}
                onSelectSlot={() => {}}
                onMedalClick={(achievement) => setSelectedMedal(achievement)}
                layout="horizontal"
                readOnly
              />
            </div>

            <div className="flex items-center gap-4">
              {profile.avatarUrl ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-white dark:ring-neutral-800 shadow-sm border border-neutral-100 dark:border-white/[0.06]">
                  <Image src={profile.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-2 ring-white dark:ring-neutral-800 shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-neutral-400 dark:text-white/30">
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
                  </svg>
                </div>
              )}

              <div className="flex-1">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{profile.displayName}</h3>
                <p className="-mt-0.5 text-sm text-neutral-500 dark:text-white/40">@{profile.username}</p>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-white/30">Joined {profile.joinDate}</p>

                <div className="mt-1.5 flex gap-4 text-sm">
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-white">{profile.friendCount}</span>{" "}
                    <span className="text-neutral-500 dark:text-white/40">Friends</span>
                  </div>
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-white">{profile.drinkCount}</span>{" "}
                    <span className="text-neutral-500 dark:text-white/40">Drinks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Medals and Analytics buttons — only when friends */}
          {friendshipStatus === "friends" && (
            <div className="flex gap-3">
              <Link
                href={`/profile/${profile.username}/awards`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-white/70 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
              >
                <Medal className="h-4 w-4" />
                Medals
              </Link>
              <Link
                href={`/profile/${profile.username}/analytics`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-white/70 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
            </div>
          )}

          {/* Timeline */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{profile.username}&apos;s Timeline</h3>

              {showSortControls && (
                <div className="relative" ref={sortMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-white/70 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {granularity}
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 top-full z-10 mt-2 w-32 overflow-hidden rounded-xl border border-neutral-200/50 dark:border-white/[0.08] bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl shadow-xl ring-1 ring-black/5 dark:ring-white/[0.06]">
                      {(["Day", "Month", "Year", "Drink"] as Granularity[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setGranularity(option)
                            setShowSortMenu(false)
                          }}
                          className={cn(
                            "w-full px-4 py-3 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/[0.08]",
                            granularity === option
                              ? "font-semibold text-neutral-900 dark:text-white bg-black/5 dark:bg-white/[0.06]"
                              : "text-neutral-600 dark:text-white/60"
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {renderTimeline()}
          </div>
        </div>
      ) : null}

      {/* Cheers List Modal */}
      {cheersListPost && (
        <CheersListModal
          drinkLogId={cheersListPost.id}
          cheersCount={cheersListPost.cheersCount}
          onClose={() => setCheersListPost(null)}
        />
      )}

      {/* Medal Detail Modal */}
      {selectedMedal && (
        <MedalDetailModal
          achievement={selectedMedal}
          unlockedAt={getUnlockDate(selectedMedal.id)}
          onClose={() => setSelectedMedal(null)}
        />
      )}
    </div>
  )
}