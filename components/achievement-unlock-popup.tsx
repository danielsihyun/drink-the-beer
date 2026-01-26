"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  Trophy, Medal, Star, Flame, Users, Sun, Moon, Clock, Calendar, Target, 
  Heart, Award, Flag, Zap, Share, ThumbsUp, Sparkles, X,
  Coffee, Leaf, Ghost, Gift, Cake, PartyPopper, Repeat, CalendarCheck,
  CheckCircle, RefreshCw, Beer, Wine, GlassWater, Timer, TrendingUp,
  RotateCw, Rocket
} from "lucide-react"
import { useAchievements } from "@/contexts/achievement-context"

type Difficulty = "bronze" | "silver" | "gold" | "diamond"

const DIFFICULTY_COLORS: Record<Difficulty, { bg: string; border: string; text: string; glow: string; gradient: string }> = {
  bronze: {
    bg: "bg-amber-900/30",
    border: "border-amber-600",
    text: "text-amber-500",
    glow: "shadow-amber-500/50",
    gradient: "from-amber-900 to-amber-700",
  },
  silver: {
    bg: "bg-slate-400/30",
    border: "border-slate-400",
    text: "text-slate-300",
    glow: "shadow-slate-400/50",
    gradient: "from-slate-600 to-slate-400",
  },
  gold: {
    bg: "bg-yellow-500/30",
    border: "border-yellow-500",
    text: "text-yellow-400",
    glow: "shadow-yellow-500/50",
    gradient: "from-yellow-600 to-yellow-400",
  },
  diamond: {
    bg: "bg-cyan-400/30",
    border: "border-cyan-400",
    text: "text-cyan-300",
    glow: "shadow-cyan-400/50",
    gradient: "from-cyan-600 to-cyan-400",
  },
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
    coffee: <Coffee className={className} />,
    clover: <Leaf className={className} />,
    marijuana: <Leaf className={className} />,
    ghost: <Ghost className={className} />,
    turkey: <Award className={className} />,
    gift: <Gift className={className} />,
    cake: <Cake className={className} />,
    party: <PartyPopper className={className} />,
    repeat: <Repeat className={className} />,
    "calendar-check": <CalendarCheck className={className} />,
    "check-circle": <CheckCircle className={className} />,
    refresh: <RefreshCw className={className} />,
    beer: <Beer className={className} />,
    glass: <GlassWater className={className} />,
    wine: <Wine className={className} />,
    martini: <Wine className={className} />,
    timer: <Timer className={className} />,
    "trending-up": <TrendingUp className={className} />,
    "rotate-cw": <RotateCw className={className} />,
    rocket: <Rocket className={className} />,
  }
  return icons[iconName] || <Trophy className={className} />
}

export function AchievementUnlockPopup() {
  const router = useRouter()
  const { pendingUnlocks, dismissUnlock } = useAchievements()
  const [isVisible, setIsVisible] = React.useState(false)
  const [isLeaving, setIsLeaving] = React.useState(false)

  const currentUnlock = pendingUnlocks[0]

  React.useEffect(() => {
    if (currentUnlock && !isVisible) {
      const showTimer = setTimeout(() => {
        setIsVisible(true)
      }, 300)
      return () => clearTimeout(showTimer)
    }
  }, [currentUnlock, isVisible])

  React.useEffect(() => {
    if (isVisible && currentUnlock) {
      const dismissTimer = setTimeout(() => {
        handleDismiss()
      }, 5000)
      return () => clearTimeout(dismissTimer)
    }
  }, [isVisible, currentUnlock])

  const handleDismiss = () => {
    setIsLeaving(true)
    setTimeout(() => {
      setIsVisible(false)
      setIsLeaving(false)
      dismissUnlock()
    }, 300)
  }

  const handleClick = () => {
    handleDismiss()
    router.push("/awards")
  }

  if (!currentUnlock || !isVisible) return null

  const colors = DIFFICULTY_COLORS[currentUnlock.difficulty]

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isLeaving ? "opacity-0" : "opacity-100"
        )}
        onClick={handleDismiss}
      />

      <div
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 transform transition-all duration-300",
          isLeaving ? "opacity-0 scale-95" : "opacity-100 scale-100"
        )}
      >
        <div
          onClick={handleClick}
          className={cn(
            "relative cursor-pointer overflow-hidden rounded-2xl border-2 p-6",
            colors.border,
            colors.bg,
            "shadow-2xl",
            colors.glow
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleDismiss()
            }}
            className="absolute right-3 top-3 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-4 left-1/4 h-2 w-2 animate-ping rounded-full bg-yellow-400 opacity-75" style={{ animationDelay: "0ms" }} />
            <div className="absolute -top-2 right-1/4 h-1.5 w-1.5 animate-ping rounded-full bg-cyan-400 opacity-75" style={{ animationDelay: "200ms" }} />
            <div className="absolute top-8 -left-2 h-2 w-2 animate-ping rounded-full bg-amber-400 opacity-75" style={{ animationDelay: "400ms" }} />
            <div className="absolute top-12 -right-2 h-1.5 w-1.5 animate-ping rounded-full bg-white opacity-75" style={{ animationDelay: "600ms" }} />
          </div>

          <div className="relative text-center">
            <p className={cn("text-sm font-semibold uppercase tracking-widest mb-4", colors.text)}>
              🎉 Achievement Unlocked!
            </p>

            <div
              className={cn(
                "mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4",
                colors.border,
                `bg-gradient-to-br ${colors.gradient}`,
                "shadow-lg animate-bounce"
              )}
              style={{ animationDuration: "1s", animationIterationCount: "2" }}
            >
              <span className="text-white">
                {getIconComponent(currentUnlock.icon, "h-10 w-10")}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              {currentUnlock.name}
            </h2>

            <p className="text-white/80 mb-4">
              {currentUnlock.description}
            </p>

            <span
              className={cn(
                "inline-block rounded-full px-4 py-1.5 text-sm font-semibold capitalize",
                colors.bg,
                colors.text,
                "border",
                colors.border
              )}
            >
              {currentUnlock.difficulty}
            </span>

            <p className="mt-6 text-xs text-white/50">
              Tap to view all achievements
            </p>
          </div>
        </div>
      </div>
    </>
  )
}