"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ── Types ──

export type Quest = {
  id: string
  emoji: string
  title: string
  description: string
  target: number
  xp: number
}

// ── Static placeholder (remove once wired to DB) ──

const PLACEHOLDER_QUEST: Quest = {
  id: "quest_001",
  emoji: "🍹",
  title: "Tequila Tuesday",
  description: "Order 2 tequila-based drinks tonight",
  target: 2,
  xp: 50,
}

// ── Time helper ──

function getTimeLeftLabel(): string {
  const now = new Date()
  const estNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  )
  const midnight = new Date(estNow)
  midnight.setHours(24, 0, 0, 0)
  const diff = midnight.getTime() - estNow.getTime()
  const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)))
  const minutes = Math.max(
    0,
    Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  )
  if (hours > 0) return `${hours}h left`
  if (minutes > 0) return `${minutes}m left`
  return "Expiring soon"
}

// ── Component ──

export function TonightsQuestCard({
  quest,
  progress = 0,
  className,
}: {
  quest?: Quest
  progress?: number
  className?: string
}) {
  const q = quest ?? PLACEHOLDER_QUEST
  const [timeLeft, setTimeLeft] = React.useState(getTimeLeftLabel)
  const [animated, setAnimated] = React.useState(false)

  React.useEffect(() => {
    setTimeLeft(getTimeLeftLabel())
    const interval = setInterval(() => setTimeLeft(getTimeLeftLabel()), 60_000)
    return () => clearInterval(interval)
  }, [])

  React.useEffect(() => {
    setAnimated(false)
    const t = setTimeout(() => setAnimated(true), 300)
    return () => clearTimeout(t)
  }, [progress])

  const pct = Math.min((progress / q.target) * 100, 100)
  const isComplete = progress >= q.target

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300",
        className
      )}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Emoji avatar */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-xl">
            {q.emoji}
          </div>

          <div className="flex-1 min-w-0">
            {/* Top row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3478F6]">
                  Tonight&apos;s Quest
                </span>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{
                    background: "rgba(255, 214, 10, 0.15)",
                    color: "#B8860B",
                  }}
                >
                  +{q.xp} XP
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 dark:text-white/30 shrink-0 ml-2">
                {isComplete ? "✓ Complete" : timeLeft}
              </span>
            </div>

            {/* Title + description */}
            <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight mt-1">
              {q.title}
            </h3>
            <p className="text-[13px] text-neutral-500 dark:text-white/40 mt-0.5">
              {q.description}
            </p>
          </div>
        </div>
      </div>

      {/* Full-width progress bar at the bottom of the card */}
      <div className="h-[5px] w-full bg-black/[0.04] dark:bg-white/[0.06]">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: animated ? `${pct}%` : "0%",
            backgroundColor: isComplete ? "#34C759" : "#3478F6",
          }}
        />
      </div>
    </article>
  )
}