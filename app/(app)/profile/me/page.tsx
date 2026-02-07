"use client"

import { Medal, BarChart3 } from "lucide-react"
import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpDown, Check, ChevronDown, Edit2, FilePenLine, Loader2, LogOut, Plus, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { ProfileShowcase, SingleMedalPickerModal, MedalDetailModal } from "@/components/showcase-medals"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"
type Granularity = "Drink" | "Day" | "Month" | "Year"
const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]
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
  username: string
  displayName: string
  joinDate: string
  friendCount: number
  drinkCount: number
  avatarUrl: string | null
  avatarPath: string | null
  showcaseAchievements: string[]
}

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

const DEFAULT_PROFILE: UiProfile = {
  username: "you",
  displayName: "Your Name",
  joinDate: "—",
  friendCount: 0,
  drinkCount: 0,
  avatarUrl: null,
  avatarPath: null,
  showcaseAchievements: [],
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

function EditDrinkTypeDropdown({
  value,
  onChange,
  disabled,
}: {
  value: DrinkType
  onChange: (value: DrinkType) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative mt-5" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-neutral-200 dark:border-white/[0.1] bg-white/50 dark:bg-white/[0.06] backdrop-blur-sm px-4 py-4 text-sm transition-all duration-200",
          open ? "ring-2 ring-black/5 dark:ring-white/10 bg-white dark:bg-white/[0.08]" : "hover:bg-white dark:hover:bg-white/[0.08]",
          disabled ? "opacity-50 cursor-not-allowed" : ""
        )}
      >
        <span className="text-neutral-900 dark:text-white">{value}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-neutral-400 dark:text-white/40 transition-transform duration-200",
            open ? "rotate-180" : ""
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-neutral-200/50 dark:border-white/[0.08] bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl shadow-xl ring-1 ring-black/5 dark:ring-white/[0.06] animate-in fade-in zoom-in-95 duration-200">
          {DRINK_TYPES.map((t, index) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onChange(t)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors",
                "hover:bg-black/5 dark:hover:bg-white/[0.08] active:bg-black/10 dark:active:bg-white/[0.12]",
                t === value
                  ? "bg-black/5 dark:bg-white/[0.08] font-semibold text-black dark:text-white"
                  : "text-neutral-700 dark:text-white/70",
                index !== DRINK_TYPES.length - 1 ? "border-b border-black/5 dark:border-white/[0.06]" : ""
              )}
            >
              <span>{t}</span>
              {t === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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

function OverlayPage({
  title,
  children,
  onClose,
  onSave,
  saving,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  onSave?: () => void
  saving?: boolean
}) {
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-[400px] overflow-hidden rounded-[2rem] border border-white/20 dark:border-white/[0.08] bg-white dark:bg-neutral-900 shadow-2xl animate-in slide-in-from-bottom-12 zoom-in-95 duration-300">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] px-5 py-4 backdrop-blur-md">
          <div className="text-base font-semibold text-neutral-900 dark:text-white">{title}</div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-white/50 transition-colors hover:bg-neutral-200 dark:hover:bg-white/15"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                  saving ? "bg-neutral-100 dark:bg-white/10" : "bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100",
                )}
                aria-label="Save"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

// --- Loading / Empty States ---

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

      {/* Action buttons skeleton */}
      <div className="flex gap-3">
        <div className="h-11 flex-1 animate-pulse rounded-full bg-neutral-100 dark:bg-white/[0.06]" />
        <div className="h-11 flex-1 animate-pulse rounded-full bg-neutral-100 dark:bg-white/[0.06]" />
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
      <Link
        href="/log"
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-neutral-300 dark:border-white/15 bg-white/50 dark:bg-white/[0.04] text-neutral-400 dark:text-white/25 transition-colors hover:border-neutral-400 dark:hover:border-white/25 hover:text-neutral-500 dark:hover:text-white/40"
        aria-label="Log a drink"
        title="Log a drink"
      >
        <Plus className="h-8 w-8" />
      </Link>

      <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">No logs yet</h3>
      <p className="mb-6 max-w-sm text-sm text-neutral-500 dark:text-white/50">Log your first drink and it'll show up here.</p>
    </div>
  )
}

// --- Card Components ---

