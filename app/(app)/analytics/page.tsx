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
  const chartWidth = 100 // percentage
  const padding = 20
  const effectiveHeight = chartHeight - padding * 2

  // Calculate points for the line
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
          {/* Grid lines */}
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
        {/* Labels */}
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

function getRangeBounds(range: TimeRange) {
  const now = new Date()

  if (range === "week") {
    // Monday-start week
    const today = startOfDay(now)
    const day = today.getDay() // 0=Sun ... 6=Sat
    const offsetFromMonday = (day + 6) % 7
    const start = addDays(today, -offsetFromMonday)
    const end = addDays(start, 7)
    return { start, end }
  }

  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)
    return { start, end }
  }

  // year
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
  const end = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0)
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

        const { start, end } = getRangeBounds(r)

        const { data: rows, error: logsErr } = await supabase
          .from("drink_logs")
          .select("drink_type,created_at")
          .eq("user_id", user.id)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .limit(5000)

        if (logsErr) throw logsErr

        const logs = (rows ?? []) as Array<{ drink_type: DrinkType; created_at: string }>

        if (logs.length === 0) {
          setHasData(false)
          setData(null)
          return
        }

        // Daily counts for maxInDay + week bucketing
        const dayCount = new Map<string, number>()
        const typeCount = new Map<DrinkType, number>()

        for (const l of logs) {
          const dt = new Date(l.created_at)
          const dayKey = toLocalDateKey(dt)
          dayCount.set(dayKey, (dayCount.get(dayKey) ?? 0) + 1)

          // defensive: only count known types
          const t = l.drink_type
          typeCount.set(t, (typeCount.get(t) ?? 0) + 1)
        }

        const totalDrinks = logs.length

        const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
        const avgPerDay = totalDrinks / periodDays

        const maxInDay = Math.max(...Array.from(dayCount.values()))

        // Most common type (tie-breaker: deterministic alphabetical by label)
        const mostCommonType = Array.from(typeCount.entries())
          .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
          .map((x) => x[0])[0] as DrinkType

        // Drinks per day (display buckets)
        let drinksPerDay: { day: string; count: number }[] = []

        if (r === "week") {
          drinksPerDay = Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(start, i)
            const label = d.toLocaleString("en-US", { weekday: "short" })
            const key = toLocalDateKey(d)
            return { day: label, count: dayCount.get(key) ?? 0 }
          })
        } else if (r === "month") {
          // Force exactly W1..W4 (days 1-7, 8-14, 15-21, 22-end)
          const weekBuckets = [0, 0, 0, 0]
          for (const l of logs) {
            const dt = new Date(l.created_at)
            const dom = dt.getDate() // 1..31
            const idx = Math.min(3, Math.floor((dom - 1) / 7))
            weekBuckets[idx] += 1
          }
          drinksPerDay = [
            { day: "W1", count: weekBuckets[0] },
            { day: "W2", count: weekBuckets[1] },
            { day: "W3", count: weekBuckets[2] },
            { day: "W4", count: weekBuckets[3] },
          ]
        } else {
          // year: Jan..Dec
          const monthBuckets = Array.from({ length: 12 }).map(() => 0)
          for (const l of logs) {
            const dt = new Date(l.created_at)
            monthBuckets[dt.getMonth()] += 1
          }
          const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
          drinksPerDay = monthLabels.map((m, i) => ({ day: m, count: monthBuckets[i] }))
        }

        const typeBreakdown = Array.from(typeCount.entries())
          .filter(([, c]) => c > 0)
          .map(([type, count]) => ({
            type,
            count,
            percentage: totalDrinks > 0 ? (count / totalDrinks) * 100 : 0,
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
        // keep UI unchanged; treat errors like "no data" rather than adding new error UI
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
