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
  difficulty: "easy" | "moderate" | "hard"
  detectionType: string
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
  completed = false,
  onHonorComplete,
  honorLoading = false,
  className,
}: {
  quest: Quest
  progress?: number
  completed?: boolean
  onHonorComplete?: () => void
  honorLoading?: boolean
  className?: string
}) {
  const q = quest
  const isHonor = q.detectionType === "honor"
  const [timeLeft, setTimeLeft] = React.useState(getTimeLeftLabel)
  const [animated, setAnimated] = React.useState(false)
  const descRef = React.useRef<HTMLParagraphElement>(null)
  const [descOverflows, setDescOverflows] = React.useState(false)
  const [marqueeDistance, setMarqueeDistance] = React.useState(0)

  React.useEffect(() => {
    const el = descRef.current
    if (!el) return
    const check = () => {
      const overflows = el.scrollWidth > el.parentElement!.clientWidth
      setDescOverflows(overflows)
      if (overflows) {
        setMarqueeDistance(el.scrollWidth - el.parentElement!.clientWidth)
      }
    }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [quest.description])

  React.useEffect(() => {
    setTimeLeft(getTimeLeftLabel())
    const interval = setInterval(() => setTimeLeft(getTimeLeftLabel()), 60_000)
    return () => clearInterval(interval)
  }, [])

  React.useEffect(() => {
    setAnimated(false)
    const t = setTimeout(() => setAnimated(true), 300)
    return () => clearTimeout(t)
  }, [progress, completed])

  const pct = completed ? 100 : Math.min((progress / q.target) * 100, 100)
  const isComplete = completed || progress >= q.target

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes quest-marquee {
          0%, 10% { transform: translateX(0); }
          80%, 100% { transform: translateX(var(--md)); }
        }
      `}} />
      <article
      className={cn(
        "group relative overflow-hidden rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300",
        className
      )}
    >
      <div className="px-4 pt-4 pb-3">
        {/* Time label — pinned top right */}
        <span className="absolute top-4 right-4 text-[11px] text-neutral-400 dark:text-white/30">
          {isComplete ? (
            <span className="text-emerald-500 dark:text-emerald-400 font-medium">✓ Complete</span>
          ) : (
            timeLeft
          )}
        </span>

        <div className="flex items-center gap-3 pr-14">
          {/* Emoji avatar */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-xl">
            {q.emoji}
          </div>

          <div className="flex-1 min-w-0">
            {/* Label row */}
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

            {/* Title + description */}
            <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight mt-1">
              {q.title}
            </h3>
            <div className="mt-0.5 overflow-hidden whitespace-nowrap relative">
              <p
                ref={descRef}
                className="text-[13px] text-neutral-500 dark:text-white/40 inline-block"
                style={descOverflows ? {
                  ["--md" as string]: `-${marqueeDistance}px`,
                  animationName: "quest-marquee",
                  animationDuration: `${Math.max(1.5, marqueeDistance / 75)}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  animationDelay: "1.5s",
                  animationFillMode: "both",
                } : undefined}
              >
                {q.description}
              </p>
            </div>
          </div>
        </div>

        {/* Honor quest: Mark Complete button */}
        {isHonor && !isComplete && (
          <button
            onClick={onHonorComplete}
            disabled={honorLoading}
            className={cn(
              "mt-3 w-full rounded-xl py-2 text-[13px] font-semibold transition-all duration-200 active:scale-[0.98]",
              honorLoading
                ? "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-400 dark:text-white/30 cursor-not-allowed"
                : "bg-[#3478F6]/10 dark:bg-[#3478F6]/15 text-[#3478F6] hover:bg-[#3478F6]/20 dark:hover:bg-[#3478F6]/25"
            )}
          >
            {honorLoading ? "Completing..." : "Mark Complete"}
          </button>
        )}
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
    </>
  )
}