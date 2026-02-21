"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

// --- Types ---

type UserStats = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  totalDrinks: number
  totalCheers: number
  friends: number
  medals: number
  currentStreak: number
  uniqueTypes: number
  avgPerWeek: number
  favDrink: string | null
  favDrinkCount: number
}

const ROWS: { label: string; key: keyof UserStats; suffix?: string }[] = [
  { label: "Total Drinks", key: "totalDrinks" },
  { label: "Cheers Received", key: "totalCheers" },
  { label: "Friends", key: "friends" },
  { label: "Medals", key: "medals" },
  { label: "Streak", key: "currentStreak", suffix: "d" },
  { label: "Drink Types", key: "uniqueTypes" },
  { label: "Avg / Week", key: "avgPerWeek" },
]

// --- Helpers ---

function fmt(v: number, suffix = "") {
  if (typeof v === "number" && v % 1 !== 0) return v.toFixed(1) + suffix
  return v + suffix
}

function computeStatsFromLogs(logs: any[]): {
  uniqueTypes: number
  avgPerWeek: number
  currentStreak: number
  favDrink: string | null
  favDrinkCount: number
} {
  if (!logs.length) {
    return { uniqueTypes: 0, avgPerWeek: 0, currentStreak: 0, favDrink: null, favDrinkCount: 0 }
  }

  // Unique drink types
  const typeSet = new Set(logs.map((l: any) => l.drinkType ?? l.drink_type))
  const uniqueTypes = typeSet.size

  // Avg per week: span from first to last log
  const dates = logs.map((l: any) => new Date(l.createdAt ?? l.created_at).getTime()).filter((t) => !isNaN(t))
  const minDate = Math.min(...dates)
  const maxDate = Math.max(...dates)
  const weeks = Math.max(1, (maxDate - minDate) / (7 * 24 * 60 * 60 * 1000))
  const avgPerWeek = Math.round((logs.length / weeks) * 10) / 10

  // Current streak: consecutive days with at least one log, ending today or yesterday
  const daySet = new Set<string>()
  for (const l of logs) {
    const d = new Date(l.createdAt ?? l.created_at)
    if (!isNaN(d.getTime())) {
      daySet.add(d.toISOString().slice(0, 10))
    }
  }
  const sortedDays = [...daySet].sort().reverse()
  let currentStreak = 0
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const todayStr = today.toISOString().slice(0, 10)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (sortedDays[0] === todayStr || sortedDays[0] === yesterdayStr) {
    let checkDate = new Date(sortedDays[0])
    for (const day of sortedDays) {
      const expected = checkDate.toISOString().slice(0, 10)
      if (day === expected) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  // Favorite drink type
  const typeCounts: Record<string, number> = {}
  for (const l of logs) {
    const t = l.drinkType ?? l.drink_type ?? "Other"
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }
  let favDrink: string | null = null
  let favDrinkCount = 0
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > favDrinkCount) {
      favDrink = type
      favDrinkCount = count
    }
  }

  return { uniqueTypes, avgPerWeek, currentStreak, favDrink, favDrinkCount }
}

// --- Components ---

