"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowLeft, Calendar } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// --- Types ---

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"

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
  avgPerDay: number
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
  { label: "Avg / Day", key: "avgPerDay" },
]

const timeRangeOptions: { key: TimeRange; label: string }[] = [
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
]

// --- Helpers ---

function getTimeRangeLabel(value: TimeRange): string {
  return timeRangeOptions.find((opt) => opt.key === value)?.label ?? value
}

function getDateRangeStart(timeRange: TimeRange, now: Date): Date {
  let startDate: Date

  switch (timeRange) {
    case "1W":
      startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      break
    case "1M":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      break
    case "3M":
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      break
    case "6M":
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      break
    case "1Y":
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      break
    case "YTD":
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  }
  startDate.setHours(0, 0, 0, 0)
  return startDate
}

function fmt(v: number, suffix = "") {
  if (typeof v === "number" && v % 1 !== 0) return v.toFixed(1) + suffix
  return v + suffix
}

function filterLogsByTimeRange(logs: any[], timeRange: TimeRange): any[] {
  const now = new Date()
  const start = getDateRangeStart(timeRange, now)
  return logs.filter((l) => {
    const d = new Date(l.createdAt ?? l.created_at)
    return d >= start
  })
}

function computeStatsFromLogs(logs: any[]): {
  totalDrinks: number
  uniqueTypes: number
  avgPerDay: number
  currentStreak: number
  favDrink: string | null
  favDrinkCount: number
} {
  if (!logs.length) {
    return { totalDrinks: 0, uniqueTypes: 0, avgPerDay: 0, currentStreak: 0, favDrink: null, favDrinkCount: 0 }
  }

  const totalDrinks = logs.length

  const typeSet = new Set(logs.map((l: any) => l.drinkType ?? l.drink_type))
  const uniqueTypes = typeSet.size

  const dates = logs.map((l: any) => new Date(l.createdAt ?? l.created_at).getTime()).filter((t) => !isNaN(t))
  const minDate = Math.min(...dates)
  const maxDate = Math.max(...dates)
  const days = Math.max(1, (maxDate - minDate) / (24 * 60 * 60 * 1000))
  const avgPerDay = Math.round((logs.length / days) * 100) / 100

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

  return { totalDrinks, uniqueTypes, avgPerDay, currentStreak, favDrink, favDrinkCount }
}

