"use client"

import * as React from "react"
import { Calendar, GlassWater, TrendingUp, Trophy, Star } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts"

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"

type DrinkLogRow = {
  id: string
  drink_type: string
  created_at: string
}

type DrinkEntry = {
  date: string
  count: number
  types: string[]
}

const timeRangeOptions: { key: TimeRange; label: string }[] = [
  { key: "1W", label: "Last 7 Days" },
  { key: "1M", label: "Last 30 Days" },
  { key: "3M", label: "Last 3 Months" },
  { key: "6M", label: "Last 6 Months" },
  { key: "1Y", label: "Last Year" },
  { key: "YTD", label: "Year to Date" },
]

const PIE_COLORS = ["#4ade80", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf"]

function transformDrinkLogs(logs: DrinkLogRow[]): DrinkEntry[] {
  const byDate: Record<string, { count: number; types: string[] }> = {}

  for (const log of logs) {
    const date = new Date(log.created_at).toISOString().split("T")[0]

    if (!byDate[date]) {
      byDate[date] = { count: 0, types: [] }
    }

    byDate[date].count += 1
    byDate[date].types.push(log.drink_type)
  }

  return Object.entries(byDate)
    .map(([date, data]) => ({
      date,
      count: data.count,
      types: data.types,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function getTimeRangeLabel(value: TimeRange): string {
  return timeRangeOptions.find((opt) => opt.key === value)?.label ?? value
}

function formatChartDate(dateStr: string, timeRange: TimeRange): string {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions =
    timeRange === "1W"
      ? { weekday: "short" }
      : timeRange === "1M" || timeRange === "3M"
        ? { month: "short", day: "numeric" }
        : { month: "short", year: "2-digit" }
  return date.toLocaleDateString("en-US", options)
}

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange
  onChange: (value: TimeRange) => void
}) {
  const [showMenu, setShowMenu] = React.useState(false)

  return (
    <div className="relative">
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

function KpiCards({
  data,
}: {
  data: {
    totalDrinks: number
    avgPerDay: number
    mostInADay: number
    mostCommon: string
  }
}) {
  const cards = [
    {
      label: "Total Drinks",
      value: data.totalDrinks.toString(),
      icon: GlassWater,
      color: "text-chart-1",
    },
    {
      label: "Avg per Day",
      value: data.avgPerDay.toFixed(1),
      icon: TrendingUp,
      color: "text-chart-2",
    },
    {
      label: "Most in a Day",
      value: data.mostInADay.toString(),
      icon: Trophy,
      color: "text-chart-3",
    },
    {
      label: "Most Common",
      value: data.mostCommon,
      icon: Star,
      color: "text-chart-4",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card border-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <card.icon className={cn("w-4 h-4", card.color)} />
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </div>
          <p className="text-2xl font-semibold text-foreground truncate">{card.value}</p>
        </Card>
      ))}
    </div>
  )
}

function DrinkChart({
  data,
  timeRange,
}: {
  data: DrinkEntry[]
  timeRange: TimeRange
}) {
  const [hoveredValue, setHoveredValue] = React.useState<number | null>(null)
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null)

  const chartData = data.map((entry) => ({
    date: entry.date,
    count: entry.count,
    displayDate: formatChartDate(entry.date, timeRange),
  }))

  const currentTotal = hoveredValue ?? data.reduce((sum, d) => sum + d.count, 0)
  const displayDate = hoveredDate ?? "Total"

  const primaryColor = "#4ade80"

  return (
    <Card className="bg-card border-border p-4 space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{displayDate}</p>
        <p className="text-4xl font-bold text-foreground">
          {currentTotal}
          <span className="text-lg font-normal text-muted-foreground ml-2">drinks</span>
        </p>
      </div>

      <div className="h-[200px] -mx-2 overflow-x-auto">
        <div style={{ minWidth: Math.max(chartData.length * 20, 300), height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              onMouseMove={(state) => {
                if (state?.activePayload?.[0]) {
                  setHoveredValue(state.activePayload[0].payload.count)
                  setHoveredDate(state.activePayload[0].payload.displayDate)
                }
              }}
              onMouseLeave={() => {
                setHoveredValue(null)
                setHoveredDate(null)
              }}
            >
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primaryColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayDate"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#666", fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    return (
                      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-sm font-medium text-foreground">
                          {payload[0].payload.count} drinks
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payload[0].payload.displayDate}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={primaryColor}
                strokeWidth={2}
                fill="url(#colorCount)"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: primaryColor,
                  stroke: "#1a1a2e",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  )
}

function DrinkBreakdown({ data }: { data: { name: string; value: number }[] }) {
  const total = React.useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  if (data.length === 0) {
    return (
      <Card className="bg-card border-border p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Drink Type Breakdown</h3>
        <p className="text-muted-foreground text-center py-8">No data available</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-6 space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Drink Type Breakdown</h3>

      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="w-full md:w-1/2 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    const item = payload[0].payload
                    const percentage = ((item.value / total) * 100).toFixed(1)
                    return (
                      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.value} ({percentage}%)
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full md:w-1/2 space-y-3">
          {data.map((item, index) => {
            const percentage = ((item.value / total) * 100).toFixed(1)
            return (
              <div key={item.name} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground truncate">{item.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">{percentage}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [allData, setAllData] = React.useState<DrinkEntry[]>([])
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M")

  React.useEffect(() => {
    async function load() {
      setError(null)
      setLoading(true)

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!userRes.user) {
          router.replace("/login?redirectTo=%2Fanalytics")
          return
        }

        const { data: logs, error: logsErr } = await supabase
          .from("drink_logs")
          .select("id, drink_type, created_at")
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: true })

        if (logsErr) throw logsErr

        const transformed = transformDrinkLogs((logs ?? []) as DrinkLogRow[])
        setAllData(transformed)
      } catch (e: any) {
        setError(e?.message ?? "Could not load analytics.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router, supabase])

  const filteredData = React.useMemo(() => {
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case "1W":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "1M":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "3M":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "6M":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      case "1Y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case "YTD":
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    return allData.filter((entry) => new Date(entry.date) >= startDate)
  }, [allData, timeRange])

  const kpiData = React.useMemo(() => {
    const totalDrinks = filteredData.reduce((sum, day) => sum + day.count, 0)
    const avgPerDay = filteredData.length > 0 ? totalDrinks / filteredData.length : 0
    const mostInADay = Math.max(...filteredData.map((d) => d.count), 0)

    const typeCounts: Record<string, number> = {}
    filteredData.forEach((day) => {
      day.types.forEach((type) => {
        typeCounts[type] = (typeCounts[type] || 0) + 1
      })
    })

    const mostCommon =
      Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"

    return { totalDrinks, avgPerDay, mostInADay, mostCommon }
  }, [filteredData])

  const breakdownData = React.useMemo(() => {
    const typeCounts: Record<string, number> = {}
    filteredData.forEach((day) => {
      day.types.forEach((type) => {
        typeCounts[type] = (typeCounts[type] || 0) + 1
      })
    })

    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }))
  }, [filteredData])

  if (loading) {
    return (
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Analytics</h2>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border bg-background/50 p-4">
                <div className="h-3 w-16 rounded bg-foreground/10" />
                <div className="mt-2 h-6 w-12 rounded bg-foreground/10" />
              </div>
            ))}
          </div>
          <div className="animate-pulse rounded-xl border bg-background/50 p-4 h-[280px]" />
          <div className="animate-pulse rounded-xl border bg-background/50 p-4 h-[280px]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Analytics</h2>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl px-3 py-1.5 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      <div className="space-y-4">
        <KpiCards data={kpiData} />
        <DrinkChart data={filteredData} timeRange={timeRange} />
        <DrinkBreakdown data={breakdownData} />
      </div>
    </div>
  )
}