function Avatar({
  name,
  avatarUrl,
  gradient,
}: {
  name: string
  avatarUrl: string | null
  gradient: string
}) {
  if (avatarUrl) {
    return (
      <div className="relative h-16 w-16 overflow-hidden rounded-full shadow-sm ring-2 ring-white dark:ring-neutral-800 border border-neutral-100 dark:border-white/[0.06]">
        <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized />
      </div>
    )
  }
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full text-white font-semibold text-xl shadow-sm"
      style={{ background: gradient }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function Bar({
  myVal,
  theirVal,
  animated,
}: {
  myVal: number
  theirVal: number
  animated: boolean
}) {
  const total = myVal + theirVal || 1
  const myPct = (myVal / total) * 100
  const iWin = myVal > theirVal
  const tied = myVal === theirVal

  return (
    <div className="flex h-[6px] w-full gap-[2px] rounded-full overflow-hidden">
      <div
        className="rounded-l-full transition-all duration-700 ease-out"
        style={{
          width: animated ? `${myPct}%` : "50%",
          minWidth: myVal > 0 ? 6 : 0,
          backgroundColor: iWin && !tied ? "#3b82f6" : "#e5e5e5",
        }}
      />
      <div
        className="rounded-r-full transition-all duration-700 ease-out"
        style={{
          width: animated ? `${100 - myPct}%` : "50%",
          minWidth: theirVal > 0 ? 6 : 0,
          backgroundColor: !iWin && !tied ? "#f97316" : "#e5e5e5",
        }}
      />
    </div>
  )
}

function StatRow({
  label,
  myVal,
  theirVal,
  suffix = "",
  animated,
  delay,
}: {
  label: string
  myVal: number
  theirVal: number
  suffix?: string
  animated: boolean
  delay: number
}) {
  const iWin = myVal > theirVal
  const tied = myVal === theirVal

  return (
    <div
      style={{
        opacity: animated ? 1 : 0,
        transform: animated ? "translateY(0)" : "translateY(6px)",
        transition: `all 0.35s ease-out ${delay}ms`,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: iWin && !tied ? "#3b82f6" : "#a3a3a3" }}
        >
          {fmt(myVal, suffix)}
        </span>
        <span className="text-[11px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide">
          {label}
        </span>
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: !iWin && !tied ? "#f97316" : "#a3a3a3" }}
        >
          {fmt(theirVal, suffix)}
        </span>
      </div>
      <Bar myVal={myVal} theirVal={theirVal} animated={animated} />
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
      <div className="px-5 pt-8 pb-7">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2.5 flex-1">
            <div className="h-16 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="h-3.5 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-2.5 w-10 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-9 w-24 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-2.5 flex-1">
            <div className="h-16 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="h-3.5 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-2.5 w-10 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-5 h-px bg-black/5 dark:bg-white/[0.04]" />
      <div className="px-5 py-5 space-y-6">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-8 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-8 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
            <div className="h-[6px] w-full rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Main Page ---

export default function VersusPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const username = params.username as string

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [myStats, setMyStats] = React.useState<UserStats | null>(null)
  const [theirStats, setTheirStats] = React.useState<UserStats | null>(null)
  const [animated, setAnimated] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      setError(null)
      setLoading(true)

      try {
        const { data: sessRes } = await supabase.auth.getSession()
        const token = sessRes.session?.access_token
        const viewerId = sessRes.session?.user.id
        if (!token || !viewerId) {
          router.replace("/login")
          return
        }

        // Fetch both profiles in parallel
        const [myProfileRes, theirProfileRes] = await Promise.all([
          fetch("/api/profile/me", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/profile/${encodeURIComponent(username)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (!myProfileRes.ok) throw new Error("Failed to load your profile")
        if (!theirProfileRes.ok) throw new Error("Failed to load profile")

        const myJson = await myProfileRes.json()
        const theirJson = await theirProfileRes.json()

        const myP = myJson.profile
        const theirP = theirJson.profile

        // Compute stats from logs and achievements already in the API response
        const myComputed = computeStatsFromLogs(myJson.logs ?? [])
        const theirComputed = computeStatsFromLogs(theirJson.logs ?? [])

        const myMedals = (myJson.userAchievements ?? []).length
        const theirMedals = (theirJson.userAchievements ?? []).length

        setMyStats({
          id: myP.id,
          username: myP.username,
          displayName: myP.displayName,
          avatarUrl: myP.avatarUrl,
          totalDrinks: myP.drinkCount ?? 0,
          totalCheers: myP.totalCheersReceived ?? 0,
          friends: myP.friendCount ?? 0,
          medals: myMedals,
          currentStreak: myComputed.currentStreak,
          uniqueTypes: myComputed.uniqueTypes,
          avgPerWeek: myComputed.avgPerWeek,
          favDrink: myComputed.favDrink,
          favDrinkCount: myComputed.favDrinkCount,
        })

        setTheirStats({
          id: theirP.id,
          username: theirP.username,
          displayName: theirP.displayName,
          avatarUrl: theirP.avatarUrl,
          totalDrinks: theirP.drinkCount ?? 0,
          totalCheers: theirP.totalCheersReceived ?? 0,
          friends: theirP.friendCount ?? 0,
          medals: theirMedals,
          currentStreak: theirComputed.currentStreak,
          uniqueTypes: theirComputed.uniqueTypes,
          avgPerWeek: theirComputed.avgPerWeek,
          favDrink: theirComputed.favDrink,
          favDrinkCount: theirComputed.favDrinkCount,
        })
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router, supabase, username])

  // Trigger bar animations after data loads
  React.useEffect(() => {
    if (!loading && myStats && theirStats) {
      const t = setTimeout(() => setAnimated(true), 150)
      return () => clearTimeout(t)
    }
  }, [loading, myStats, theirStats])

  // Calculate score
  let myWins = 0
  let theirWins = 0
  if (myStats && theirStats) {
    ROWS.forEach(({ key }) => {
      const myVal = myStats[key] as number
      const theirVal = theirStats[key] as number
      if (myVal > theirVal) myWins++
      else if (myVal < theirVal) theirWins++
    })
  }

  return (
    <div className="container max-w-2xl px-0 sm:px-4 py-1.5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm p-2 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-neutral-700 dark:text-white/70" />
        </button>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Versus</h2>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : myStats && theirStats ? (
        <div className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
          {/* Header: avatars + score */}
          <div className="px-5 pt-8 pb-7">
            <div className="flex items-center justify-between">
              {/* Me */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <Avatar
                  name={myStats.displayName}
                  avatarUrl={myStats.avatarUrl}
                  gradient="linear-gradient(135deg, #3b82f6, #6366f1)"
                />
                <div className="text-center">
                  <div className="text-[14px] font-semibold text-neutral-900 dark:text-white leading-tight">
                    {myStats.displayName}
                  </div>
                  <div className="text-[11px] text-neutral-400 dark:text-white/30 mt-0.5">You</div>
                </div>
              </div>

              {/* Score pill */}
              <div className="flex items-center mx-2">
                <div className="flex items-center gap-2.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] px-4 py-2">
                  <span
                    className="text-[22px] font-bold tabular-nums"
                    style={{ color: myWins >= theirWins ? "#3b82f6" : "#a3a3a3" }}
                  >
                    {myWins}
                  </span>
                  <span className="text-[13px] font-medium text-neutral-300 dark:text-white/20">–</span>
                  <span
                    className="text-[22px] font-bold tabular-nums"
                    style={{ color: theirWins >= myWins ? "#f97316" : "#a3a3a3" }}
                  >
                    {theirWins}
                  </span>
                </div>
              </div>

              {/* Them */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <Avatar
                  name={theirStats.displayName}
                  avatarUrl={theirStats.avatarUrl}
                  gradient="linear-gradient(135deg, #f97316, #ef4444)"
                />
                <div className="text-center">
                  <div className="text-[14px] font-semibold text-neutral-900 dark:text-white leading-tight">
                    {theirStats.displayName}
                  </div>
                  <div className="text-[11px] text-neutral-400 dark:text-white/30 mt-0.5">
                    @{theirStats.username}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-5 h-px bg-black/[0.04] dark:bg-white/[0.04]" />

          {/* Stat rows */}
          <div className="px-5 py-5 flex flex-col gap-5">
            {ROWS.map((row, i) => (
              <StatRow
                key={row.key}
                label={row.label}
                myVal={myStats[row.key] as number}
                theirVal={theirStats[row.key] as number}
                suffix={row.suffix ?? ""}
                animated={animated}
                delay={200 + i * 70}
              />
            ))}

            {/* Favorite drink row */}
            {(myStats.favDrink || theirStats.favDrink) && (
              <div
                style={{
                  opacity: animated ? 1 : 0,
                  transform: animated ? "translateY(0)" : "translateY(6px)",
                  transition: `all 0.35s ease-out ${200 + ROWS.length * 70}ms`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[13px] font-semibold text-blue-500">
                      {myStats.favDrink ?? "—"}
                    </span>
                    {myStats.favDrinkCount > 0 && (
                      <span className="text-[11px] text-neutral-300 dark:text-white/20">
                        ×{myStats.favDrinkCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide">
                    Favorite
                  </span>
                  <div className="flex items-baseline gap-1">
                    {theirStats.favDrinkCount > 0 && (
                      <span className="text-[11px] text-neutral-300 dark:text-white/20">
                        ×{theirStats.favDrinkCount}
                      </span>
                    )}
                    <span className="text-[13px] font-semibold text-orange-500">
                      {theirStats.favDrink ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}