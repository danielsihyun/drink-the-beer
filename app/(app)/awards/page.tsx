"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { ArrowLeft, Trophy, Medal, Star, Flame, Users, Sun, Moon, Clock, Calendar, Target, Heart, Award, Flag, Zap, Share, ThumbsUp, Sparkles, Lock } from "lucide-react"

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
  bronze: {
    bg: "bg-amber-900/20",
    border: "border-amber-700/50",
    text: "text-amber-600",
    glow: "shadow-amber-500/20",
  },
  silver: {
    bg: "bg-slate-300/20",
    border: "border-slate-400/50",
    text: "text-slate-400",
    glow: "shadow-slate-400/20",
  },
  gold: {
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/50",
    text: "text-yellow-500",
    glow: "shadow-yellow-500/20",
  },
  diamond: {
    bg: "bg-cyan-400/20",
    border: "border-cyan-400/50",
    text: "text-cyan-400",
    glow: "shadow-cyan-400/20",
  },
}

const CATEGORY_LABELS: Record<string, string> = {
  total_drinks: "Total Drinks",
  variety: "Variety",
  single_day: "Single Day",
  streak: "Streaks",
  social: "Social",
  time_based: "Time Based",
  consistency: "Consistency",
  milestones: "Milestones",
  drink_specific: "Drink Specific",
  speed: "Speed",
  patterns: "Patterns",
  sharing: "Sharing",
  reactions: "Reactions",
  secret: "Secret",
}

function getIconComponent(iconName: string, className?: string) {
  const icons: Record<string, React.ReactNode> = {
    trophy: <Trophy className={className} />,
    medal: <Medal className={className} />,
    star: <Star className={className} />,
    flame: <Flame className={className} />,
    users: <Users className={className} />,
    sun: <Sun className={className} />,
    moon: <Moon className={className} />,
    clock: <Clock className={className} />,
    calendar: <Calendar className={className} />,
    target: <Target className={className} />,
    heart: <Heart className={className} />,
    award: <Award className={className} />,
    flag: <Flag className={className} />,
    zap: <Zap className={className} />,
    share: <Share className={className} />,
    "thumbs-up": <ThumbsUp className={className} />,
    sparkles: <Sparkles className={className} />,
  }
  return icons[iconName] || <Trophy className={className} />
}

