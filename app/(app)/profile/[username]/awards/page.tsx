"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  ArrowLeft, Trophy, Medal, Star, Flame, Users, Sun, Moon, Clock, Calendar,
  Target, Heart, Award, Flag, Zap, Share, ThumbsUp, Sparkles, Lock, Filter,
  Coffee, Leaf, Ghost, Gift, Cake, PartyPopper, Repeat, CalendarCheck,
  CheckCircle, RefreshCw, Beer, Wine, GlassWater, Timer, TrendingUp,
  RotateCw, Rocket, ChevronDown,
} from "lucide-react"

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

const DIFFICULTY_COLORS: Record<Difficulty, { bg: string; border: string; text: string; glow: string }> = {
  bronze: { bg: "bg-amber-900/20", border: "border-amber-700/50", text: "text-amber-600", glow: "shadow-amber-500/20" },
  silver: { bg: "bg-slate-400/30", border: "border-slate-500/70", text: "text-slate-500", glow: "shadow-slate-500/20" },
  gold: { bg: "bg-yellow-500/20", border: "border-yellow-500/50", text: "text-yellow-500", glow: "shadow-yellow-500/20" },
  diamond: { bg: "bg-cyan-400/20", border: "border-cyan-400/50", text: "text-cyan-400", glow: "shadow-cyan-400/20" },
}

const CATEGORY_ORDER: string[] = [
  "total_drinks", "single_day", "social", "cheers", "variety", "streak", "time_based",
  "dayofweek_based", "holiday_based", "consistency", "drink_specific", "milestones",
  "speed", "patterns", "secret",
]

const CATEGORY_LABELS: Record<string, string> = {
  total_drinks: "Total Drinks", single_day: "Single Day", social: "Social", cheers: "Cheers",
  variety: "Variety", streak: "Streaks", time_based: "Time Based", dayofweek_based: "Day of The Week",
  holiday_based: "Holidays", consistency: "Consistency", drink_specific: "Drink Specific",
  milestones: "Milestones", speed: "Speed", patterns: "Patterns", secret: "Secret",
}

function getIconComponent(iconName: string, className?: string) {
  const icons: Record<string, React.ReactNode> = {
    trophy: <Trophy className={className} />, medal: <Medal className={className} />, star: <Star className={className} />,
    flame: <Flame className={className} />, users: <Users className={className} />, sun: <Sun className={className} />,
    moon: <Moon className={className} />, clock: <Clock className={className} />, calendar: <Calendar className={className} />,
    target: <Target className={className} />, heart: <Heart className={className} />, award: <Award className={className} />,
    flag: <Flag className={className} />, zap: <Zap className={className} />, share: <Share className={className} />,
    "thumbs-up": <ThumbsUp className={className} />, sparkles: <Sparkles className={className} />,
    coffee: <Coffee className={className} />, clover: <Leaf className={className} />, marijuana: <Leaf className={className} />,
    ghost: <Ghost className={className} />, turkey: <Award className={className} />, gift: <Gift className={className} />,
    cake: <Cake className={className} />, party: <PartyPopper className={className} />, repeat: <Repeat className={className} />,
    "calendar-check": <CalendarCheck className={className} />, "check-circle": <CheckCircle className={className} />,
    refresh: <RefreshCw className={className} />, beer: <Beer className={className} />, glass: <GlassWater className={className} />,
    wine: <Wine className={className} />, martini: <Wine className={className} />, timer: <Timer className={className} />,
    "trending-up": <TrendingUp className={className} />, "rotate-cw": <RotateCw className={className} />,
    rocket: <Rocket className={className} />,
  }
  return icons[iconName] || <Trophy className={className} />
}

