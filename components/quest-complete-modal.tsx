"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuestCompleteModalProps {
  questTitle: string
  questEmoji: string
  xpEarned: number
  totalXp: number
  level: number
  currentLevelXp: number
  xpToNextLevel: number
  leveledUp: boolean
  onClose: () => void
}

export function QuestCompleteModal({
  questTitle,
  questEmoji,
  xpEarned,
  totalXp,
  level,
  currentLevelXp,
  xpToNextLevel,
  leveledUp,
  onClose,
}: QuestCompleteModalProps) {
  const [show, setShow] = React.useState(false)
  const [showXp, setShowXp] = React.useState(false)
  const [showBar, setShowBar] = React.useState(false)
  const [showLevel, setShowLevel] = React.useState(false)

  React.useEffect(() => {
    document.body.style.overflow = "hidden"
    // Stagger the entrance animations
    const t1 = setTimeout(() => setShow(true), 50)
    const t2 = setTimeout(() => setShowXp(true), 400)
    const t3 = setTimeout(() => setShowBar(true), 700)
    const t4 = setTimeout(() => setShowLevel(true), 1000)
    return () => {
      document.body.style.overflow = ""
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [])

  const levelPct =
    xpToNextLevel > 0 ? Math.min((currentLevelXp / xpToNextLevel) * 100, 100) : 100

  return (
    <div
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-6 transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0"
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={cn(
          "w-full max-w-[320px] overflow-hidden rounded-[2rem] border border-white/20 dark:border-white/[0.08] bg-white dark:bg-neutral-900 shadow-2xl transition-all duration-500",
          show
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-90 translate-y-8"
        )}
      >
        {/* Header area */}
        <div className="relative flex flex-col items-center pt-8 pb-2 px-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-neutral-400 dark:text-white/40 transition-colors hover:bg-black/10 dark:hover:bg-white/15"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Celebration emoji */}
          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-4xl transition-all duration-700",
              show ? "scale-100" : "scale-0"
            )}
          >
            {questEmoji}
          </div>

          {/* Title */}
          <h2 className="mt-4 text-xl font-bold tracking-tight text-neutral-900 dark:text-white text-center">
            Quest Complete!
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-white/40 text-center">
            {questTitle}
          </p>
        </div>

        {/* XP earned */}
        <div className="px-6 py-4">
          <div
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl py-4 transition-all duration-500",
              "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10",
              "border border-amber-200/40 dark:border-amber-500/15",
              showXp
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            <span className="text-2xl">✨</span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: "#B8860B" }}>
              +{xpEarned} XP
            </span>
          </div>

          {/* Level progress */}
          <div
            className={cn(
              "mt-4 transition-all duration-500",
              showBar
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-neutral-600 dark:text-white/50">
                Level {level}
              </span>
              <span className="text-[11px] tabular-nums text-neutral-400 dark:text-white/30">
                {currentLevelXp} / {xpToNextLevel} XP
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: showBar ? `${levelPct}%` : "0%",
                  background: "linear-gradient(90deg, #3478F6, #34C759)",
                }}
              />
            </div>
          </div>

          {/* Level up banner */}
          {leveledUp && (
            <div
              className={cn(
                "mt-4 flex items-center justify-center gap-2 rounded-2xl py-3 transition-all duration-500",
                "bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10",
                "border border-violet-200/40 dark:border-violet-500/15",
                showLevel
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-4 scale-95"
              )}
            >
              <span className="text-lg">🎉</span>
              <span className="text-[14px] font-bold text-violet-700 dark:text-violet-300">
                Level Up! You&apos;re now Level {level}
              </span>
            </div>
          )}
        </div>

        {/* Done button */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-black dark:bg-white py-3.5 text-[15px] font-semibold text-white dark:text-black transition-all duration-200 active:scale-[0.98] hover:bg-neutral-800 dark:hover:bg-neutral-100"
          >
            Nice!
          </button>
        </div>
      </div>
    </div>
  )
}