function DrinkLogCard({
  log,
  profile,
  onEdit,
  onDelete,
  onToggleCheers,
  onShowCheersList,
  cheersBusy,
  cheersAnimating,
}: {
  log: DrinkLog
  profile: UiProfile
  onEdit: (log: DrinkLog) => void
  onDelete: (log: DrinkLog) => void
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
        <div className="flex items-center justify-between">
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

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onEdit(log)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 dark:text-white/25 transition-all duration-150 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-neutral-700 dark:hover:text-white/60"
              aria-label="Edit post"
            >
              <FilePenLine className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(log)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 dark:text-red-400/40 transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
              aria-label="Delete post"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          </div>
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
  onEdit,
  onDelete,
  onToggleCheers,
  onShowCheersList,
  cheersBusy,
  cheersAnimating,
}: { 
  group: GroupedDrinks
  profile: UiProfile
  onEdit: (log: DrinkLog) => void
  onDelete: (log: DrinkLog) => void
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
        <div className="flex items-center justify-between">
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

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onEdit(currentDrink)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 dark:text-white/25 transition-all duration-150 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-neutral-700 dark:hover:text-white/60"
              aria-label="Edit post"
            >
              <FilePenLine className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(currentDrink)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 dark:text-red-400/40 transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
              aria-label="Delete post"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          </div>
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

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [userId, setUserId] = React.useState<string | null>(null)
  const [profile, setProfile] = React.useState<UiProfile>(DEFAULT_PROFILE)
  const [logs, setLogs] = React.useState<DrinkLog[]>([])

  const [granularity, setGranularity] = React.useState<Granularity>("Day")
  const [showSortMenu, setShowSortMenu] = React.useState(false)
  const sortMenuRef = React.useRef<HTMLDivElement>(null)

  const [achievements, setAchievements] = React.useState<Achievement[]>([])
  const [userAchievements, setUserAchievements] = React.useState<UserAchievement[]>([])
  const [selectedMedalSlot, setSelectedMedalSlot] = React.useState<number | null>(null)

  const [loggingOut, setLoggingOut] = React.useState(false)

  const [editPostOpen, setEditPostOpen] = React.useState(false)
  const [deletePostOpen, setDeletePostOpen] = React.useState(false)
  const [activePost, setActivePost] = React.useState<DrinkLog | null>(null)

  const [postDrinkType, setPostDrinkType] = React.useState<DrinkType>("Beer")
  const [postCaption, setPostCaption] = React.useState("")
  const [postBusy, setPostBusy] = React.useState(false)
  const [postError, setPostError] = React.useState<string | null>(null)

  const [cheersBusy, setCheersBusy] = React.useState<Record<string, boolean>>({})
  const [cheersAnimating, setCheersAnimating] = React.useState<Record<string, boolean>>({})
  const [cheersListPost, setCheersListPost] = React.useState<DrinkLog | null>(null)

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
      const user = userRes.user
      if (!user) {
        router.replace("/login?redirectTo=%2Fprofile%2Fme")
        return
      }

      setUserId(user.id)

      const { data: prof, error: profErr } = await supabase
        .from("profile_public_stats")
        .select("id,username,display_name,avatar_path,friend_count,drink_count,showcase_achievements")
        .eq("id", user.id)
        .single()
      if (profErr) throw profErr

      const p = prof as ProfileRow

      const { data: meta, error: metaErr } = await supabase.from("profile_public_stats").select("created_at").eq("id", user.id).single()
      if (metaErr) throw metaErr

      const m = meta as ProfileMetaRow

      let avatarSignedUrl: string | null = null
      if (p.avatar_path) {
        const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60)
        avatarSignedUrl = data?.signedUrl ?? null
      }

      const { data: rows, error: logsErr } = await supabase
        .from("drink_logs")
        .select("id,user_id,photo_path,drink_type,caption,created_at")
        .eq("user_id", user.id)
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
      await loadCheersState(ids, user.id)

      const { data: achievementsData } = await supabase
        .from("achievements")
        .select("*")

      const { data: userAchievementsData } = await supabase
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", user.id)

      setAchievements((achievementsData ?? []) as Achievement[])
      setUserAchievements((userAchievementsData ?? []) as UserAchievement[])

      const ui: UiProfile = {
        ...DEFAULT_PROFILE,
        username: p.username,
        displayName: p.display_name,
        joinDate: formatJoinDate(m.created_at),
        friendCount: p.friend_count ?? 0,
        drinkCount: p.drink_count ?? 0,
        avatarUrl: avatarSignedUrl,
        avatarPath: p.avatar_path ?? null,
        showcaseAchievements: p.showcase_achievements ?? [],
      }

      setProfile(ui)
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong loading your profile.")
    } finally {
      setLoading(false)
    }
  }, [router, supabase, loadCheersState])

  React.useEffect(() => {
    load()
  }, [load])

  async function toggleCheers(log: DrinkLog) {
    if (!userId) return
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
        p.id === log.id
          ? { ...p, cheeredByMe: nextCheered, cheersCount: nextCount }
          : p,
      ),
    )

    try {
      const { data, error: rpcErr } = await supabase.rpc("toggle_cheer", {
        p_drink_log_id: log.id,
        p_user_id: userId,
      })
      if (rpcErr) throw rpcErr

      const row = Array.isArray(data) ? data[0] : data
      const cheered = Boolean(row?.cheered)
      const cheers_count = Number(row?.cheers_count ?? nextCount)

      setLogs((prev) =>
        prev.map((p) =>
          p.id === log.id
            ? { ...p, cheeredByMe: cheered, cheersCount: cheers_count }
            : p,
        ),
      )
    } catch {
      setLogs((prev) =>
        prev.map((p) =>
          p.id === log.id
            ? { ...p, cheeredByMe: log.cheeredByMe, cheersCount: log.cheersCount }
            : p,
        ),
      )
    } finally {
      setCheersBusy((p) => ({ ...p, [log.id]: false }))
    }
  }

  async function saveShowcaseAchievement(slotIndex: number, achievementId: string | null) {
    if (!userId) return

    try {
      const currentShowcase = (profile.showcaseAchievements || []).filter(id => id && id !== "")
      
      let newShowcase: string[]
      
      if (achievementId) {
        if (slotIndex >= currentShowcase.length) {
          newShowcase = [achievementId, ...currentShowcase]
        } else {
          newShowcase = [...currentShowcase]
          newShowcase[slotIndex] = achievementId
        }
      } else {
        newShowcase = currentShowcase.filter((_, idx) => idx !== slotIndex)
      }

      newShowcase = newShowcase.slice(0, 2)

      const { error } = await supabase
        .from("profiles")
        .update({ showcase_achievements: newShowcase })
        .eq("id", userId)

      if (error) throw error

      setProfile((p) => ({ ...p, showcaseAchievements: newShowcase }))
    } catch (e: any) {
      setError(e?.message ?? "Could not save showcase")
    }
  }

  async function reorderShowcaseAchievements(newOrder: string[]) {
    if (!userId) return

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ showcase_achievements: newOrder })
        .eq("id", userId)

      if (error) throw error

      setProfile((p) => ({ ...p, showcaseAchievements: newOrder }))
    } catch (e: any) {
      setError(e?.message ?? "Could not reorder showcase")
    }
  }

  async function onLogout() {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.replace("/login")
    } finally {
      setLoggingOut(false)
    }
  }

  function openEditPost(log: DrinkLog) {
    setActivePost(log)
    setPostDrinkType(log.drinkType)
    setPostCaption(log.caption ?? "")
    setPostError(null)
    setEditPostOpen(true)
  }

  function openDeletePost(log: DrinkLog) {
    setActivePost(log)
    setPostError(null)
    setDeletePostOpen(true)
  }

  async function savePostEdits() {
    if (!activePost) return
    if (!userId) return setPostError("Not signed in.")

    setPostError(null)
    setPostBusy(true)

    try {
      const nextCaption = postCaption.trim()
      const { error: updErr } = await supabase
        .from("drink_logs")
        .update({
          drink_type: postDrinkType,
          caption: nextCaption.length ? nextCaption : null,
        })
        .eq("id", activePost.id)
        .eq("user_id", userId)

      if (updErr) throw updErr

      setLogs((prev) =>
        prev.map((l) =>
          l.id === activePost.id
            ? { ...l, drinkType: postDrinkType, caption: nextCaption.length ? nextCaption : undefined }
            : l
        )
      )

      setEditPostOpen(false)
      setActivePost(null)
    } catch (e: any) {
      setPostError(e?.message ?? "Could not update post.")
    } finally {
      setPostBusy(false)
    }
  }

  async function deletePostConfirmed() {
    if (!activePost) return
    if (!userId) return setPostError("Not signed in.")

    setPostError(null)
    setPostBusy(true)

    try {
      const { error: delErr } = await supabase.from("drink_logs").delete().eq("id", activePost.id).eq("user_id", userId)
      if (delErr) throw delErr

      if (activePost.photoPath) {
        await supabase.storage.from("drink-photos").remove([activePost.photoPath])
      }

      setLogs((prev) => prev.filter((l) => l.id !== activePost.id))
      setProfile((p) => ({ ...p, drinkCount: Math.max(0, p.drinkCount - 1) }))

      setDeletePostOpen(false)
      setActivePost(null)
    } catch (e: any) {
      setPostError(e?.message ?? "Could not delete post.")
    } finally {
      setPostBusy(false)
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

  return (
    <>
      <div className="container max-w-2xl px-0 sm:px-4 py-1.5">
        {/* Page Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Profile</h2>

          <div className="flex items-center gap-2">
            <Link
              href="/profile/edit"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm px-3 py-2 text-sm font-medium text-neutral-700 dark:text-white/70 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </Link>
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm px-3 py-2 text-sm font-medium text-neutral-700 dark:text-white/70 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
            >
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Log out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div>
            <LoadingSkeleton />
          </div>
        ) : (
          <div className="space-y-4 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
            {/* PROFILE CARD */}
            <div className="relative rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-5">
              {/* Showcase Medals */}
              <div className="absolute top-4 right-4">
                <ProfileShowcase
                  showcaseIds={profile.showcaseAchievements}
                  achievements={achievements}
                  onSelectSlot={(index) => setSelectedMedalSlot(index)}
                  onReorder={reorderShowcaseAchievements}
                  layout="horizontal"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="relative">
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
                </div>

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

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Link
                href="/awards"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-white/70 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
              >
                <Medal className="h-4 w-4" />
                Medals
              </Link>
              <Link
                href="/analytics"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-white/70 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
            </div>

            {/* Timeline */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">My Timeline</h3>

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
              </div>

              {logs.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-5">
                  {granularity === "Drink"
                    ? logs.map((log) => (
                        <DrinkLogCard
                          key={log.id}
                          log={log}
                          profile={profile}
                          onEdit={openEditPost}
                          onDelete={openDeletePost}
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
                          profile={profile}
                          onEdit={openEditPost}
                          onDelete={openDeletePost}
                          onToggleCheers={toggleCheers}
                          onShowCheersList={(log) => setCheersListPost(log)}
                          cheersBusy={cheersBusy}
                          cheersAnimating={cheersAnimating}
                        />
                      ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cheers List Modal */}
      {cheersListPost && (
        <CheersListModal
          drinkLogId={cheersListPost.id}
          cheersCount={cheersListPost.cheersCount}
          onClose={() => setCheersListPost(null)}
        />
      )}

      {/* Edit Post Modal */}
      {editPostOpen && activePost && (
        <OverlayPage
          title="Edit Drink"
          onClose={() => {
            if (postBusy) return
            setEditPostOpen(false)
            setActivePost(null)
            setPostError(null)
          }}
          onSave={savePostEdits}
          saving={postBusy}
        >
          {postError && (
            <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-500 dark:text-red-400">{postError}</div>
          )}

          <div className="flex gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-white/[0.04] ring-1 ring-black/5 dark:ring-white/[0.06]">
              <Image src={activePost.photoUrl || "/placeholder.svg"} alt="Post photo" fill className="object-cover" unoptimized />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{activePost.timestampLabel}</p>
              <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">Change type or caption below</p>
            </div>
          </div>

          <EditDrinkTypeDropdown
            value={postDrinkType}
            onChange={setPostDrinkType}
            disabled={postBusy}
          />

          <div className="relative mt-4">
            <textarea
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              placeholder="Add a caption (optional)"
              className="h-28 w-full resize-none rounded-2xl border border-neutral-200 dark:border-white/[0.1] bg-neutral-50 dark:bg-white/[0.04] p-4 text-base text-neutral-900 dark:text-white placeholder:text-neutral-300 dark:placeholder:text-white/20 focus:border-black/20 dark:focus:border-white/20 focus:bg-white dark:focus:bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-white/10 transition-all"
              maxLength={200}
              disabled={postBusy}
            />
            <div className="absolute bottom-4 right-4 text-xs text-neutral-400 dark:text-white/30">{postCaption.length}/200</div>
          </div>
        </OverlayPage>
      )}

      {/* Delete Post Modal */}
      {deletePostOpen && activePost && (
        <OverlayPage
          title="Delete Drink"
          onClose={() => {
            if (postBusy) return
            setDeletePostOpen(false)
            setActivePost(null)
            setPostError(null)
          }}
          onSave={deletePostConfirmed}
          saving={postBusy}
        >
          {postError && (
            <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-500 dark:text-red-400">{postError}</div>
          )}

          <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20 text-red-500 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold text-neutral-900 dark:text-white">Are you sure?</div>
                <p className="mt-1 text-sm text-neutral-600 dark:text-white/50">This action cannot be undone.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-neutral-100 dark:bg-white/[0.04] opacity-80 grayscale">
            <div className="relative aspect-square w-full">
              <Image src={activePost.photoUrl || "/placeholder.svg"} alt="Post photo" fill className="object-cover" unoptimized />
            </div>
          </div>
        </OverlayPage>
      )}

      {/* Medal Picker Modal */}
      {selectedMedalSlot !== null && (
        <SingleMedalPickerModal
          slotIndex={selectedMedalSlot}
          currentAchievementId={profile.showcaseAchievements.filter(id => id && id !== "")[selectedMedalSlot] || null}
          currentShowcaseIds={profile.showcaseAchievements.filter(id => id && id !== "")}
          allAchievements={achievements}
          unlockedIds={new Set(userAchievements.map((ua) => ua.achievement_id))}
          onSave={saveShowcaseAchievement}
          onClose={() => setSelectedMedalSlot(null)}
        />
      )}
    </>
  )
}