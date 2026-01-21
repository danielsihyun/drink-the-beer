"use client"

import { Trophy, BarChart3 } from "lucide-react"
import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpDown, Camera, Edit2, FilePenLine, Loader2, LogOut, Plus, Trash2, X, Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"
type Granularity = "Drink" | "Day" | "Month" | "Year"

const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

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
    <div className="space-y-6">
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
  cheersBusy,
  cheersAnimating,
}: {
  log: DrinkLog
  profile: UiProfile
  onEdit: (log: DrinkLog) => void
  onDelete: (log: DrinkLog) => void
  onToggleCheers: (log: DrinkLog) => void
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
            <span className="text-base font-semibold text-foreground/70 translate-y-0.25">{log.cheersCount}</span>
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

function GroupedDrinkCard({ group, profile, onClick }: { group: GroupedDrinks; profile: UiProfile; onClick: () => void }) {
  const maxStack = 3
  const displayDrinks = group.drinks.slice(0, maxStack)

  return (
    <article 
      className="rounded-2xl border bg-background/50 p-3 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-3">
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
          <p className="text-xs opacity-60">{group.label}</p>
        </div>

        <span className="inline-flex shrink-0 rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
          {group.count} {group.count === 1 ? "drink" : "drinks"}
        </span>
      </div>

      <div className="relative h-64">
        {displayDrinks.map((drink, index) => (
          <div
            key={drink.id}
            className="absolute overflow-hidden rounded-xl border-4 border-background shadow-lg"
            style={{
              left: `${index * 16}px`,
              top: `${index * 16}px`,
              right: `${(displayDrinks.length - 1 - index) * 16}px`,
              bottom: `${(displayDrinks.length - 1 - index) * 16}px`,
              zIndex: displayDrinks.length - index,
            }}
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

        {group.count > maxStack && (
          <div
            className="absolute flex items-center justify-center rounded-xl border-4 border-background bg-black/80 text-white shadow-lg"
            style={{
              left: `${maxStack * 16}px`,
              top: `${maxStack * 16}px`,
              right: 0,
              bottom: 0,
              zIndex: 0,
            }}
          >
            <span className="text-2xl font-bold">+{group.count - maxStack}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from(new Set(group.drinks.map((d) => d.drinkType))).map((type) => (
          <span key={type} className="inline-flex rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
            {type}
          </span>
        ))}
      </div>
    </article>
  )
}

function DrinkCarouselModal({
  group,
  profile,
  onClose,
  onEdit,
  onDelete,
  onToggleCheers,
  cheersBusy,
  cheersAnimating,
}: {
  group: GroupedDrinks
  profile: UiProfile
  onClose: () => void
  onEdit: (log: DrinkLog) => void
  onDelete: (log: DrinkLog) => void
  onToggleCheers: (log: DrinkLog) => void
  cheersBusy: Record<string, boolean>
  cheersAnimating: Record<string, boolean>
}) {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = React.useState<number | null>(null)
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null)

  const currentDrink = group.drinks[currentIndex]
  const minSwipeDistance = 50

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < group.drinks.length - 1 ? prev + 1 : prev))
  }

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) goToNext()
    if (isRightSwipe) goToPrev()
  }

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev()
      if (e.key === "ArrowRight") goToNext()
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  if (!currentDrink) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-lg mx-4">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with date */}
        <div className="mb-3 text-center">
          <h3 className="text-lg font-semibold text-white">{group.label}</h3>
          <p className="text-sm text-white/60">
            {currentIndex + 1} of {group.drinks.length}
          </p>
        </div>

        {/* Carousel container */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-2xl bg-background"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Image */}
          <div className="relative aspect-square w-full">
            <Image
              src={currentDrink.photoUrl || "/placeholder.svg"}
              alt={`${currentDrink.drinkType} drink`}
              fill
              className="object-cover"
              unoptimized
            />

            {/* Drink type badge */}
            <span className="absolute top-3 right-3 inline-flex rounded-full border bg-background/90 px-3 py-1 text-xs font-medium">
              {currentDrink.drinkType}
            </span>
          </div>

          {/* Dots indicator */}
          {group.drinks.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {group.drinks.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentIndex(index)
                  }}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    index === currentIndex
                      ? "bg-white w-4"
                      : "bg-white/50 hover:bg-white/70"
                  )}
                  aria-label={`Go to drink ${index + 1}`}
                />
              ))}
            </div>
          )}

          {/* Bottom section with actions and caption */}
          <div className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {profile.avatarUrl ? (
                  <div className="relative h-8 w-8 overflow-hidden rounded-full">
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
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: profile.avatarColor }}
                  >
                    {profile.username[0]?.toUpperCase() ?? "Y"}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{profile.username}</p>
                  <p className="text-xs opacity-60">{currentDrink.timestampLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(currentDrink)
                  }}
                  className="inline-flex items-center justify-center text-foreground/70 transition-transform hover:scale-[1.2] active:scale-[0.99]"
                  style={{ width: "30px", height: "30px" }}
                  aria-label="Edit post"
                  title="Edit"
                >
                  <FilePenLine className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(currentDrink)
                  }}
                  className="inline-flex items-center justify-center text-red-400 transition-transform hover:scale-[1.2] active:scale-[0.99]"
                  style={{ width: "30px", height: "30px" }}
                  aria-label="Delete post"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleCheers(currentDrink)
                  }}
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
                  <span className="text-base font-semibold text-foreground/70 translate-y-0.25">{currentDrink.cheersCount}</span>
                )}
              </div>
            </div>

            <div className="mt-1 pl-1">
              {currentDrink.caption ? (
                <p className="text-sm leading-relaxed">{currentDrink.caption}</p>
              ) : (
                <p className="text-sm leading-relaxed opacity-50">No caption</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OverlayPage({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="container max-w-2xl px-4">
        <div className="mx-auto w-[50%] min-w-[320px] overflow-hidden rounded-2xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-base font-semibold">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full"
              aria-label="Close"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[80vh] overflow-y-auto px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const [userId, setUserId] = React.useState<string | null>(null)
  const [profile, setProfile] = React.useState<UiProfile>(DEFAULT_PROFILE)
  const [logs, setLogs] = React.useState<DrinkLog[]>([])

  const [granularity, setGranularity] = React.useState<Granularity>("Day")
  const [showSortMenu, setShowSortMenu] = React.useState(false)

  const [isEditingProfile, setIsEditingProfile] = React.useState(false)
  const [editedProfile, setEditedProfile] = React.useState<UiProfile>(DEFAULT_PROFILE)
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [savingProfile, setSavingProfile] = React.useState(false)

  const [editPostOpen, setEditPostOpen] = React.useState(false)
  const [deletePostOpen, setDeletePostOpen] = React.useState(false)
  const [activePost, setActivePost] = React.useState<DrinkLog | null>(null)

  const [postDrinkType, setPostDrinkType] = React.useState<DrinkType>("Beer")
  const [postCaption, setPostCaption] = React.useState("")
  const [postBusy, setPostBusy] = React.useState(false)
  const [postError, setPostError] = React.useState<string | null>(null)

  const [cheersBusy, setCheersBusy] = React.useState<Record<string, boolean>>({})
  const [cheersAnimating, setCheersAnimating] = React.useState<Record<string, boolean>>({})

  const [passwordOpen, setPasswordOpen] = React.useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = React.useState(false)

  const [pwCurrent, setPwCurrent] = React.useState("")
  const [pwNew, setPwNew] = React.useState("")
  const [pwConfirm, setPwConfirm] = React.useState("")
  const [pwBusy, setPwBusy] = React.useState(false)
  const [pwError, setPwError] = React.useState<string | null>(null)

  const [delConfirm, setDelConfirm] = React.useState("")
  const [delBusy, setDelBusy] = React.useState(false)
  const [delError, setDelError] = React.useState<string | null>(null)

  const [carouselGroup, setCarouselGroup] = React.useState<GroupedDrinks | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let t: any
    if (success) t = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(t)
  }, [success])

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
        router.replace("/login?redirectTo=%2Fprofile")
        return
      }

      setUserId(user.id)

      const { data: prof, error: profErr } = await supabase
        .from("profile_public_stats")
        .select("id,username,display_name,avatar_path,friend_count,drink_count")
        .eq("id", user.id)
        .single()
      if (profErr) throw profErr

      const p = prof as ProfileRow

      const { data: meta, error: metaErr } = await supabase.from("profiles").select("created_at").eq("id", user.id).single()
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
      const mapped: DrinkLog[] = await Promise.all(
        base.map(async (r) => {
          const { data } = await supabase.storage.from("drink-photos").createSignedUrl(r.photo_path, 60 * 60)
          return {
            id: r.id,
            userId: r.user_id,
            photoPath: r.photo_path,
            createdAt: r.created_at,
            timestampLabel: formatCardTimestamp(r.created_at),
            photoUrl: data?.signedUrl ?? "",
            drinkType: r.drink_type,
            caption: r.caption ?? undefined,
            cheersCount: 0,
            cheeredByMe: false,
          }
        })
      )

      setLogs(mapped)

      const ids = mapped.map((m) => m.id)
      await loadCheersState(ids, user.id)

      const ui: UiProfile = {
        ...DEFAULT_PROFILE,
        username: p.username,
        displayName: p.display_name,
        joinDate: formatJoinDate(m.created_at),
        friendCount: p.friend_count ?? 0,
        drinkCount: p.drink_count ?? 0,
        avatarUrl: avatarSignedUrl,
        avatarPath: p.avatar_path ?? null,
      }

      setProfile(ui)
      setEditedProfile(ui)
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

  const handleEditClick = () => {
    setEditedProfile(profile)
    setAvatarFile(null)
    setIsEditingProfile(true)
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditedProfile(profile)
    setAvatarFile(null)
    setIsEditingProfile(false)
    setError(null)
  }

  const handleAvatarClick = () => {
    if (isEditingProfile) fileInputRef.current?.click()
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setAvatarFile(f)
      const url = URL.createObjectURL(f)
      setEditedProfile({ ...editedProfile, avatarUrl: url })
    }
  }

  async function handleSaveProfile() {
    setError(null)
    setSavingProfile(true)

    try {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) {
        router.replace("/login?redirectTo=%2Fprofile")
        return
      }

      const nextUsername = editedProfile.username.trim().toLowerCase()
      const nextDisplayName = editedProfile.displayName.trim()

      if (nextUsername.length < 3) throw new Error("Username must be at least 3 characters.")
      if (!/^[a-z0-9_]+$/.test(nextUsername)) {
        throw new Error("Username must be letters, numbers, and underscores only.")
      }

      let nextAvatarPath = profile.avatarPath
      let nextAvatarUrl = profile.avatarUrl

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "jpg"
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`

        const { error: upErr } = await supabase.storage
          .from("profile-photos")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })

        if (upErr) throw upErr

        const { data } = await supabase.storage.from("profile-photos").createSignedUrl(path, 60 * 60)
        nextAvatarPath = path
        nextAvatarUrl = data?.signedUrl ?? null
      }

      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          username: nextUsername,
          display_name: nextDisplayName,
          avatar_path: nextAvatarPath,
        })
        .eq("id", user.id)

      if (updErr) {
        if ((updErr as any).code === "23505") throw new Error("Username is taken. Try something else.")
        throw updErr
      }

      const updated: UiProfile = {
        ...profile,
        username: nextUsername,
        displayName: nextDisplayName,
        avatarPath: nextAvatarPath,
        avatarUrl: nextAvatarUrl,
      }

      setProfile(updated)
      setEditedProfile(updated)
      setIsEditingProfile(false)
      setSuccess("Username changed successfully.")
    } catch (e: any) {
      setError(e?.message ?? "Could not save profile.")
    } finally {
      setSavingProfile(false)
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
      setEditedProfile((p) => ({ ...p, drinkCount: Math.max(0, p.drinkCount - 1) }))

      // Update carousel group if open
      if (carouselGroup) {
        const updatedDrinks = carouselGroup.drinks.filter((d) => d.id !== activePost.id)
        if (updatedDrinks.length === 0) {
          setCarouselGroup(null)
        } else {
          setCarouselGroup({
            ...carouselGroup,
            drinks: updatedDrinks,
            count: updatedDrinks.length,
          })
        }
      }

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
      // Reverse to show oldest first (chronological order within the group)
      drinks: [...drinks].reverse(),
      count: drinks.length,
    }))
  }

  const groupedDrinks = getGroupedDrinks()
  const current = isEditingProfile ? editedProfile : profile

  async function onChangePassword() {
    setPwError(null)
    setPwBusy(true)

    try {
      const { data: userRes, error: uErr } = await supabase.auth.getUser()
      if (uErr) throw uErr
      const user = userRes.user
      if (!user?.email) throw new Error("Missing email on session user.")

      if (!pwCurrent.trim() || !pwNew.trim() || !pwConfirm.trim()) throw new Error("Please fill in all fields.")
      if (pwNew.length < 8) throw new Error("Password must be at least 8 characters.")
      if (pwNew !== pwConfirm) throw new Error("Passwords do not match.")

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: pwCurrent,
      })
      if (signErr) throw new Error("Current password is incorrect.")

      const { error: updErr } = await supabase.auth.updateUser({ password: pwNew })
      if (updErr) throw updErr

      setPasswordOpen(false)
      setPwCurrent("")
      setPwNew("")
      setPwConfirm("")
      setSuccess("Password changed successfully.")
    } catch (e: any) {
      setPwError(e?.message ?? "Could not change password.")
    } finally {
      setPwBusy(false)
    }
  }

  async function onDeleteAccount() {
    setDelError(null)
    setDelBusy(true)

    try {
      if (delConfirm.trim().toUpperCase() !== "DELETE") {
        throw new Error('Type "DELETE" to confirm.')
      }

      const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) throw sessErr

      const token = sessRes.session?.access_token
      if (!token) throw new Error("Missing session token. Please log out and log back in.")

      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Delete failed.")

      await supabase.auth.signOut()
      router.replace("/signup")
    } catch (e: any) {
      setDelError(e?.message ?? "Could not delete account.")
    } finally {
      setDelBusy(false)
    }
  }

  return (
    <>
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Profile</h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEditClick}
              disabled={isEditingProfile}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </button>
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
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-6 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
            {/* PROFILE CARD */}
            <div className="relative rounded-2xl border bg-background/50 p-3">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {current.avatarUrl ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-full">
                      <Image
                        src={current.avatarUrl || "/placeholder.svg"}
                        alt="Profile"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                      style={{ backgroundColor: current.avatarColor }}
                    >
                      {current.username[0]?.toUpperCase() ?? "Y"}
                    </div>
                  )}

                  {isEditingProfile && (
                    <>
                      <button
                        type="button"
                        onClick={handleAvatarClick}
                        className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-black text-white"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                    </>
                  )}
                </div>

                <div className="flex-1">
                  {isEditingProfile ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editedProfile.displayName}
                        onChange={(e) => setEditedProfile({ ...editedProfile, displayName: e.target.value })}
                        className="w-full rounded-lg border bg-background px-3 py-1.5 text-base font-bold"
                        placeholder="Display Name"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-sm opacity-60">@</span>
                        <input
                          type="text"
                          value={editedProfile.username}
                          onChange={(e) =>
                            setEditedProfile({ ...editedProfile, username: e.target.value.toLowerCase() })
                          }
                          className="flex-1 rounded-lg border bg-background px-2 py-1 text-sm"
                          placeholder="username"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold">{profile.displayName}</h3>
                      <p className="-mt-1 text-sm opacity-60">@{profile.username}</p>
                    </>
                  )}

                  <p className="mt-0.5 text-xs opacity-50">Joined {profile.joinDate}</p>

                  <div className="mt-1 flex items-center justify-between pr-20 text-sm">
                    <div className="flex gap-4">
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

              {isEditingProfile ? (
                <div className="absolute bottom-3 right-3 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPwError(null)
                      setPasswordOpen(true)
                    }}
                    className="inline-flex items-center justify-center text-foreground/70 transition-transform hover:scale-[1.2] active:scale-[0.99]"
                    style={{ width: "30px", height: "30px" }}
                    aria-label="Change password"
                    title="Change password"
                  >
                    <Lock className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDelError(null)
                      setDelConfirm("")
                      setDeleteAccountOpen(true)
                    }}
                    className="inline-flex items-center justify-center text-red-400 transition-transform hover:scale-[1.2] active:scale-[0.99]"
                    style={{ width: "30px", height: "30px" }}
                    aria-label="Delete account"
                    title="Delete account"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>

            {isEditingProfile ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
                  disabled={savingProfile}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-black px-4 py-2.5 text-sm font-medium text-white"
                  disabled={savingProfile}
                >
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Link
                  href="/awards"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
                >
                  <Trophy className="h-4 w-4" />
                  Awards
                </Link>
                <Link
                  href="/analytics"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
                >
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Link>
              </div>
            )}

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">My Timeline</h3>

                {!isEditingProfile && (
                  <div className="relative">
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
                )}
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
                          profile={current}
                          onEdit={openEditPost}
                          onDelete={openDeletePost}
                          onToggleCheers={toggleCheers}
                          cheersBusy={!!cheersBusy[log.id]}
                          cheersAnimating={!!cheersAnimating[log.id]}
                        />
                      ))
                    : groupedDrinks.map((group, index) => (
                        <GroupedDrinkCard 
                          key={`${group.label}-${index}`} 
                          group={group}
                          profile={current}
                          onClick={() => setCarouselGroup(group)}
                        />
                      ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Drink Carousel Modal */}
      {carouselGroup && (
        <DrinkCarouselModal
          group={carouselGroup}
          profile={current}
          onClose={() => setCarouselGroup(null)}
          onEdit={openEditPost}
          onDelete={openDeletePost}
          onToggleCheers={toggleCheers}
          cheersBusy={cheersBusy}
          cheersAnimating={cheersAnimating}
        />
      )}

      {/* Change Password popup */}
      {passwordOpen ? (
        <OverlayPage
          title="Change password"
          onClose={() => {
            if (pwBusy) return
            setPasswordOpen(false)
            setPwError(null)
          }}
        >
          {pwError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {pwError}
            </div>
          ) : null}

          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">Current password</div>
                <input
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
                  placeholder="••••••••"
                  disabled={pwBusy}
                />
              </div>

              <div>
                <div className="text-sm font-medium">New password</div>
                <input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
                  placeholder="At least 8 characters"
                  disabled={pwBusy}
                />
              </div>

              <div>
                <div className="text-sm font-medium">Confirm new password</div>
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
                  placeholder="••••••••"
                  disabled={pwBusy}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (pwBusy) return
                setPasswordOpen(false)
                setPwError(null)
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              disabled={pwBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onChangePassword}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-black px-4 py-2.5 text-sm font-medium text-white"
              disabled={pwBusy}
            >
              {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </OverlayPage>
      ) : null}

      {/* Delete Account popup */}
      {deleteAccountOpen ? (
        <OverlayPage
          title="Delete account"
          onClose={() => {
            if (delBusy) return
            setDeleteAccountOpen(false)
            setDelError(null)
          }}
        >
          {delError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {delError}
            </div>
          ) : null}

          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold">This is permanent</div>
                <p className="mt-1 text-sm opacity-70">
                  This will delete your profile and posts. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium">Type DELETE to confirm</div>
              <input
                value={delConfirm}
                onChange={(e) => setDelConfirm(e.target.value)}
                className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
                placeholder="DELETE"
                disabled={delBusy}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (delBusy) return
                setDeleteAccountOpen(false)
                setDelError(null)
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              disabled={delBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onDeleteAccount}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-200"
              disabled={delBusy}
            >
              {delBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </button>
          </div>
        </OverlayPage>
      ) : null}

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
        >
          {postError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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

          <div className="mt-5 rounded-2xl border bg-background/50 p-3">
            <div className="text-sm font-medium">Drink type</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DRINK_TYPES.map((t) => {
                const selected = t === postDrinkType
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPostDrinkType(t)}
                    className={[
                      "rounded-full border px-4 py-2 text-sm",
                      "active:scale-[0.99]",
                      selected ? "border-black bg-black text-white" : "bg-transparent hover:bg-foreground/5",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-background/50 p-3">
            <div className="text-sm font-medium">Caption</div>
            <textarea
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              placeholder="Update your caption…"
              className="mt-3 h-28 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
              maxLength={200}
              disabled={postBusy}
            />
            <div className="mt-2 text-right text-xs opacity-60">{postCaption.length}/200</div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (postBusy) return
                setEditPostOpen(false)
                setActivePost(null)
                setPostError(null)
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              disabled={postBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={savePostEdits}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-black px-4 py-2.5 text-sm font-medium text-white"
              disabled={postBusy}
            >
              {postBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
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
        >
          {postError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {postError}
            </div>
          ) : null}

          <div className="rounded-2xl border bg-background/50 p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold">Are you sure?</div>
                <p className="mt-1 text-sm opacity-70">This action cannot be undone.</p>
              </div>
            </div>
          </div>

          <div className="mt-5 mx-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-background/50">
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

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (postBusy) return
                setDeletePostOpen(false)
                setActivePost(null)
                setPostError(null)
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              disabled={postBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={deletePostConfirmed}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-200"
              disabled={postBusy}
            >
              {postBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </button>
          </div>
        </OverlayPage>
      ) : null}
    </>
  )
}