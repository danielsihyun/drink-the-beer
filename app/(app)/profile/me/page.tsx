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
  avatarColor: string
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
  avatarColor: string
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
  avatarColor: "#4ECDC4",
  avatarUrl: null,
  avatarPath: null,
  showcaseAchievements: [],
}

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
          "flex w-full items-center justify-between rounded-2xl border bg-background/50 px-4 py-4 text-sm transition-all",
          "hover:border-black/30 focus:outline-none focus:ring-2 focus:ring-black/20",
          open ? "border-black/30 ring-2 ring-black/20" : "",
          disabled ? "opacity-50 cursor-not-allowed" : ""
        )}
      >
        <span>{value}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            open ? "rotate-180" : ""
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-background shadow-lg">
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
                "hover:bg-black/5 active:bg-black/10",
                t === value ? "bg-black/5 font-medium" : "",
                index !== DRINK_TYPES.length - 1 ? "border-b border-black/5" : ""
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

  // Lock body scroll when modal is open (mobile-friendly)
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
            avatarColor: "#4ECDC4",
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-[344px] overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-base font-semibold">
            Cheers {cheersCount > 0 && `(${cheersCount})`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[280px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin opacity-50" />
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-center text-sm text-red-400">
              {error}
            </div>
          ) : users.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm opacity-60">
              No cheers yet
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user) => (
                <Link
                  key={user.id}
                  href={`/profile/${user.username}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/5"
                  onClick={onClose}
                >
                  {user.avatarUrl ? (
                    <div className="relative h-10 w-10 overflow-hidden rounded-full">
                      <Image
                        src={user.avatarUrl}
                        alt={user.username}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: user.avatarColor }}
                    >
                      {user.username[0]?.toUpperCase() ?? "U"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.displayName}</p>
                    <p className="text-xs opacity-60 truncate">@{user.username}</p>
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

interface CheersIconProps {
  filled?: boolean
  className?: string
}

function CheersIcon({ filled = false, className }: CheersIconProps) {
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

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
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

      <div className="flex gap-2">
        <div className="h-10 flex-1 animate-pulse rounded-full bg-foreground/10" />
        <div className="h-10 flex-1 animate-pulse rounded-full bg-foreground/10" />
      </div>

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
      <Link
        href="/log"
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed"
        aria-label="Log a drink"
        title="Log a drink"
      >
        <Plus className="h-8 w-8 opacity-50" />
      </Link>

      <h3 className="mb-2 text-lg font-semibold">No logs yet</h3>
      <p className="mb-6 max-w-sm text-sm opacity-70">Log your first drink and it'll show up here.</p>
    </div>
  )
}

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
    <article className="rounded-2xl border bg-background/50 p-3">
      <div className="flex items-center gap-2">
        {profile.avatarUrl ? (
          <div className="relative h-10 w-10 overflow-hidden rounded-full">
            <Image
              src={profile.avatarUrl || "/placeholder.svg"}
              alt="Profile"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {profile.username[0]?.toUpperCase() ?? "Y"}
          </div>
        )}

        <div className="flex-1 pl-[2px]">
          <p className="text-sm font-medium">{profile.username}</p>
          <p className="text-xs opacity-60">{log.timestampLabel}</p>
        </div>

        <span className="inline-flex shrink-0 rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
          {log.drinkType}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border">
        <div className="relative aspect-square w-full">
          <Image
            src={log.photoUrl || "/placeholder.svg"}
            alt={`${log.drinkType} drink`}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0">
          <button
            type="button"
            onClick={() => onToggleCheers(log)}
            disabled={cheersBusy}
            className={cn(
              "relative inline-flex items-center justify-center p-1",
              "transition-all duration-200",
              log.cheeredByMe ? "text-amber-500" : "text-foreground",
              cheersBusy ? "opacity-70" : "",
              cheersAnimating ? "animate-bounce-beer" : "active:scale-95 hover:scale-110",
            )}
            aria-pressed={log.cheeredByMe}
            aria-label={log.cheeredByMe ? "Uncheer" : "Cheer"}
            title={log.cheeredByMe ? "Uncheer" : "Cheer"}
          >
            <CheersIcon filled={log.cheeredByMe} className="h-10 w-10" />

            {cheersAnimating && log.cheeredByMe && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="absolute h-8 w-8 animate-ping rounded-full bg-amber-400/30 translate-y-0.25 -translate-x-0.25" />
              </span>
            )}
          </button>

          {log.cheersCount > 0 && (
            <button
              type="button"
              onClick={() => onShowCheersList(log)}
              className="text-base font-semibold text-foreground/70 translate-y-0.25 hover:text-foreground hover:underline"
            >
              {log.cheersCount}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(log)}
            className="inline-flex items-center justify-center text-foreground/70 transition-transform hover:scale-[1.2] active:scale-[0.99]"
            style={{ width: "30px", height: "30px" }}
            aria-label="Edit post"
            title="Edit"
          >
            <FilePenLine className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(log)}
            className="inline-flex items-center justify-center text-red-400 transition-transform hover:scale-[1.2] active:scale-[0.99]"
            style={{ width: "30px", height: "30px" }}
            aria-label="Delete post"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="-mt-1.5 mb-1 pl-2">
        {log.caption ? (
          <p className="text-sm leading-relaxed">{log.caption}</p>
        ) : (
          <p className="text-sm leading-relaxed opacity-50">No caption</p>
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
    <article className="rounded-2xl border bg-background/50 p-3">
      <div className="flex items-center gap-2">
        {profile.avatarUrl ? (
          <div className="relative h-10 w-10 overflow-hidden rounded-full">
            <Image
              src={profile.avatarUrl || "/placeholder.svg"}
              alt="Profile"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {profile.username[0]?.toUpperCase() ?? "Y"}
          </div>
        )}

        <div className="flex-1 pl-[2px]">
          <p className="text-sm font-medium">{profile.username}</p>
          <p className="text-xs opacity-60">{currentDrink.timestampLabel}</p>
        </div>

        <span className="inline-flex shrink-0 rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
          {currentDrink.drinkType}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border">
        <div className="relative">
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ 
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {group.drinks.map((drink) => (
              <div 
                key={drink.id}
                className="relative aspect-square w-full flex-shrink-0 snap-start snap-always"
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
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0">
          <button
            type="button"
            onClick={() => onToggleCheers(currentDrink)}
            disabled={cheersBusy[currentDrink.id]}
            className={cn(
              "relative inline-flex items-center justify-center p-1",
              "transition-all duration-200",
              currentDrink.cheeredByMe ? "text-amber-500" : "text-foreground",
              cheersBusy[currentDrink.id] ? "opacity-70" : "",
              cheersAnimating[currentDrink.id] ? "animate-bounce-beer" : "active:scale-95 hover:scale-110",
            )}
            aria-pressed={currentDrink.cheeredByMe}
            aria-label={currentDrink.cheeredByMe ? "Uncheer" : "Cheer"}
            title={currentDrink.cheeredByMe ? "Uncheer" : "Cheer"}
          >
            <CheersIcon filled={currentDrink.cheeredByMe} className="h-10 w-10" />

            {cheersAnimating[currentDrink.id] && currentDrink.cheeredByMe && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="absolute h-8 w-8 animate-ping rounded-full bg-amber-400/30 translate-y-0.25 -translate-x-0.25" />
              </span>
            )}
          </button>

          {currentDrink.cheersCount > 0 && (
            <button
              type="button"
              onClick={() => onShowCheersList(currentDrink)}
              className="text-base font-semibold text-foreground/70 translate-y-0.25 hover:text-foreground hover:underline"
            >
              {currentDrink.cheersCount}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(currentDrink)}
            className="inline-flex items-center justify-center text-foreground/70 transition-transform hover:scale-[1.2] active:scale-[0.99]"
            style={{ width: "30px", height: "30px" }}
            aria-label="Edit post"
            title="Edit"
          >
            <FilePenLine className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(currentDrink)}
            className="inline-flex items-center justify-center text-red-400 transition-transform hover:scale-[1.2] active:scale-[0.99]"
            style={{ width: "30px", height: "30px" }}
            aria-label="Delete post"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="-mt-1.5 mb-1 pl-2">
        {currentDrink.caption ? (
          <p className="text-sm leading-relaxed">{currentDrink.caption}</p>
        ) : (
          <p className="text-sm leading-relaxed opacity-50">No caption</p>
        )}
      </div>
    </article>
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
  // Lock body scroll when modal is open (mobile-friendly)
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-[344px] overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-base font-semibold">{title}</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10"
              aria-label="Cancel"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10"
                aria-label="Save"
                title="Save"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  )
}

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
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Profile</h2>

          <div className="flex items-center gap-2">
            <Link
              href="/profile/edit"
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </Link>
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"
            >
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Log out
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-4 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
            {/* PROFILE CARD */}
            <div className="relative rounded-2xl border bg-background/50 p-3">
              {/* Showcase Medals - top right corner */}
              <div className="absolute top-3 right-3">
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
                    <div className="relative h-20 w-20 overflow-hidden rounded-full">
                      <Image
                        src={profile.avatarUrl || "/placeholder.svg"}
                        alt="Profile"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                      style={{ backgroundColor: profile.avatarColor }}
                    >
                      {profile.username[0]?.toUpperCase() ?? "Y"}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold">{profile.displayName}</h3>
                  <p className="-mt-1 text-sm opacity-60">@{profile.username}</p>
                  <p className="mt-0.5 text-xs opacity-50">Joined {profile.joinDate}</p>

                  <div className="mt-1 flex gap-4 text-sm">
                    <div>
                      <span className="font-bold">{profile.friendCount}</span>{" "}
                      <span className="opacity-60">Friends</span>
                    </div>
                    <div>
                      <span className="font-bold">{profile.drinkCount}</span>{" "}
                      <span className="opacity-60">Drinks</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                href="/awards"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              >
                <Medal className="h-4 w-4" />
                Medals
              </Link>
              <Link
                href="/analytics"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">My Timeline</h3>

                <div className="relative" ref={sortMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {granularity}
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 top-full z-10 mt-2 w-32 rounded-xl border bg-background shadow-lg">
                      {(["Day", "Month", "Year", "Drink"] as Granularity[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setGranularity(option)
                            setShowSortMenu(false)
                          }}
                          className={`w-full px-4 py-3 text-left text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-foreground/5 ${
                            granularity === option ? "font-semibold" : ""
                          }`}
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
                <div className="space-y-4">
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

      {/* Post edit popup */}
      {editPostOpen && activePost ? (
        <OverlayPage
          title="Edit post"
          onClose={() => {
            if (postBusy) return
            setEditPostOpen(false)
            setActivePost(null)
            setPostError(null)
          }}
          onSave={savePostEdits}
          saving={postBusy}
        >
          {postError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {postError}
            </div>
          ) : null}

          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-background/50">
            <div className="relative aspect-square w-full">
              <Image
                src={activePost.photoUrl || "/placeholder.svg"}
                alt="Post photo"
                fill
                className="object-cover"
                unoptimized
              />
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
              className="h-28 w-full resize-none rounded-2xl border bg-background/50 px-4 py-4 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/20"
              maxLength={200}
              disabled={postBusy}
            />
            <div className="absolute bottom-4 right-4 text-xs opacity-60">{postCaption.length}/200</div>
          </div>
        </OverlayPage>
      ) : null}

      {/* Post delete popup */}
      {deletePostOpen && activePost ? (
        <OverlayPage
          title="Delete post"
          onClose={() => {
            if (postBusy) return
            setDeletePostOpen(false)
            setActivePost(null)
            setPostError(null)
          }}
          onSave={deletePostConfirmed}
          saving={postBusy}
        >
          {postError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {postError}
            </div>
          ) : null}

          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold">Are you sure?</div>
                <p className="mt-1 text-sm opacity-70">This action cannot be undone.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 mx-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-background/50">
            <div className="relative aspect-square w-full">
              <Image
                src={activePost.photoUrl || "/placeholder.svg"}
                alt="Post photo"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          </div>
        </OverlayPage>
      ) : null}

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