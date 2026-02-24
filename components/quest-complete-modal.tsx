"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Level math (mirrors DB functions) ──

function computeLevel(xp: number): number {
  if (xp < 25) return 1
  if (xp < 75) return 2
  return 3 + Math.floor((xp - 75) / 100)
}

function xpForLevel(lvl: number): number {
  if (lvl <= 1) return 0
  if (lvl === 2) return 25
  if (lvl === 3) return 75
  return 75 + (lvl - 3) * 100
}

function xpNeededForLevel(lvl: number): number {
  return xpForLevel(lvl + 1) - xpForLevel(lvl)
}

function progressInLevel(xp: number): { pct: number; current: number; needed: number } {
  const lvl = computeLevel(xp)
  const threshold = xpForLevel(lvl)
  const needed = xpNeededForLevel(lvl)
  const current = xp - threshold
  return { pct: needed > 0 ? (current / needed) * 100 : 100, current, needed }
}

// ── Props ──

interface QuestCompleteModalProps {
  questTitle: string
  questEmoji: string
  xpEarned: number
  totalXp: number
  onClose: () => void
}

// ── Component ──

export function QuestCompleteModal({
  questTitle,
  questEmoji,
  xpEarned,
  totalXp,
  onClose,
}: QuestCompleteModalProps) {
  const previousXp = totalXp - xpEarned
  const previousLevel = computeLevel(previousXp)
  const newLevel = computeLevel(totalXp)
  const leveledUp = newLevel > previousLevel
  // Could have leveled up multiple times (unlikely but handle it)
  const levelsGained = newLevel - previousLevel

  const prevProgress = progressInLevel(previousXp)
  const newProgress = progressInLevel(totalXp)

  // ── Animation state machine ──
  // Phases: "enter" → "fill_old" → "level_up" (if leveled) → "fill_new" → "done"
  const [phase, setPhase] = React.useState<
    "enter" | "show_xp" | "fill_old" | "level_up" | "fill_new" | "done"
  >("enter")
  const [barPct, setBarPct] = React.useState(prevProgress.pct)
  const [barLevel, setBarLevel] = React.useState(previousLevel)
  const [showLevelBanner, setShowLevelBanner] = React.useState(false)
  const [displayedXpCurrent, setDisplayedXpCurrent] = React.useState(prevProgress.current)
  const [displayedXpNeeded, setDisplayedXpNeeded] = React.useState(prevProgress.needed)

  React.useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  React.useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    // Phase 1: entrance
    timers.push(setTimeout(() => setPhase("show_xp"), 100))

    // Phase 2: show XP badge
    timers.push(setTimeout(() => setPhase("fill_old"), 600))

    if (leveledUp) {
      // Phase 3: fill bar to 100%
      timers.push(
        setTimeout(() => {
          setBarPct(100)
          setDisplayedXpCurrent(xpNeededForLevel(previousLevel))
          setDisplayedXpNeeded(xpNeededForLevel(previousLevel))
        }, 800)
      )

      // Phase 4: flash level up, reset bar
      timers.push(
        setTimeout(() => {
          setPhase("level_up")
          setShowLevelBanner(true)
          setBarLevel(newLevel)
          setBarPct(0)
          setDisplayedXpCurrent(0)
          setDisplayedXpNeeded(newProgress.needed)
        }, 1800)
      )

      // Phase 5: fill to new position
      timers.push(
        setTimeout(() => {
          setPhase("fill_new")
          setBarPct(newProgress.pct)
          setDisplayedXpCurrent(newProgress.current)
        }, 2400)
      )

      timers.push(setTimeout(() => setPhase("done"), 3200))
    } else {
      // No level up: just fill from old → new
      timers.push(
        setTimeout(() => {
          setBarPct(newProgress.pct)
          setDisplayedXpCurrent(newProgress.current)
          setDisplayedXpNeeded(newProgress.needed)
        }, 800)
      )

      timers.push(setTimeout(() => setPhase("done"), 1800))
    }

    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const entered = phase !== "enter"

  return (
    <div
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-6 transition-opacity duration-300",
        entered ? "opacity-100" : "opacity-0"
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={cn(
          "w-full max-w-[320px] overflow-hidden rounded-[2rem] border border-white/20 dark:border-white/[0.08] bg-white dark:bg-neutral-900 shadow-2xl transition-all duration-500",
          entered
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-90 translate-y-8"
        )}
      >
        {/* Header */}
        <div className="relative flex flex-col items-center pt-8 pb-2 px-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-neutral-400 dark:text-white/40 transition-colors hover:bg-black/10 dark:hover:bg-white/15"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Emoji — scales in */}
          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-4xl transition-all duration-700",
              entered ? "scale-100" : "scale-0"
            )}
          >
            {questEmoji}
          </div>

          <h2 className="mt-4 text-xl font-bold tracking-tight text-neutral-900 dark:text-white text-center">
            Quest Complete!
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-white/40 text-center">
            {questTitle}
          </p>
        </div>

        {/* XP earned card */}
        <div className="px-6 py-4">
          <div
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl py-4 transition-all duration-500",
              "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10",
              "border border-amber-200/40 dark:border-amber-500/15",
              phase !== "enter"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            <span className="text-2xl">✨</span>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: "#B8860B" }}
            >
              +{xpEarned} XP
            </span>
          </div>

          {/* Level progress bar */}
          <div
            className={cn(
              "mt-4 transition-all duration-500",
              phase !== "enter" && phase !== "show_xp"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-neutral-600 dark:text-white/50">
                Level {barLevel}
              </span>
              <span className="text-[11px] tabular-nums text-neutral-400 dark:text-white/30">
                {displayedXpCurrent} / {displayedXpNeeded} XP
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${barPct}%`,
                  background: "linear-gradient(90deg, #3478F6, #34C759)",
                  transition:
                    phase === "level_up"
                      ? "none" // instant reset on level-up
                      : "width 1s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </div>
          </div>

          {/* Level up banner */}
          {showLevelBanner && (
            <div
              className={cn(
                "mt-4 flex items-center justify-center gap-2 rounded-2xl py-3 transition-all duration-500",
                "bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10",
                "border border-violet-200/40 dark:border-violet-500/15",
                showLevelBanner
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-4 scale-95"
              )}
            >
              <span className="text-lg">🎉</span>
              <span className="text-[14px] font-bold text-violet-700 dark:text-violet-300">
                Level Up! You&apos;re now Level {newLevel}
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