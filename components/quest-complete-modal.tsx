"use client"

import * as React from "react"
import Image from "next/image"
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

export interface QuestCompleteModalProps {
  questTitle: string
  questEmoji: string
  xpEarned: number
  totalXp: number
  avatarUrl: string | null
  onClose: () => void
}

// ── Circular progress ring ──

const RING_SIZE = 140
const STROKE_WIDTH = 6
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function CircularProgress({
  pct,
  avatarUrl,
  level,
  animate,
}: {
  pct: number
  avatarUrl: string | null
  level: number
  animate: boolean
}) {
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE
  const clipId = React.useId()

  return (
    <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        className="-rotate-90"
      >
        {/* Background track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          className="text-black/[0.06] dark:text-white/[0.08]"
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`ring-grad-${clipId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3478F6" />
            <stop offset="100%" stopColor="#34C759" />
          </linearGradient>
        </defs>
        {/* Progress arc */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`url(#ring-grad-${clipId})`}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{
            transition: animate
              ? "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)"
              : "none",
          }}
        />
      </svg>

      {/* Avatar in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.08]"
          style={{ width: RING_SIZE - STROKE_WIDTH * 2 - 8, height: RING_SIZE - STROKE_WIDTH * 2 - 8 }}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="You"
              width={RING_SIZE - STROKE_WIDTH * 2 - 8}
              height={RING_SIZE - STROKE_WIDTH * 2 - 8}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-neutral-300 dark:text-white/20">
              👤
            </div>
          )}
        </div>
      </div>

      {/* Level badge */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-white/[0.08] shadow-sm px-2.5 py-0.5">
        <span className="text-[11px] font-bold tabular-nums text-neutral-700 dark:text-white/70">
          Lv. {level}
        </span>
      </div>
    </div>
  )
}

// ── Component ──

export function QuestCompleteModal({
  questTitle,
  questEmoji,
  xpEarned,
  totalXp,
  avatarUrl,
  onClose,
}: QuestCompleteModalProps) {
  const previousXp = totalXp - xpEarned
  const previousLevel = computeLevel(previousXp)
  const newLevel = computeLevel(totalXp)
  const leveledUp = newLevel > previousLevel

  const prevProgress = progressInLevel(previousXp)
  const newProgress = progressInLevel(totalXp)

  // ── Animation phases ──
  const [phase, setPhase] = React.useState<"enter" | "show_xp" | "fill" | "done">("enter")
  const [ringPct, setRingPct] = React.useState(prevProgress.pct)
  const [ringLevel, setRingLevel] = React.useState(previousLevel)
  const [ringAnimate, setRingAnimate] = React.useState(false)
  const [displayedCurrent, setDisplayedCurrent] = React.useState(prevProgress.current)
  const [displayedNeeded, setDisplayedNeeded] = React.useState(prevProgress.needed)

  React.useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  React.useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    // Phase 1: entrance
    timers.push(setTimeout(() => setPhase("show_xp"), 100))

    // Phase 2: start filling
    timers.push(setTimeout(() => {
      setPhase("fill")
      setRingAnimate(true)
    }, 600))

    if (leveledUp) {
      // Fill ring to 100% first
      timers.push(setTimeout(() => {
        setRingPct(100)
        setDisplayedCurrent(xpNeededForLevel(previousLevel))
        setDisplayedNeeded(xpNeededForLevel(previousLevel))
      }, 800))

      // Reset ring for new level, then fill to new position
      timers.push(setTimeout(() => {
        setRingAnimate(false)
        setRingPct(0)
        setRingLevel(newLevel)
        setDisplayedCurrent(0)
        setDisplayedNeeded(newProgress.needed)
      }, 2100))

      timers.push(setTimeout(() => {
        setRingAnimate(true)
        setRingPct(newProgress.pct)
        setDisplayedCurrent(newProgress.current)
      }, 2300))

      timers.push(setTimeout(() => setPhase("done"), 3500))
    } else {
      // Just fill to new position
      timers.push(setTimeout(() => {
        setRingPct(newProgress.pct)
        setDisplayedCurrent(newProgress.current)
        setDisplayedNeeded(newProgress.needed)
      }, 800))

      timers.push(setTimeout(() => setPhase("done"), 2200))
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
        {/* Header + close */}
        <div className="relative flex flex-col items-center pt-8 pb-2 px-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-neutral-400 dark:text-white/40 transition-colors hover:bg-black/10 dark:hover:bg-white/15"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Circular progress with avatar */}
          <div
            className={cn(
              "transition-all duration-700",
              entered ? "scale-100 opacity-100" : "scale-75 opacity-0"
            )}
          >
            <CircularProgress
              pct={ringPct}
              avatarUrl={avatarUrl}
              level={ringLevel}
              animate={ringAnimate}
            />
          </div>

          {/* XP counter below ring */}
          <p
            className={cn(
              "mt-3 text-[12px] tabular-nums text-neutral-400 dark:text-white/30 transition-all duration-500",
              phase !== "enter" ? "opacity-100" : "opacity-0"
            )}
          >
            {displayedCurrent} / {displayedNeeded} XP
          </p>

          <h2 className="mt-4 text-xl font-bold tracking-tight text-neutral-900 dark:text-white text-center">
            Quest Complete!
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-white/40 text-center">
            {questEmoji} {questTitle}
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