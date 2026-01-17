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

type TimeRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"

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

type DrinkLogEntry = {
  timestamp: number
  cumulativeCount: number
  drinkType: string
  displayTime: string
}

const timeRangeOptions: { key: TimeRange; label: string }[] = [
  { key: "1D", label: "1D" },
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
]

const PIE_COLORS = ["#4ade80", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf"]

function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseLocalDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function transformDrinkLogs(logs: DrinkLogRow[]): DrinkEntry[] {
  const byDate: Record<string, { count: number; types: string[] }> = {}

  for (const log of logs) {
    const date = getLocalDateString(new Date(log.created_at))

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

function formatTooltipDate(dateStr: string): string {
  const date = parseLocalDateString(dateStr)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatAxisDate(dateStr: string): string {
  const date = parseLocalDateString(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatTimeWithDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
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
    displayDate: formatTooltipDate(entry.date),
  }))

  const currentTotal = hoveredValue ?? data.reduce((sum, d) => sum + d.count, 0)
  const displayDate = hoveredDate ?? "Total"

  const primaryColor = "#4ade80"

  const startDate = data.length > 0 ? data[0].date : ""
  const endDate = data.length > 0 ? data[data.length - 1].date : ""

  return (
    <Card className="bg-card border-border p-4 space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{displayDate}</p>
        <p className="text-4xl font-bold text-foreground">
          {currentTotal}
          <span className="text-lg font-normal text-muted-foreground ml-2">
            {currentTotal === 1 ? "drink" : "drinks"}
          </span>
        </p>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
          >
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              ticks={[startDate, endDate]}
              interval={0}
              tick={({ x, y, payload }) => {
                const isFirst = payload.value === startDate
                return (
                  <text
                    x={x}
                    y={y + 12}
                    fill="#666"
                    fontSize={12}
                    textAnchor={isFirst ? "start" : "end"}
                  >
                    {formatAxisDate(payload.value)}
                  </text>
                )
              }}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.[0]) {
                  const count = payload[0].payload.count
                  return (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-sm font-medium text-foreground">
                        {count} {count === 1 ? "drink" : "drinks"}
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
    </Card>
  )
}

function DrinkTimelineChart({
  data,
}: {
  data: DrinkLogEntry[]
}) {
  const totalDrinks = data.length
  const primaryColor = "#4ade80"

  if (data.length === 0) {
    return (
      <Card className="bg-card border-border p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Last 24 Hours</p>
          <p className="text-4xl font-bold text-foreground">
            0
            <span className="text-lg font-normal text-muted-foreground ml-2">drinks</span>
          </p>
        </div>
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          No drinks logged in the last 24 hours
        </div>
      </Card>
    )
  }

  const startTime = data[0].timestamp
  const endTime = data[data.length - 1].timestamp
  
  const isSameTime = startTime === endTime
  const minPadding = 10 * 60 * 1000 // 10 minutes
  const calculatedPadding = (endTime - startTime) * 0.05
  const padding = isSameTime ? 30 * 60 * 1000 : Math.max(calculatedPadding, minPadding)
  const domainStart = isSameTime ? startTime - 30 * 60 * 1000 : startTime
  const domainEnd = isSameTime ? endTime + 30 * 60 * 1000 : endTime
  const tickValues = isSameTime ? [startTime] : [startTime, endTime]

  return (
    <Card className="bg-card border-border p-4 space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="text-4xl font-bold text-foreground">
          {totalDrinks}
          <span className="text-lg font-normal text-muted-foreground ml-2">
            {totalDrinks === 1 ? "drink" : "drinks"}
          </span>
        </p>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
          >
            <defs>
              <linearGradient id="colorTimeline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={[domainStart, domainEnd]}
              axisLine={false}
              tickLine={false}
              ticks={tickValues}
              interval={0}
              tick={({ x, y, payload }) => {
                const isFirst = payload.value === startTime && !isSameTime
                return (
                  <text
                    x={x}
                    y={y + 12}
                    fill="#666"
                    fontSize={12}
                    textAnchor={isSameTime ? "middle" : isFirst ? "start" : "end"}
                  >
                    {formatTime(payload.value)}
                  </text>
                )
              }}
            />
            <YAxis hide domain={[0, totalDrinks + 0.5]} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.[0]) {
                  const entry = payload[0].payload as DrinkLogEntry
                  return (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-sm font-medium text-foreground">
                        Drink #{entry.cumulativeCount}: {entry.drinkType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.displayTime}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="stepAfter"
              dataKey="cumulativeCount"
              stroke={primaryColor}
              strokeWidth={2}
              fill="url(#colorTimeline)"
              dot={false}
              activeDot={{
                r: 6,
                fill: primaryColor,
                stroke: "#1a1a2e",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
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
  const [allLogs, setAllLogs] = React.useState<DrinkLogRow[]>([])
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

        const typedLogs = (logs ?? []) as DrinkLogRow[]
        const transformed = transformDrinkLogs(typedLogs)
        setAllData(transformed)
        setAllLogs(typedLogs)
      } catch (e: any) {
        setError(e?.message ?? "Could not load analytics.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router, supabase])

  const timelineData = React.useMemo((): DrinkLogEntry[] => {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const recentLogs = allLogs.filter((log) => {
      const logDate = new Date(log.created_at)
      return logDate >= twentyFourHoursAgo && logDate <= now
    })

    return recentLogs.map((log, index) => ({
      timestamp: new Date(log.created_at).getTime(),
      cumulativeCount: index + 1,
      drinkType: log.drink_type,
      displayTime: formatTimeWithDate(new Date(log.created_at).getTime()),
    }))
  }, [allLogs])

  const filteredData = React.useMemo(() => {
    if (timeRange === "1D") {
      return []
    }

    const now = new Date()
    const todayStr = getLocalDateString(now)
    let startDate: Date

    switch (timeRange) {
      case "1W":
        startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
        break
      case "1M":
        startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
        break
      case "3M":
        startDate = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000)
        break
      case "6M":
        startDate = new Date(now.getTime() - 179 * 24 * 60 * 60 * 1000)
        break
      case "1Y":
        startDate = new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000)
        break
      case "YTD":
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
    }
    startDate.setHours(0, 0, 0, 0)

    const dataByDate = new Map<string, DrinkEntry>()
    for (const entry of allData) {
      dataByDate.set(entry.date, entry)
    }

    const result: DrinkEntry[] = []
    const current = new Date(startDate)

    while (getLocalDateString(current) <= todayStr) {
      const dateStr = getLocalDateString(current)
      const existing = dataByDate.get(dateStr)

      if (existing) {
        result.push(existing)
      } else {
        result.push({ date: dateStr, count: 0, types: [] })
      }

      current.setDate(current.getDate() + 1)
    }

    return result
  }, [allData, timeRange])

  const kpiData = React.useMemo(() => {
    if (timeRange === "1D") {
      const typeCounts: Record<string, number> = {}
      timelineData.forEach((entry) => {
        typeCounts[entry.drinkType] = (typeCounts[entry.drinkType] || 0) + 1
      })
      const mostCommon =
        Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"

      return {
        totalDrinks: timelineData.length,
        avgPerDay: timelineData.length,
        mostInADay: timelineData.length,
        mostCommon,
      }
    }

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
  }, [filteredData, timelineData, timeRange])

  const breakdownData = React.useMemo(() => {
    if (timeRange === "1D") {
      const typeCounts: Record<string, number> = {}
      timelineData.forEach((entry) => {
        typeCounts[entry.drinkType] = (typeCounts[entry.drinkType] || 0) + 1
      })
      return Object.entries(typeCounts).map(([name, value]) => ({ name, value }))
    }

    const typeCounts: Record<string, number> = {}
    filteredData.forEach((day) => {
      day.types.forEach((type) => {
        typeCounts[type] = (typeCounts[type] || 0) + 1
      })
    })

    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }))
  }, [filteredData, timelineData, timeRange])

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
        {timeRange === "1D" ? (
          <DrinkTimelineChart data={timelineData} />
        ) : (
          <DrinkChart data={filteredData} timeRange={timeRange} />
        )}
        <DrinkBreakdown data={breakdownData} />
      </div>
    </div>
  )
}