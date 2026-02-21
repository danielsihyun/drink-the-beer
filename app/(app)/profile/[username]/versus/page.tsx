"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowLeft, Loader2 } from "lucide-react"
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
      <div className="relative h-12 w-12 overflow-hidden rounded-full shadow-sm ring-2 ring-white dark:ring-neutral-800 border border-neutral-100 dark:border-white/[0.06]">
        <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized />
      </div>
    )
  }
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full text-white font-semibold text-base shadow-sm"
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
      {/* Header */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            <div className="h-3 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-8 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="h-2 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            <div className="h-3 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
        </div>
      </div>
      <div className="mx-5 h-px bg-black/5 dark:bg-white/[0.04]" />
      {/* Rows */}
      <div className="px-5 py-4 space-y-5">
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

        // Fetch versus-specific stats (streak, unique types, avg/week, fav drink)
        const versusRes = await fetch(
          `/api/profile/${encodeURIComponent(username)}/versus`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        let versusData: any = {}
        if (versusRes.ok) {
          versusData = await versusRes.json()
        }

        const myP = myJson.profile
        const theirP = theirJson.profile

        setMyStats({
          id: myP.id,
          username: myP.username,
          displayName: myP.displayName,
          avatarUrl: myP.avatarUrl,
          totalDrinks: myP.drinkCount ?? 0,
          totalCheers: myP.totalCheersReceived ?? 0,
          friends: myP.friendCount ?? 0,
          medals: versusData.myMedals ?? 0,
          currentStreak: versusData.myStreak ?? 0,
          uniqueTypes: versusData.myUniqueTypes ?? 0,
          avgPerWeek: versusData.myAvgPerWeek ?? 0,
          favDrink: versusData.myFavDrink ?? null,
          favDrinkCount: versusData.myFavDrinkCount ?? 0,
        })

        setTheirStats({
          id: theirP.id,
          username: theirP.username,
          displayName: theirP.displayName,
          avatarUrl: theirP.avatarUrl,
          totalDrinks: theirP.drinkCount ?? 0,
          totalCheers: theirP.totalCheersReceived ?? 0,
          friends: theirP.friendCount ?? 0,
          medals: versusData.theirMedals ?? 0,
          currentStreak: versusData.theirStreak ?? 0,
          uniqueTypes: versusData.theirUniqueTypes ?? 0,
          avgPerWeek: versusData.theirAvgPerWeek ?? 0,
          favDrink: versusData.theirFavDrink ?? null,
          favDrinkCount: versusData.theirFavDrinkCount ?? 0,
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
          <div className="px-5 pt-6 pb-5">
            <div className="flex items-center justify-between">
              {/* Me */}
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <Avatar
                  name={myStats.displayName}
                  avatarUrl={myStats.avatarUrl}
                  gradient="linear-gradient(135deg, #3b82f6, #6366f1)"
                />
                <div className="text-center">
                  <div className="text-[13px] font-semibold text-neutral-900 dark:text-white leading-tight">
                    {myStats.displayName}
                  </div>
                  <div className="text-[11px] text-neutral-400 dark:text-white/30">You</div>
                </div>
              </div>

              {/* Score pill */}
              <div className="flex flex-col items-center mx-2 -mt-1">
                <div className="flex items-center gap-2 rounded-full bg-black/[0.03] dark:bg-white/[0.06] px-3.5 py-1.5 mb-1">
                  <span
                    className="text-[18px] font-bold tabular-nums"
                    style={{ color: myWins >= theirWins ? "#3b82f6" : "#a3a3a3" }}
                  >
                    {myWins}
                  </span>
                  <span className="text-[11px] font-medium text-neutral-300 dark:text-white/20">–</span>
                  <span
                    className="text-[18px] font-bold tabular-nums"
                    style={{ color: theirWins >= myWins ? "#f97316" : "#a3a3a3" }}
                  >
                    {theirWins}
                  </span>
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-400 dark:text-white/30">
                  Head to Head
                </span>
              </div>

              {/* Them */}
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <Avatar
                  name={theirStats.displayName}
                  avatarUrl={theirStats.avatarUrl}
                  gradient="linear-gradient(135deg, #f97316, #ef4444)"
                />
                <div className="text-center">
                  <div className="text-[13px] font-semibold text-neutral-900 dark:text-white leading-tight">
                    {theirStats.displayName}
                  </div>
                  <div className="text-[11px] text-neutral-400 dark:text-white/30">
                    @{theirStats.username}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-5 h-px bg-black/[0.04] dark:bg-white/[0.04]" />

          {/* Stat rows */}
          <div className="px-5 py-4 flex flex-col gap-4">
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