function AchievementCard({
  achievement,
  unlocked,
  unlockedAt,
}: {
  achievement: Achievement
  unlocked: boolean
  unlockedAt?: string
}) {
  const colors = DIFFICULTY_COLORS[achievement.difficulty]
  const isSecret = achievement.category === "secret" && !unlocked

  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 transition-all",
        unlocked ? colors.bg : "bg-foreground/5",
        unlocked ? colors.border : "border-foreground/10",
        unlocked && "shadow-lg",
        unlocked && colors.glow,
        !unlocked && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full",
            unlocked ? colors.bg : "bg-foreground/10",
            unlocked ? colors.border : "border-foreground/20",
            "border-2"
          )}
        >
          {isSecret ? (
            <Lock className={cn("h-6 w-6", unlocked ? colors.text : "text-foreground/30")} />
          ) : (
            <span className={cn(unlocked ? colors.text : "text-foreground/30")}>
              {getIconComponent(achievement.icon, "h-6 w-6")}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn("font-semibold truncate", unlocked ? "text-foreground" : "text-foreground/50")}>
              {isSecret ? "???" : achievement.name}
            </h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                unlocked ? colors.bg : "bg-foreground/10",
                unlocked ? colors.text : "text-foreground/40"
              )}
            >
              {achievement.difficulty}
            </span>
          </div>
          <p className={cn("text-sm mt-0.5", unlocked ? "text-foreground/70" : "text-foreground/40")}>
            {isSecret ? "Hidden achievement" : achievement.description}
          </p>
          {unlocked && unlockedAt && (
            <p className="text-xs text-foreground/50 mt-1">
              Unlocked {new Date(unlockedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-6 w-32 animate-pulse rounded bg-foreground/10" />
          <div className="grid gap-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-24 animate-pulse rounded-xl bg-foreground/10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function StatsHeader({
  total,
  unlocked,
  bronze,
  silver,
  gold,
  diamond,
}: {
  total: number
  unlocked: number
  bronze: number
  silver: number
  gold: number
  diamond: number
}) {
  const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0

  return (
    <div className="rounded-xl border bg-background/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Achievements Unlocked</p>
          <p className="text-3xl font-bold">
            {unlocked} <span className="text-lg font-normal text-muted-foreground">/ {total}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold">{percentage}%</p>
          <p className="text-sm text-muted-foreground">Complete</p>
        </div>
      </div>

      <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-600 via-yellow-500 to-cyan-400 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className={cn("rounded-lg p-2", DIFFICULTY_COLORS.bronze.bg)}>
          <p className={cn("text-lg font-bold", DIFFICULTY_COLORS.bronze.text)}>{bronze}</p>
          <p className="text-xs text-muted-foreground">Bronze</p>
        </div>
        <div className={cn("rounded-lg p-2", DIFFICULTY_COLORS.silver.bg)}>
          <p className={cn("text-lg font-bold", DIFFICULTY_COLORS.silver.text)}>{silver}</p>
          <p className="text-xs text-muted-foreground">Silver</p>
        </div>
        <div className={cn("rounded-lg p-2", DIFFICULTY_COLORS.gold.bg)}>
          <p className={cn("text-lg font-bold", DIFFICULTY_COLORS.gold.text)}>{gold}</p>
          <p className="text-xs text-muted-foreground">Gold</p>
        </div>
        <div className={cn("rounded-lg p-2", DIFFICULTY_COLORS.diamond.bg)}>
          <p className={cn("text-lg font-bold", DIFFICULTY_COLORS.diamond.text)}>{diamond}</p>
          <p className="text-xs text-muted-foreground">Diamond</p>
        </div>
      </div>
    </div>
  )
}

export default function AwardsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [achievements, setAchievements] = React.useState<Achievement[]>([])
  const [userAchievements, setUserAchievements] = React.useState<UserAchievement[]>([])
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all")

  React.useEffect(() => {
    async function load() {
      setError(null)
      setLoading(true)

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!userRes.user) {
          router.replace("/login?redirectTo=%2Fawards")
          return
        }

        // Fetch all achievements
        const { data: achievementsData, error: achievementsErr } = await supabase
          .from("achievements")
          .select("*")
          .order("category")
          .order("difficulty")

        if (achievementsErr) throw achievementsErr

        // Fetch user's unlocked achievements
        const { data: userAchievementsData, error: userAchievementsErr } = await supabase
          .from("user_achievements")
          .select("achievement_id, unlocked_at")
          .eq("user_id", userRes.user.id)

        if (userAchievementsErr) throw userAchievementsErr

        setAchievements((achievementsData ?? []) as Achievement[])
        setUserAchievements((userAchievementsData ?? []) as UserAchievement[])
      } catch (e: any) {
        setError(e?.message ?? "Could not load achievements.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router, supabase])

  const unlockedIds = new Set(userAchievements.map((ua) => ua.achievement_id))
  const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievement_id, ua.unlocked_at]))

  const categories = React.useMemo(() => {
    const cats = new Set(achievements.map((a) => a.category))
    return ["all", ...Array.from(cats)]
  }, [achievements])

  const filteredAchievements = React.useMemo(() => {
    if (selectedCategory === "all") return achievements
    return achievements.filter((a) => a.category === selectedCategory)
  }, [achievements, selectedCategory])

  const groupedAchievements = React.useMemo(() => {
    const groups: Record<string, Achievement[]> = {}
    for (const achievement of filteredAchievements) {
      if (!groups[achievement.category]) {
        groups[achievement.category] = []
      }
      groups[achievement.category].push(achievement)
    }
    return groups
  }, [filteredAchievements])

  // Stats
  const stats = React.useMemo(() => {
    const unlocked = userAchievements.length
    const total = achievements.length

    const unlockedAchievements = achievements.filter((a) => unlockedIds.has(a.id))
    const bronze = unlockedAchievements.filter((a) => a.difficulty === "bronze").length
    const silver = unlockedAchievements.filter((a) => a.difficulty === "silver").length
    const gold = unlockedAchievements.filter((a) => a.difficulty === "gold").length
    const diamond = unlockedAchievements.filter((a) => a.difficulty === "diamond").length

    return { total, unlocked, bronze, silver, gold, diamond }
  }, [achievements, userAchievements, unlockedIds])

  return (
    <div className="container max-w-2xl px-3 py-1.5 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-full border p-2"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold">Awards</h2>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6">
          <StatsHeader {...stats} />

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  selectedCategory === cat
                    ? "bg-foreground text-background"
                    : "bg-foreground/10 hover:bg-foreground/20"
                )}
              >
                {cat === "all" ? "All" : CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          {/* Achievements Grid */}
          {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-3">{CATEGORY_LABELS[category] || category}</h3>
              <div className="grid gap-3">
                {categoryAchievements.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    unlocked={unlockedIds.has(achievement.id)}
                    unlockedAt={unlockedMap.get(achievement.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {filteredAchievements.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No achievements found in this category.
            </div>
          )}
        </div>
      )}
    </div>
  )
}