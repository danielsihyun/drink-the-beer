"use client"

import * as React from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type TimeRange = "week" | "month" | "year"
type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"

interface AnalyticsData {
  totalDrinks: number
  avgPerDay: number
  maxInDay: number
  mostCommonType: DrinkType
  drinksPerDay: { day: string; count: number }[]
  typeBreakdown: { type: DrinkType; count: number; percentage: number }[]
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 flex-1 animate-pulse rounded-full bg-foreground/10" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-foreground/10" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-foreground/10" />
      <div className="h-48 animate-pulse rounded-2xl bg-foreground/10" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed">
        <Plus className="h-8 w-8 opacity-50" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">No data yet</h3>
      <p className="mb-6 max-w-sm text-sm opacity-70">Log drinks to see your analytics and insights.</p>
      <Link
        href="/log"
        className="inline-flex items-center gap-2 rounded-full border bg-black px-4 py-2 text-sm font-medium text-white"
      >
        <Plus className="h-4 w-4" />
        Log Drink
      </Link>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-background/50 p-4">
      <p className="text-xs font-medium opacity-60">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function LineGraph({ data, maxValue }: { data: { day: string; count: number }[]; maxValue: number }) {
  const chartHeight = 160
  const padding = 20
  const effectiveHeight = chartHeight - padding * 2

  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = maxValue > 0 ? chartHeight - padding - (item.count / maxValue) * effectiveHeight : chartHeight - padding
    return { x, y, ...item }
  })

  const pathD = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
  const areaPathD = `${pathD} L 100 ${chartHeight - padding} L 0 ${chartHeight - padding} Z`

  return (
    <div className="rounded-2xl border bg-background/50 p-4">
      <h3 className="mb-4 text-sm font-semibold">Drinks per day</h3>
      <div className="relative" style={{ height: `${chartHeight}px` }}>
        <svg className="h-full w-full" viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none">
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={padding + (effectiveHeight * y) / 100}
              x2="100"
              y2={padding + (effectiveHeight * y) / 100}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={areaPathD} fill="black" fillOpacity="0.5" />
          <path
            d={pathD}
            fill="none"
            stroke="transparent"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-1">
          {data.map((item) => (
            <div key={item.day} className="flex flex-col items-center gap-0.5">
              <p className="text-[10px] font-medium opacity-60">{item.day}</p>
              <p className="text-xs font-bold">{item.count}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="h-6" />
    </div>
  )
}

function TypeBreakdown({ data }: { data: { type: DrinkType; count: number; percentage: number }[] }) {
  return (
    <div className="rounded-2xl border bg-background/50 p-4">
      <h3 className="mb-4 text-sm font-semibold">Drink type breakdown</h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.type}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{item.type}</span>
              <span className="opacity-60">
                {item.count} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-black transition-all" style={{ width: `${item.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function toLocalDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// ✅ Rolling windows so "week" recognizes past drinks (last 7 days),
// not “this calendar week”
function getRangeBounds(range: TimeRange) {
  const now = new Date()
  const end = addDays(startOfDay(now), 1) // tomorrow 00:00 local (exclusive)

  if (range === "week") {
    const start = addDays(startOfDay(now), -6) // last 7 days incl today
    return { start, end }
  }

  if (range === "month") {
    const start = addDays(startOfDay(now), -27) // last 28 days -> 4 buckets
    return { start, end }
  }

  // year: last 12 months-ish (365 days). We bucket by calendar month within this window.
  const start = addDays(startOfDay(now), -364)
  return { start, end }
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [range, setRange] = React.useState<TimeRange>("week")
  const [loading, setLoading] = React.useState(true)
  const [hasData, setHasData] = React.useState(false)
  const [data, setData] = React.useState<AnalyticsData | null>(null)

  const fetchAnalytics = React.useCallback(
    async (r: TimeRange) => {
      setLoading(true)

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        const user = userRes.user

        if (!user) {
          router.replace("/login?redirectTo=%2Fanalytics")
          return
        }

        // ✅ Keep historical window so past drinks are always recognized
        const startAll = new Date("2025-01-01T00:00:00.000Z")
        const endAll = new Date()

        const { data: rows, error: logsErr } = await supabase
          .from("drink_logs")
          .select("drink_type,created_at")
          .eq("user_id", user.id)
          .gte("created_at", startAll.toISOString())
          .lt("created_at", endAll.toISOString())
          .limit(5000)

        if (logsErr) throw logsErr

        const allLogs = (rows ?? []) as Array<{ drink_type: DrinkType; created_at: string }>

        if (allLogs.length === 0) {
          setHasData(false)
          setData(null)
          return
        }

        // ✅ Range subset used for avg + graph + “max in a day” + most common/type breakdown
        const { start: rangeStart, end: rangeEnd } = getRangeBounds(r)
        const rangeLogs = allLogs.filter((l) => {
          const t = new Date(l.created_at).getTime()
          return t >= rangeStart.getTime() && t < rangeEnd.getTime()
        })

        // Total drinks: keep as historical total (what you said you wanted preserved)
        const totalDrinks = allLogs.length

        // If the selected range has no logs, we still show analytics (not EmptyState),
        // but avg/graph will be 0 for that range.
        const dayCount = new Map<string, number>()
        const typeCount = new Map<DrinkType, number>()

        for (const l of rangeLogs) {
          const dt = new Date(l.created_at)
          const dayKey = toLocalDateKey(dt)
          dayCount.set(dayKey, (dayCount.get(dayKey) ?? 0) + 1)

          const t = l.drink_type
          typeCount.set(t, (typeCount.get(t) ?? 0) + 1)
        }

        const rangeDays = Math.max(
          1,
          Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000))
        )
        const avgPerDay = rangeLogs.length / rangeDays

        const maxInDay = dayCount.size > 0 ? Math.max(...Array.from(dayCount.values())) : 0

        const mostCommonType =
          Array.from(typeCount.entries())
            .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
            .map((x) => x[0])[0] ?? ("Beer" as DrinkType)

        let drinksPerDay: { day: string; count: number }[] = []

        if (r === "week") {
          drinksPerDay = Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(rangeStart, i)
            const label = d.toLocaleString("en-US", { weekday: "short" })
            const key = toLocalDateKey(d)
            return { day: label, count: dayCount.get(key) ?? 0 }
          })
        } else if (r === "month") {
          const buckets = [0, 0, 0, 0]
          for (const l of rangeLogs) {
            const dt = new Date(l.created_at)
            const daysFromStart = Math.floor((startOfDay(dt).getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000))
            const idx = Math.min(3, Math.max(0, Math.floor(daysFromStart / 7)))
            buckets[idx] += 1
          }
          drinksPerDay = [
            { day: "W1", count: buckets[0] },
            { day: "W2", count: buckets[1] },
            { day: "W3", count: buckets[2] },
            { day: "W4", count: buckets[3] },
          ]
        } else {
          // year-ish: bucket by calendar month inside the rolling window
          const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`

          const monthBuckets = new Map<string, number>()
          for (const l of rangeLogs) {
            const dt = new Date(l.created_at)
            const k = monthKey(dt)
            monthBuckets.set(k, (monthBuckets.get(k) ?? 0) + 1)
          }

          // Build last 12 calendar months ending this month
          const now = new Date()
          const months: { key: string; label: string }[] = []
          for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const key = monthKey(d)
            const label = d.toLocaleString("en-US", { month: "short" }) + " '" + String(d.getFullYear()).slice(-2)
            months.push({ key, label })
          }

          drinksPerDay = months.map((m) => ({ day: m.label, count: monthBuckets.get(m.key) ?? 0 }))
        }

        const typeBreakdown = Array.from(typeCount.entries())
          .filter(([, c]) => c > 0)
          .map(([type, count]) => ({
            type,
            count,
            percentage: rangeLogs.length > 0 ? (count / rangeLogs.length) * 100 : 0,
          }))
          .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))

        setHasData(true)
        setData({
          totalDrinks,
          avgPerDay,
          maxInDay,
          mostCommonType,
          drinksPerDay,
          typeBreakdown,
        })
      } catch {
        setHasData(false)
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [router, supabase]
  )

  React.useEffect(() => {
    fetchAnalytics(range)
  }, [fetchAnalytics, range])

  function handleRangeChange(newRange: TimeRange) {
    setRange(newRange)
  }

  const mostCommonLabel = React.useMemo(() => {
    if (!data) return ""
    const max = Math.max(0, ...data.typeBreakdown.map((t) => t.count))
    if (max === 0) return "—"
    const winners = data.typeBreakdown
      .filter((t) => t.count === max)
      .map((t) => t.type)
      .sort()
    return winners.join("/")
  }, [data])

  const maxDrinksPerDay = data ? Math.max(...data.drinksPerDay.map((d) => d.count)) : 0

  return (
    <div className="container max-w-2xl px-3 py-1.5">
      <h2 className="mb-4 text-2xl font-bold">Analytics</h2>

      {loading ? (
        <LoadingSkeleton />
      ) : !hasData || !data ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            {(["week", "month", "year"] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRangeChange(r)}
                className={[
                  "flex-1 rounded-full border px-4 py-2 text-sm font-medium capitalize transition-all",
                  range === r ? "border-black bg-black text-white" : "bg-transparent hover:bg-black/5",
                ].join(" ")}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="space-y-4 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard label="Total drinks" value={data.totalDrinks} />
              <SummaryCard label="Avg per day" value={data.avgPerDay.toFixed(2)} />
              <SummaryCard label="Most in a day" value={data.maxInDay} />
              <SummaryCard label="Most common" value={mostCommonLabel} />
            </div>

            <LineGraph data={data.drinksPerDay} maxValue={maxDrinksPerDay} />
            <TypeBreakdown data={data.typeBreakdown} />
          </div>
        </>
      )}
    </div>
  )
}