function ResponsiveTitle({ text }: { text: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = React.useState(24)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const calculate = () => {
      const w = container.clientWidth
      if (!w) return
      const span = document.createElement("span")
      span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:24px;font-weight:700;font-family:inherit`
      span.textContent = text
      document.body.appendChild(span)
      const tw = span.offsetWidth
      document.body.removeChild(span)
      setFontSize(tw > w ? Math.max(Math.floor(24 * (w / tw) * 0.95), 16) : 24)
    }
    calculate()
    const ro = new ResizeObserver(calculate)
    ro.observe(container)
    return () => ro.disconnect()
  }, [text])

  return (
    <div ref={containerRef} className="min-w-0 flex-1 overflow-hidden">
      <h2 className="font-bold whitespace-nowrap" style={{ fontSize, lineHeight: "1.25" }}>{text}</h2>
    </div>
  )
}

function AchievementCard({ achievement, unlocked, unlockedAt }: { achievement: Achievement; unlocked: boolean; unlockedAt?: string }) {
  const colors = DIFFICULTY_COLORS[achievement.difficulty]
  const isSecret = achievement.category === "secret" && !unlocked

  return (
    <div className={cn(
      "relative rounded-xl border p-4 transition-all",
      unlocked ? colors.bg : "bg-foreground/5",
      unlocked ? colors.border : "border-foreground/10",
      unlocked && "shadow-lg",
      unlocked && colors.glow,
      !unlocked && "opacity-50"
    )}>
      <div className={cn("flex gap-3", unlocked ? "items-center" : "items-start")}>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-full border-2", unlocked ? colors.bg : "bg-foreground/10", unlocked ? colors.border : "border-foreground/20")}>
          {isSecret
            ? <Lock className={cn("h-6 w-6", unlocked ? colors.text : "text-foreground/30")} />
            : <span className={cn(unlocked ? colors.text : "text-foreground/30")}>{getIconComponent(achievement.icon, "h-6 w-6")}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn("font-semibold truncate", unlocked ? "text-foreground" : "text-foreground/50")}>
              {isSecret ? "???" : achievement.name}
            </h3>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize", unlocked ? colors.bg : "bg-foreground/10", unlocked ? colors.text : "text-foreground/40")}>
              {achievement.difficulty}
            </span>
          </div>
          <p className={cn("text-sm mt-0.5", unlocked ? "text-foreground/70" : "text-foreground/40")}>
            {isSecret ? "Hidden achievement" : achievement.description}
          </p>
          {unlocked && unlockedAt && (
            <p className="text-xs text-foreground/50 mt-1">Unlocked {new Date(unlockedAt).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatsHeader({ total, unlocked, bronze, silver, gold, diamond }: { total: number; unlocked: number; bronze: number; silver: number; gold: number; diamond: number }) {
  const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0
  return (
    <div className="rounded-xl border bg-background/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Medals Earned</p>
          <p className="text-3xl font-bold">{unlocked} <span className="text-lg font-normal text-muted-foreground">/ {total}</span></p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold">{percentage}%</p>
          <p className="text-sm text-muted-foreground">Complete</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
        <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${percentage}%` }} />
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {(["bronze", "silver", "gold", "diamond"] as const).map((d, _, __, counts = { bronze, silver, gold, diamond }) => (
          <div key={d} className={cn("rounded-lg p-2", DIFFICULTY_COLORS[d].bg)}>
            <p className={cn("text-lg font-bold", DIFFICULTY_COLORS[d].text)}>{counts[d]}</p>
            <p className="text-xs text-muted-foreground capitalize">{d}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CollapsibleCategory({ category, achievements, unlockedIds, unlockedMap, defaultExpanded = true }: {
  category: string; achievements: Achievement[]; unlockedIds: Set<string>; unlockedMap: Map<string, string>; defaultExpanded?: boolean
}) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)
  const unlockedCount = achievements.filter((a) => unlockedIds.has(a.id)).length

  return (
    <div className={isExpanded ? "mb-6" : "mb-3"}>
      <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between mb-3 group">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{CATEGORY_LABELS[category] || category}</h3>
          <span className="text-sm text-muted-foreground">{unlockedCount}/{achievements.length}</span>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")} />
      </button>
      <div className={cn("grid gap-3 overflow-hidden transition-all duration-300", isExpanded ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0">
          <div className="grid gap-3">
            {achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} unlocked={unlockedIds.has(achievement.id)} unlockedAt={unlockedMap.get(achievement.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-background/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-foreground/10" />
            <div className="h-8 w-20 animate-pulse rounded bg-foreground/10" />
          </div>
          <div className="text-right space-y-2">
            <div className="h-10 w-16 animate-pulse rounded bg-foreground/10 ml-auto" />
            <div className="h-4 w-20 animate-pulse rounded bg-foreground/10" />
          </div>
        </div>
        <div className="h-2 rounded-full bg-foreground/10" />
        <div className="grid grid-cols-4 gap-2">
          {[1,2,3,4].map((i) => (
            <div key={i} className="rounded-lg p-2 bg-foreground/5 space-y-2">
              <div className="h-5 w-8 animate-pulse rounded bg-foreground/10 mx-auto" />
              <div className="h-3 w-12 animate-pulse rounded bg-foreground/10 mx-auto" />
            </div>
          ))}
        </div>
      </div>
      {[1,2,3].map((i) => (
        <div key={i} className="mb-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-32 animate-pulse rounded bg-foreground/10" />
            <div className="h-4 w-4 animate-pulse rounded bg-foreground/10" />
          </div>
          <div className="grid gap-3 mt-3">
            {[1,2,3].map((j) => (
              <div key={j} className="rounded-xl border border-foreground/10 p-4">
                <div className="flex gap-3 items-center">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-foreground/10" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-32 animate-pulse rounded bg-foreground/10" />
                      <div className="h-5 w-16 animate-pulse rounded-full bg-foreground/10" />
                    </div>
                    <div className="h-4 w-48 animate-pulse rounded bg-foreground/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FriendAwardsPage() {
  const router = useRouter()
  const params = useParams()
  const username = params.username as string
  const supabase = createClient()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [achievements, setAchievements] = React.useState<Achievement[]>([])
  const [userAchievements, setUserAchievements] = React.useState<UserAchievement[]>([])
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all")
  const [showFilterMenu, setShowFilterMenu] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      setError(null)
      setLoading(true)
      try {
        const { data: sessRes } = await supabase.auth.getSession()
        const token = sessRes.session?.access_token
        if (!token) {
          router.replace(`/login?redirectTo=%2Fprofile%2F${username}%2Fawards`)
          return
        }

        const res = await fetch(`/api/profile/${encodeURIComponent(username)}/awards`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => ({}))

        if (res.ok && json.redirect) {
          router.replace(json.redirect)
          return
        }
        if (!res.ok) {
          if (res.status === 403) {
            setError(json?.error ?? "You must be friends to view their medals")
          } else if (res.status === 404) {
            setError("User not found")
          } else {
            throw new Error(json?.error ?? "Could not load medals.")
          }
          return
        }

        setAchievements(json.achievements ?? [])
        setUserAchievements(json.userAchievements ?? [])
      } catch (e: any) {
        setError(e?.message ?? "Could not load medals.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase, username])

  React.useEffect(() => {
    if (!showFilterMenu) return
    const handle = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-filter-menu]")) setShowFilterMenu(false)
    }
    document.addEventListener("click", handle)
    return () => document.removeEventListener("click", handle)
  }, [showFilterMenu])

  const unlockedIds = new Set(userAchievements.map((ua) => ua.achievement_id))
  const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievement_id, ua.unlocked_at]))

  const categories = React.useMemo(() => {
    const availableCats = new Set(achievements.map((a) => a.category))
    const ordered = CATEGORY_ORDER.filter((c) => availableCats.has(c))
    for (const c of availableCats) { if (!CATEGORY_ORDER.includes(c)) ordered.push(c) }
    return ["all", ...ordered]
  }, [achievements])

  const filteredAchievements = React.useMemo(() => (
    selectedCategory === "all" ? achievements : achievements.filter((a) => a.category === selectedCategory)
  ), [achievements, selectedCategory])

  const groupedAchievements = React.useMemo(() => {
    const groups: Record<string, Achievement[]> = {}
    for (const a of filteredAchievements) {
      if (!groups[a.category]) groups[a.category] = []
      groups[a.category].push(a)
    }
    const ordered: [string, Achievement[]][] = []
    for (const c of CATEGORY_ORDER) { if (groups[c]) ordered.push([c, groups[c]]) }
    for (const c of Object.keys(groups)) { if (!CATEGORY_ORDER.includes(c)) ordered.push([c, groups[c]]) }
    return ordered
  }, [filteredAchievements])

  const stats = React.useMemo(() => {
    const unlocked = userAchievements.length
    const total = achievements.length
    const unlockedAchievements = achievements.filter((a) => unlockedIds.has(a.id))
    return {
      total, unlocked,
      bronze: unlockedAchievements.filter((a) => a.difficulty === "bronze").length,
      silver: unlockedAchievements.filter((a) => a.difficulty === "silver").length,
      gold: unlockedAchievements.filter((a) => a.difficulty === "gold").length,
      diamond: unlockedAchievements.filter((a) => a.difficulty === "diamond").length,
    }
  }, [achievements, userAchievements, unlockedIds])

  const titleText = `${username}'s Medals`

  return (
    <div className="container max-w-2xl px-3 py-1.5 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button type="button" onClick={() => router.back()} className="inline-flex items-center justify-center rounded-full border p-2 shrink-0" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ResponsiveTitle text={titleText} />
        </div>
        <div className="relative shrink-0" data-filter-menu>
          <button type="button" onClick={() => setShowFilterMenu(!showFilterMenu)} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            {selectedCategory === "all" ? "All" : CATEGORY_LABELS[selectedCategory] || selectedCategory}
          </button>
          {showFilterMenu && (
            <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-xl border bg-background shadow-lg max-h-[60vh] overflow-y-auto">
              {categories.map((cat) => (
                <button key={cat} type="button" onClick={() => { setSelectedCategory(cat); setShowFilterMenu(false) }}
                  className={`w-full px-4 py-3 text-left text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-foreground/5 ${selectedCategory === cat ? "font-semibold bg-foreground/10" : ""}`}>
                  {cat === "all" ? "All" : CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6">
          <StatsHeader {...stats} />
          <div className="[&>*:last-child]:mb-0">
            {groupedAchievements.map(([category, categoryAchievements]) => (
              <CollapsibleCategory key={category} category={category} achievements={categoryAchievements} unlockedIds={unlockedIds} unlockedMap={unlockedMap} />
            ))}
          </div>
          {filteredAchievements.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No medals found in this category.</div>
          )}
        </div>
      )}
    </div>
  )
}