// --- Components ---

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange
  onChange: (value: TimeRange) => void
}) {
  const [showMenu, setShowMenu] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showMenu])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"
      >
        <Calendar className="h-4 w-4" />
        {getTimeRangeLabel(value)}
      </button>

      {showMenu ? (
        <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-xl border bg-background shadow-lg">
          {timeRangeOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                onChange(opt.key)
                setShowMenu(false)
              }}
              className={cn(
                "w-full px-4 py-3 text-left text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-foreground/5",
                value === opt.key ? "font-semibold" : ""
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Avatar({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl: string | null
}) {
  if (avatarUrl) {
    return (
      <div className="relative h-20 w-20 overflow-hidden rounded-full shadow-sm ring-2 ring-white dark:ring-neutral-800 border border-neutral-100 dark:border-white/[0.06]">
        <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized />
      </div>
    )
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-2 ring-white dark:ring-neutral-800 shadow-sm">
      <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-neutral-400 dark:text-white/30">
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
      </svg>
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
  const tied = myVal === theirVal

  return (
    <div className="flex h-[6px] w-full gap-[2px] rounded-full overflow-hidden">
      <div
        className="rounded-l-full transition-all duration-700 ease-out"
        style={{
          width: animated ? `${myPct}%` : "50%",
          minWidth: myVal > 0 ? 6 : 0,
          backgroundColor: myVal > theirVal && !tied ? "#3478F6" : "#e5e5e5",
        }}
      />
      <div
        className="rounded-r-full transition-all duration-700 ease-out"
        style={{
          width: animated ? `${100 - myPct}%` : "50%",
          minWidth: theirVal > 0 ? 6 : 0,
          backgroundColor: theirVal > myVal && !tied ? "#3478F6" : "#e5e5e5",
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
  const tied = myVal === theirVal

  return (
    <div
      style={{
        opacity: animated ? 1 : 0,
        transform: animated ? "translateY(0)" : "translateY(6px)",
        transition: `all 0.35s ease-out ${delay}ms`,
      }}
    >
      <div className="relative flex items-center justify-between mb-1.5">
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: myVal > theirVal && !tied ? "#3478F6" : "#a3a3a3" }}
        >
          {fmt(myVal, suffix)}
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide">
          {label}
        </span>
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: theirVal > myVal && !tied ? "#3478F6" : "#a3a3a3" }}
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
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="h-20 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="h-3.5 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-2.5 w-10 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
          <div className="flex items-center">
            <div className="h-10 w-24 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="h-20 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
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
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M")
  const [animated, setAnimated] = React.useState(false)

  // Raw data — fetched once, filtered reactively
  const [myProfile, setMyProfile] = React.useState<any>(null)
  const [theirProfile, setTheirProfile] = React.useState<any>(null)
  const [myLogs, setMyLogs] = React.useState<any[]>([])
  const [theirLogs, setTheirLogs] = React.useState<any[]>([])
  const [myAchievements, setMyAchievements] = React.useState<any[]>([])
  const [theirAchievements, setTheirAchievements] = React.useState<any[]>([])
  const [myRawJson, setMyRawJson] = React.useState<any>(null)
  const [theirRawJson, setTheirRawJson] = React.useState<any>(null)
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

        setMyProfile(myJson.profile)
        setTheirProfile(theirJson.profile)
        setMyRawJson(myJson)
        setTheirRawJson(theirJson)

        // Debug: check what cheers fields exist
        console.log("[Versus] myProfile keys:", Object.keys(myJson.profile))
        console.log("[Versus] myProfile cheers fields:", {
          totalCheersReceived: myJson.profile.totalCheersReceived,
          cheersReceived: myJson.profile.cheersReceived,
          totalCheers: myJson.profile.totalCheers,
        })
        console.log("[Versus] theirProfile cheers fields:", {
          totalCheersReceived: theirJson.profile.totalCheersReceived,
          cheersReceived: theirJson.profile.cheersReceived,
          totalCheers: theirJson.profile.totalCheers,
        })

        setMyLogs(myJson.logs ?? [])
        setTheirLogs(theirJson.logs ?? [])
        setMyAchievements(myJson.userAchievements ?? [])
        setTheirAchievements(theirJson.userAchievements ?? [])
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router, supabase, username])

  // Compute stats reactively based on time range
  const myStats = React.useMemo<UserStats | null>(() => {
    if (!myProfile) return null

    const filtered = filterLogsByTimeRange(myLogs, timeRange)
    const computed = computeStatsFromLogs(filtered)

    // Cheers count can live at different levels depending on the API endpoint
    const cheers = myProfile.totalCheersReceived
      ?? myProfile.cheersReceived
      ?? myProfile.totalCheers
      ?? myRawJson?.totalCheersReceived
      ?? myRawJson?.cheersReceived
      ?? 0

    return {
      id: myProfile.id,
      username: myProfile.username,
      displayName: myProfile.displayName,
      avatarUrl: myProfile.avatarUrl,
      totalDrinks: computed.totalDrinks,
      totalCheers: cheers,
      friends: myProfile.friendCount ?? 0,
      medals: myAchievements.length,
      currentStreak: computed.currentStreak,
      uniqueTypes: computed.uniqueTypes,
      avgPerDay: computed.avgPerDay,
      favDrink: computed.favDrink,
      favDrinkCount: computed.favDrinkCount,
    }
  }, [myProfile, myLogs, myAchievements, myRawJson, timeRange])

  const theirStats = React.useMemo<UserStats | null>(() => {
    if (!theirProfile) return null

    const filtered = filterLogsByTimeRange(theirLogs, timeRange)
    const computed = computeStatsFromLogs(filtered)

    const cheers = theirProfile.totalCheersReceived
      ?? theirProfile.cheersReceived
      ?? theirProfile.totalCheers
      ?? theirRawJson?.totalCheersReceived
      ?? theirRawJson?.cheersReceived
      ?? 0

    return {
      id: theirProfile.id,
      username: theirProfile.username,
      displayName: theirProfile.displayName,
      avatarUrl: theirProfile.avatarUrl,
      totalDrinks: computed.totalDrinks,
      totalCheers: cheers,
      friends: theirProfile.friendCount ?? 0,
      medals: theirAchievements.length,
      currentStreak: computed.currentStreak,
      uniqueTypes: computed.uniqueTypes,
      avgPerDay: computed.avgPerDay,
      favDrink: computed.favDrink,
      favDrinkCount: computed.favDrinkCount,
    }
  }, [theirProfile, theirLogs, theirAchievements, theirRawJson, timeRange])

  // Re-trigger bar animations when time range changes
  React.useEffect(() => {
    setAnimated(false)
    if (!loading && myStats && theirStats) {
      const t = setTimeout(() => setAnimated(true), 150)
      return () => clearTimeout(t)
    }
  }, [loading, myStats, theirStats, timeRange])

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
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
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
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center justify-between">
              {/* Me */}
              <div className="flex flex-col items-center flex-1">
                <Avatar
                  name={myStats.displayName}
                  avatarUrl={myStats.avatarUrl}
                />
                <div className="text-center mt-3">
                  <div className="text-[14px] font-semibold text-neutral-900 dark:text-white leading-tight">
                    {myStats.displayName}
                  </div>
                  <div className="text-[11px] text-neutral-400 dark:text-white/30 mt-0.5">You</div>
                </div>
              </div>

              {/* Score pill */}
              <div className="flex items-center mx-2 -mt-6">
                <div className="flex items-center gap-2.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] px-4 py-2">
                  <span
                    className="text-[22px] font-bold tabular-nums"
                    style={{ color: myWins >= theirWins ? "#3478F6" : "#a3a3a3" }}
                  >
                    {myWins}
                  </span>
                  <span className="text-[13px] font-medium text-neutral-300 dark:text-white/20">–</span>
                  <span
                    className="text-[22px] font-bold tabular-nums"
                    style={{ color: theirWins >= myWins ? "#3478F6" : "#a3a3a3" }}
                  >
                    {theirWins}
                  </span>
                </div>
              </div>

              {/* Them */}
              <div className="flex flex-col items-center flex-1">
                <Avatar
                  name={theirStats.displayName}
                  avatarUrl={theirStats.avatarUrl}
                />
                <div className="text-center mt-3">
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
                <div className="relative flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[13px] font-semibold text-neutral-900 dark:text-white">
                      {myStats.favDrink ?? "—"}
                    </span>
                    {myStats.favDrinkCount > 0 && (
                      <span className="text-[11px] text-neutral-300 dark:text-white/20">
                        ×{myStats.favDrinkCount}
                      </span>
                    )}
                  </div>
                  <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide">
                    Favorite
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[13px] font-semibold text-neutral-900 dark:text-white">
                      {theirStats.favDrink ?? "—"}
                    </span>
                    {theirStats.favDrinkCount > 0 && (
                      <span className="text-[11px] text-neutral-300 dark:text-white/20">
                        ×{theirStats.favDrinkCount}
                      </span>
                    )}
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