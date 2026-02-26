"use client"

import * as React from "react"
import Image from "next/image"

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

export function getLevelInfo(totalXp: number) {
  const level = computeLevel(totalXp)
  const threshold = xpForLevel(level)
  const needed = xpNeededForLevel(level)
  const current = totalXp - threshold
  const pct = needed > 0 ? (current / needed) * 100 : 100
  return { level, pct, current, needed }
}

// ── Component ──

const RING_SIZE = 88 // matches h-20 w-20 (80px) + ring padding
const STROKE_WIDTH = 3.5
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const AVATAR_SIZE = RING_SIZE - STROKE_WIDTH * 2 - 4 // inner avatar

export function ProfileLevelRing({
  avatarUrl,
  displayName,
  pct,
}: {
  avatarUrl: string | null
  displayName: string
  pct: number
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
        {/* Gradient */}
        <defs>
          <linearGradient id={`profile-ring-${clipId}`} x1="0%" y1="0%" x2="100%" y2="0%">
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
          stroke={`url(#profile-ring-${clipId})`}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </svg>

      {/* Avatar centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.08] shadow-sm border border-neutral-100 dark:border-white/[0.06]"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-neutral-400 dark:text-white/30">
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}