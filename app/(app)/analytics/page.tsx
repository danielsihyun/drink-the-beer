"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Calendar, GlassWater, TrendingUp, TrendingDown, Trophy, Star, Flame, CalendarDays, Clock, Sun, Moon, Sunrise, Sunset, Zap, Users, Award, Target } from "lucide-react"
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
  BarChart,
  Bar,
} from "recharts"

// Custom clinking wine glasses icon
interface CheersIconProps {
  filled?: boolean
  className?: string
}

function CheersIcon({ filled = false, className }: CheersIconProps) {
  return (
    <svg
      viewBox="0 -4 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Left wine glass - rotated when filled, straight when not */}
      <g transform={filled ? "rotate(15, 8, 16)" : "translate(2,0)"}>
        {/* Liquid FIRST (behind glass) - taller fill */}
        {filled && (
          <path
            d="M5 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2L5 9z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        {/* Glass outline SECOND (on top) */}
        <path
          d="M4 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3L4 6z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M8 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M5 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      {/* Right wine glass - rotated when filled, straight when not */}
      <g transform={filled ? "rotate(-15, 24, 16)" : "translate(-2,0)"}>
        {/* Liquid FIRST (behind glass) - taller fill */}
        {filled && (
          <path
            d="M21 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2l-.8-4z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        {/* Glass outline SECOND (on top) */}
        <path
          d="M20 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3l-1-7z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M24 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M21 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      {/* Clink sparkles - only show when filled */}
      {filled && (
        <g stroke="#fbbf24">
          {/* Center line - vertical */}
          <path d="M16 -0.5v3" strokeWidth="1.5" />
          {/* Left line - mirrored from right */}
          <g transform="translate(16, 0) scale(-1, 1) translate(-16, 0)">
            <path d="M19 3l2-2" strokeWidth="1.5" />
          </g>
          {/* Right line - angled +45° (going up-right) */}
          <path d="M19 3l2-2" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  )
}

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"

type DrinkLogRow = {
  id: string
  drink_type: string
  created_at: string
  caption: string | null
}

type DrinkEntry = {
  date: string
  count: number
  types: string[]
  hours: number[]
  drinkIds: string[]
  captions: (string | null)[]
}

type CheersStats = {
  totalReceived: number
  totalGiven: number
  avgPerPost: number
  mostCheeredPost: { id: string; count: number; caption: string | null; date: string } | null
  topCheerersToMe: { oderId: string; username: string; displayName: string; avatarUrl: string | null; count: number }[]
  topCheeredByMe: { oderId: string; username: string; displayName: string; avatarUrl: string | null; count: number }[]
}

type PersonalRecords = {
  biggestDay: { date: string; count: number } | null
  earliestDrink: { time: string; date: string } | null
  latestDrink: { time: string; date: string } | null
}

const timeRangeOptions: { key: TimeRange; label: string }[] = [
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
]

const PIE_COLORS = ["#4ade80", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf"]
const STACKED_COLORS: Record<string, string> = {
  "Beer": "#fbbf24",
  "Wine": "#a855f7",
  "Cocktail": "#ec4899",
  "Shot": "#ef4444",
  "Seltzer": "#22d3ee",
  "Spirit": "#f97316",
  "Other": "#6b7280",
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

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
  const byDate: Record<string, { count: number; types: string[]; hours: number[]; drinkIds: string[]; captions: (string | null)[] }> = {}

  for (const log of logs) {
    const logDate = new Date(log.created_at)
    const date = getLocalDateString(logDate)
    const hour = logDate.getHours()

    if (!byDate[date]) {
      byDate[date] = { count: 0, types: [], hours: [], drinkIds: [], captions: [] }
    }

    byDate[date].count += 1
    byDate[date].types.push(log.drink_type)
    byDate[date].hours.push(hour)
    byDate[date].drinkIds.push(log.id)
    byDate[date].captions.push(log.caption)
  }

  return Object.entries(byDate)
    .map(([date, data]) => ({
      date,
      count: data.count,
      types: data.types,
      hours: data.hours,
      drinkIds: data.drinkIds,
      captions: data.captions,
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

function formatShortDate(dateStr: string): string {
  const date = parseLocalDateString(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function getDateRangeForTimeRange(timeRange: TimeRange, now: Date): { start: Date; end: Date } {
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

  return { start: startDate, end: now }
}

function getPreviousPeriodRange(timeRange: TimeRange, now: Date): { start: Date; end: Date } {
  const currentRange = getDateRangeForTimeRange(timeRange, now)
  const periodLength = currentRange.end.getTime() - currentRange.start.getTime()
  
  const prevEnd = new Date(currentRange.start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - periodLength)
  
  return { start: prevStart, end: prevEnd }
}

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
  const mostCommonRef = React.useRef<HTMLParagraphElement>(null)
  const [fontSize, setFontSize] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    setFontSize(null)
  }, [data.mostCommon])

  React.useEffect(() => {
    if (mostCommonRef.current && fontSize === null) {
      const element = mostCommonRef.current
      
      if (element.scrollWidth > element.clientWidth) {
        const ratio = element.clientWidth / element.scrollWidth
        const baseSize = 24
        const newSize = Math.floor(baseSize * ratio)
        setFontSize(Math.max(newSize, 12))
      }
    }
  }, [data.mostCommon, fontSize])

  const cards = [
    {
      label: "Total Drinks",
      value: data.totalDrinks.toString(),
      icon: GlassWater,
      color: "text-chart-1",
    },
    {
      label: "Avg per Day",
      value: data.avgPerDay.toFixed(2),
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
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => {
        const isMostCommon = card.label === "Most Common"
        return (
          <Card key={card.label} className="bg-card border-border px-3 pt-3 pb-2 shadow-none">
            <div className="flex items-center gap-2">
              <card.icon className={cn("w-4 h-4", card.color)} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p
              ref={isMostCommon ? mostCommonRef : undefined}
              className="font-semibold text-foreground truncate -mt-4 h-9 flex items-center text-2xl"
              style={isMostCommon && fontSize ? { fontSize: `${fontSize}px` } : undefined}
            >
              {card.value}
            </p>
          </Card>
        )
      })}
    </div>
  )
}

function StreakAndActivityCards({
  data,
}: {
  data: {
    longestStreak: number
    daysSinceLastDrink: number
  }
}) {
  const cards = [
    {
      label: "Longest Streak",
      value: data.longestStreak.toString(),
      suffix: data.longestStreak === 1 ? "day" : "days",
      icon: Flame,
      color: "text-orange-500",
    },
    {
      label: "Days Since Last Drink",
      value: data.daysSinceLastDrink.toString(),
      suffix: data.daysSinceLastDrink === 1 ? "day" : "days",
      icon: CalendarDays,
      color: "text-green-500",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card border-border px-3 pt-3 pb-2 shadow-none">
          <div className="flex items-center gap-2">
            <card.icon className={cn("w-4 h-4", card.color)} />
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </div>
          <div className="-mt-4 h-9 flex items-baseline gap-1.5">
            <p className="font-semibold text-foreground text-2xl">
              {card.value}
            </p>
            <span className="text-xs text-muted-foreground">{card.suffix}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}

function PaceIndicatorCard({
  currentTotal = 0,
  previousTotalAtSamePoint = 0,
  previousPeriodTotal = 0,
  currentAvgPerDay = 0,
  previousAvgPerDay = 0,
  currentActiveDays = 0,
  previousActiveDays = 0,
  timeRange,
  daysElapsed = 0,
  totalDays = 0,
}: {
  currentTotal: number
  previousTotalAtSamePoint: number
  previousPeriodTotal: number
  currentAvgPerDay: number
  previousAvgPerDay: number
  currentActiveDays: number
  previousActiveDays: number
  timeRange: TimeRange
  daysElapsed: number
  totalDays: number
}) {
  const diff = currentTotal - previousTotalAtSamePoint
  const isAhead = diff > 0
  const isBehind = diff < 0
  const percentComplete = totalDays > 0 ? Math.round((daysElapsed / totalDays) * 100) : 0

  const periodLabel = {
    "1W": "last week",
    "1M": "last month",
    "3M": "last 3 months",
    "6M": "last 6 months",
    "1Y": "last year",
    "YTD": "same time last year",
  }[timeRange]

  const periodNoun = {
    "1W": "week",
    "1M": "month",
    "3M": "3 months",
    "6M": "6 months",
    "1Y": "year",
    "YTD": "period",
  }[timeRange]

  // Comparison metrics
  const totalDiff = currentTotal - previousPeriodTotal
  const totalPercent = previousPeriodTotal > 0 
    ? Math.round((totalDiff / previousPeriodTotal) * 100) 
    : currentTotal > 0 ? 100 : 0
  const avgDiff = (currentAvgPerDay || 0) - (previousAvgPerDay || 0)
  const activeDiff = currentActiveDays - previousActiveDays

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-purple-500" />
        <h3 className="text-sm font-medium text-muted-foreground">Pace Indicator</h3>
      </div>
      
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-3xl font-bold">{currentTotal}</p>
          <p className="text-xs text-muted-foreground">drinks so far</p>
        </div>
        <div className="text-right">
          <p className={cn(
            "text-lg font-semibold flex items-center gap-1 justify-end",
            isAhead && "text-red-400",
            isBehind && "text-green-400",
            !isAhead && !isBehind && "text-muted-foreground"
          )}>
            {isAhead && <TrendingUp className="h-4 w-4" />}
            {isBehind && <TrendingDown className="h-4 w-4" />}
            {diff > 0 ? `+${diff}` : diff}
          </p>
          <p className="text-xs text-muted-foreground">vs this point {periodLabel}</p>
        </div>
      </div>

      <div className="space-y-1 mb-4">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Period progress</span>
          <span>{percentComplete}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>

      {/* Comparison to full previous period */}
      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground mb-2">vs Previous {periodNoun}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{currentTotal}</span>
              <span className={cn(
                "text-xs",
                totalDiff > 0 && "text-red-400",
                totalDiff < 0 && "text-green-400",
                totalDiff === 0 && "text-muted-foreground"
              )}>
                {totalDiff > 0 ? `+${totalDiff}` : totalDiff}
                {totalPercent !== 0 && ` (${totalPercent > 0 ? "+" : ""}${totalPercent}%)`}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Avg/Day</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{(currentAvgPerDay || 0).toFixed(1)}</span>
              <span className={cn(
                "text-xs",
                avgDiff > 0 && "text-red-400",
                avgDiff < 0 && "text-green-400",
                avgDiff === 0 && "text-muted-foreground"
              )}>
                {avgDiff >= 0 ? `+${avgDiff.toFixed(2)}` : avgDiff.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Active Days</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{currentActiveDays}</span>
              <span className={cn(
                "text-xs",
                activeDiff > 0 && "text-red-400",
                activeDiff < 0 && "text-green-400",
                activeDiff === 0 && "text-muted-foreground"
              )}>
                {activeDiff > 0 ? `+${activeDiff}` : activeDiff}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function DrinkChart({ data }: { data: DrinkEntry[] }) {
  const totalDrinks = data.reduce((sum, d) => sum + d.count, 0)
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  const chartData = data.map((entry) => ({
    date: entry.date,
    count: entry.count,
    displayDate: formatTooltipDate(entry.date),
  }))

  const primaryColor = "#4ade80"

  const startDate = data.length > 0 ? data[0].date : ""
  const endDate = data.length > 0 ? data[data.length - 1].date : ""

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="mb-6">
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
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
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
            <YAxis hide domain={[0, maxCount]} />
            <Tooltip
              position={{ y: -44 }}
              wrapperStyle={{ pointerEvents: 'none' }}
              content={({ active, payload }) => {
                if (active && payload?.[0]) {
                  const count = payload[0].payload.count
                  return (
                    <div className="bg-popover border border-border rounded-lg px-2.5 py-1.5">
                      <p className="text-xs font-medium text-foreground">
                        {count} {count === 1 ? "drink" : "drinks"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
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

function TypeTrendChart({ data, timeRange }: { data: DrinkEntry[]; timeRange: TimeRange }) {
  const chartData = React.useMemo(() => {
    const bucketSize = timeRange === "1W" ? 1 : timeRange === "1M" ? 7 : timeRange === "3M" ? 14 : 30
    const buckets: { date: string; label: string; [key: string]: number | string }[] = []
    
    let currentBucket: { date: string; label: string; types: Record<string, number> } | null = null
    let dayCount = 0
    let bucketIndex = 0

    for (const entry of data) {
      if (!currentBucket || dayCount >= bucketSize) {
        if (currentBucket) {
          buckets.push({ date: currentBucket.date, label: currentBucket.label, ...currentBucket.types })
        }
        bucketIndex++
        const label = timeRange === "1W" 
          ? formatShortDate(entry.date)
          : `W${bucketIndex}`
        currentBucket = { date: entry.date, label, types: {} }
        dayCount = 0
      }

      entry.types.forEach((type) => {
        currentBucket!.types[type] = (currentBucket!.types[type] || 0) + 1
      })
      dayCount++
    }

    if (currentBucket && Object.keys(currentBucket.types).length > 0) {
      buckets.push({ date: currentBucket.date, label: currentBucket.label, ...currentBucket.types })
    }

    return buckets
  }, [data, timeRange])

  const allTypes = React.useMemo(() => {
    const types = new Set<string>()
    data.forEach((entry) => entry.types.forEach((t) => types.add(t)))
    return Array.from(types)
  }, [data])

  if (chartData.length === 0 || allTypes.length === 0) {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Type Trend</h3>
        <p className="text-muted-foreground text-center py-8">No data available</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Type Trend Over Time</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#888' }}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              content={({ active, payload, label }) => {
                if (active && payload?.length) {
                  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0)
                  return (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-xs font-medium text-foreground mb-1">{total} drinks</p>
                      {payload.map((p: any) => p.value > 0 && (
                        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
                          <span>{p.dataKey}: {p.value}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
                return null
              }}
            />
            {allTypes.map((type) => (
              <Bar
                key={type}
                dataKey={type}
                stackId="1"
                fill={STACKED_COLORS[type] || "#6b7280"}
                radius={allTypes.indexOf(type) === allTypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex flex-wrap gap-3 mt-3">
        {allTypes.map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STACKED_COLORS[type] || "#6b7280" }} />
            <span className="text-xs text-muted-foreground">{type}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function DayOfWeekChart({ data }: { data: DrinkEntry[] }) {
  const dayData = React.useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    
    data.forEach((entry) => {
      if (entry.count > 0) {
        const date = parseLocalDateString(entry.date)
        const dayOfWeek = date.getDay()
        counts[dayOfWeek] += entry.count
      }
    })

    return DAY_NAMES.map((name, i) => ({
      day: name,
      drinks: counts[i],
    }))
  }, [data])

  const maxDrinks = Math.max(...dayData.map((d) => d.drinks), 1)

  return (
    <Card className="bg-card border-border px-4 pt-4 pb-2 shadow-none">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">By Day of Week</h3>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dayData} margin={{ top: 17, right: 0, left: 0, bottom: 0 }}>
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false}
              tick={{ fontSize: 12, fill: '#888' }}
            />
            <YAxis hide domain={[0, maxDrinks]} />
            <Tooltip
              position={{ y: -36 }}
              wrapperStyle={{ pointerEvents: 'none' }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              content={({ active, payload }) => {
                if (active && payload?.[0]) {
                  const count = payload[0].payload.drinks
                  return (
                    <div className="bg-popover border border-border rounded-lg px-2.5 py-1.5">
                      <p className="text-xs font-medium text-foreground">
                        {count} {count === 1 ? "drink" : "drinks"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {payload[0].payload.day}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar 
              dataKey="drinks" 
              fill="#60a5fa" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function HourOfDayChart({ data }: { data: DrinkEntry[] }) {
  const hourData = React.useMemo(() => {
    const periods = {
      morning: { label: "Morning", range: "6am–12pm", count: 0, icon: Sunrise },
      afternoon: { label: "Afternoon", range: "12pm–5pm", count: 0, icon: Sun },
      evening: { label: "Evening", range: "5pm–9pm", count: 0, icon: Sunset },
      night: { label: "Night", range: "9pm–6am", count: 0, icon: Moon },
    }

    data.forEach((entry) => {
      entry.hours.forEach((hour) => {
        if (hour >= 6 && hour < 12) periods.morning.count++
        else if (hour >= 12 && hour < 17) periods.afternoon.count++
        else if (hour >= 17 && hour < 21) periods.evening.count++
        else periods.night.count++
      })
    })

    return Object.values(periods)
  }, [data])

  const total = hourData.reduce((sum, p) => sum + p.count, 0)
  const maxCount = Math.max(...hourData.map((p) => p.count), 1)

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">By Time of Day</h3>
      <div className="space-y-3">
        {hourData.map((period) => {
          const percent = total > 0 ? Math.round((period.count / total) * 100) : 0
          const barWidth = maxCount > 0 ? (period.count / maxCount) * 100 : 0
          const Icon = period.icon
          
          return (
            <div key={period.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{period.label}</span>
                  <span className="text-xs text-muted-foreground">({period.range})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{period.count}</span>
                  <span className="text-xs text-muted-foreground w-8 text-right">{percent}%</span>
                </div>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function CheersStatsCard({ stats }: { stats: CheersStats }) {
  const [expandedSection, setExpandedSection] = React.useState<"received" | "given" | null>(null)

  const toggleSection = (section: "received" | "given") => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="flex items-center gap-2 -mb-2">
        <CheersIcon filled className="h-5 w-5" />
        <h3 className="text-sm font-medium text-muted-foreground">Cheers Stats</h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => stats.topCheerersToMe.length > 0 && toggleSection("received")}
          className={cn(
            "text-center rounded-lg py-2 transition-colors",
            stats.topCheerersToMe.length > 0 && "hover:bg-foreground/5 cursor-pointer",
            expandedSection === "received" && "bg-foreground/5"
          )}
        >
          <p className="text-2xl font-bold">{stats.totalReceived}</p>
          <p className="text-xs text-muted-foreground">Received</p>
        </button>
        <button
          type="button"
          onClick={() => stats.topCheeredByMe.length > 0 && toggleSection("given")}
          className={cn(
            "text-center rounded-lg py-2 transition-colors",
            stats.topCheeredByMe.length > 0 && "hover:bg-foreground/5 cursor-pointer",
            expandedSection === "given" && "bg-foreground/5"
          )}
        >
          <p className="text-2xl font-bold">{stats.totalGiven}</p>
          <p className="text-xs text-muted-foreground">Given</p>
        </button>
        <div className="text-center py-2">
          <p className="text-2xl font-bold">{stats.avgPerPost.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Avg/Post</p>
        </div>
      </div>

      {expandedSection === "received" && stats.topCheerersToMe.length > 0 && (
        <div className="border-t -mt-2 pt-3">
          <p className="text-xs text-muted-foreground mb-2">Top fans (cheered you most)</p>
          <div className="space-y-2">
            {stats.topCheerersToMe.slice(0, 3).map((user) => (
              <Link
                key={user.oderId}
                href={`/profile/${user.username}`}
                className="flex items-center gap-2 hover:bg-foreground/5 rounded-lg p-1 -m-1 transition-colors"
              >
                {user.avatarUrl ? (
                  <div className="relative h-8 w-8 overflow-hidden rounded-full">
                    <Image src={user.avatarUrl} alt={user.username} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold text-white">
                    {user.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName}</p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <CheersIcon filled className="h-4 w-4" />
                  <span className="text-sm">{user.count}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {expandedSection === "given" && stats.topCheeredByMe.length > 0 && (
        <div className="border-t -mt-2 pt-3">
          <p className="text-xs text-muted-foreground mb-2">You cheered most</p>
          <div className="space-y-2">
            {stats.topCheeredByMe.slice(0, 3).map((user) => (
              <Link
                key={user.oderId}
                href={`/profile/${user.username}`}
                className="flex items-center gap-2 hover:bg-foreground/5 rounded-lg p-1 -m-1 transition-colors"
              >
                {user.avatarUrl ? (
                  <div className="relative h-8 w-8 overflow-hidden rounded-full">
                    <Image src={user.avatarUrl} alt={user.username} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-xs font-semibold text-white">
                    {user.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName}</p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <CheersIcon filled className="h-4 w-4" />
                  <span className="text-sm">{user.count}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function SocialActivityCard({ stats }: { stats: CheersStats }) {
  const hasData = stats.topCheerersToMe.length > 0 || stats.topCheeredByMe.length > 0

  if (!hasData) {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-medium text-muted-foreground">Social Activity</h3>
        </div>
        <p className="text-muted-foreground text-center py-4 text-sm">No social activity yet</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-medium text-muted-foreground">Social Activity</h3>
      </div>

      <div className="space-y-4">
        {stats.topCheerersToMe.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Top fans (cheered you most)</p>
            <div className="space-y-2">
              {stats.topCheerersToMe.slice(0, 3).map((user) => (
                <Link
                  key={user.oderId}
                  href={`/profile/${user.username}`}
                  className="flex items-center gap-2 hover:bg-foreground/5 rounded-lg p-1 -m-1 transition-colors"
                >
                  {user.avatarUrl ? (
                    <div className="relative h-8 w-8 overflow-hidden rounded-full">
                      <Image src={user.avatarUrl} alt={user.username} fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold text-white">
                      {user.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.displayName}</p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <CheersIcon filled className="h-4 w-4" />
                    <span className="text-sm">{user.count}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {stats.topCheeredByMe.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">You cheered most</p>
            <div className="space-y-2">
              {stats.topCheeredByMe.slice(0, 3).map((user) => (
                <Link
                  key={user.oderId}
                  href={`/profile/${user.username}`}
                  className="flex items-center gap-2 hover:bg-foreground/5 rounded-lg p-1 -m-1 transition-colors"
                >
                  {user.avatarUrl ? (
                    <div className="relative h-8 w-8 overflow-hidden rounded-full">
                      <Image src={user.avatarUrl} alt={user.username} fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-xs font-semibold text-white">
                      {user.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.displayName}</p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <CheersIcon filled className="h-4 w-4" />
                    <span className="text-sm">{user.count}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function PersonalRecordsCard({ records, timeRange }: { records: PersonalRecords; timeRange: TimeRange }) {
  const periodLabel = {
    "1W": "this week",
    "1M": "this month",
    "3M": "these 3 months",
    "6M": "these 6 months",
    "1Y": "this year",
    "YTD": "this year",
  }[timeRange]

  const hasRecords = records.biggestDay || records.earliestDrink || records.latestDrink

  if (!hasRecords) {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-4 w-4 text-yellow-500" />
          <h3 className="text-sm font-medium text-muted-foreground">Personal Records</h3>
        </div>
        <p className="text-muted-foreground text-center py-4 text-sm">No records yet for {periodLabel}</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="flex items-center gap-2 mb-4">
        <Award className="h-4 w-4 text-yellow-500" />
        <h3 className="text-sm font-medium text-muted-foreground">Personal Records</h3>
      </div>

      <div className="space-y-3">
        {records.biggestDay && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Biggest Day</span>
            </div>
            <div className="text-right">
              <span className="font-semibold">{records.biggestDay.count} drinks</span>
              <p className="text-xs text-muted-foreground">{formatShortDate(records.biggestDay.date)}</p>
            </div>
          </div>
        )}

        {records.earliestDrink && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sunrise className="h-4 w-4 text-orange-400" />
              <span className="text-sm">Earliest Drink</span>
            </div>
            <div className="text-right">
              <span className="font-semibold">{records.earliestDrink.time}</span>
              <p className="text-xs text-muted-foreground">{formatShortDate(records.earliestDrink.date)}</p>
            </div>
          </div>
        )}

        {records.latestDrink && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-indigo-400" />
              <span className="text-sm">Latest Drink</span>
            </div>
            <div className="text-right">
              <span className="font-semibold">{records.latestDrink.time}</span>
              <p className="text-xs text-muted-foreground">{formatShortDate(records.latestDrink.date)}</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function DrinkBreakdown({ data }: { data: { name: string; value: number }[] }) {
  const total = React.useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  if (data.length === 0) {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <p className="text-muted-foreground text-center py-8">No data available</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="flex flex-col md:flex-row items-center gap-1">
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
                  <div className="h-1.5 bg-secondary rounded-full mt-1 overflow-hidden outline-none">
                    <div
                      className="h-full rounded-full transition-all duration-500 outline-none"
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
  const [userId, setUserId] = React.useState<string | null>(null)
  const [cheersStats, setCheersStats] = React.useState<CheersStats>({
    totalReceived: 0,
    totalGiven: 0,
    avgPerPost: 0,
    mostCheeredPost: null,
    topCheerersToMe: [],
    topCheeredByMe: [],
  })

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

        setUserId(userRes.user.id)

        const { data: logs, error: logsErr } = await supabase
          .from("drink_logs")
          .select("id, drink_type, created_at, caption")
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: true })

        if (logsErr) throw logsErr

        const typedLogs = (logs ?? []) as DrinkLogRow[]
        setAllLogs(typedLogs)
        const transformed = transformDrinkLogs(typedLogs)
        setAllData(transformed)

        await loadCheersStats(userRes.user.id, typedLogs)
      } catch (e: any) {
        setError(e?.message ?? "Could not load analytics.")
      } finally {
        setLoading(false)
      }
    }

    async function loadCheersStats(currentUserId: string, logs: DrinkLogRow[]) {
      try {
        const myDrinkIds = logs.map(l => l.id)
        
        const { data: receivedData } = await supabase
          .from("drink_cheers")
          .select("drink_log_id, user_id")
          .in("drink_log_id", myDrinkIds.length > 0 ? myDrinkIds : [""])

        const { data: givenData } = await supabase
          .from("drink_cheers")
          .select("drink_log_id, user_id")
          .eq("user_id", currentUserId)

        const receivedList = receivedData ?? []
        const givenList = givenData ?? []

        const cheersPerPost: Record<string, number> = {}
        receivedList.forEach((c: any) => {
          cheersPerPost[c.drink_log_id] = (cheersPerPost[c.drink_log_id] || 0) + 1
        })

        let mostCheeredPost: CheersStats["mostCheeredPost"] = null
        let maxCheers = 0
        Object.entries(cheersPerPost).forEach(([postId, count]) => {
          if (count > maxCheers) {
            maxCheers = count
            const log = logs.find(l => l.id === postId)
            mostCheeredPost = {
              id: postId,
              count,
              caption: log?.caption ?? null,
              date: log ? getLocalDateString(new Date(log.created_at)) : "",
            }
          }
        })

        const cheererCounts: Record<string, number> = {}
        receivedList.forEach((c: any) => {
          if (c.user_id !== currentUserId) {
            cheererCounts[c.user_id] = (cheererCounts[c.user_id] || 0) + 1
          }
        })

        const cheeredByMeCounts: Record<string, number> = {}
        if (givenList.length > 0) {
          const cheeredPostIds = givenList.map((c: any) => c.drink_log_id)
          const { data: cheeredPosts } = await supabase
            .from("drink_logs")
            .select("id, user_id")
            .in("id", cheeredPostIds)

          cheeredPosts?.forEach((post: any) => {
            if (post.user_id !== currentUserId) {
              cheeredByMeCounts[post.user_id] = (cheeredByMeCounts[post.user_id] || 0) + 1
            }
          })
        }

        const allUserIds = [...new Set([...Object.keys(cheererCounts), ...Object.keys(cheeredByMeCounts)])]
        let userProfiles: Record<string, { username: string; displayName: string; avatarUrl: string | null }> = {}

        if (allUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profile_public_stats")
            .select("id, username, display_name, avatar_path")
            .in("id", allUserIds)

          if (profiles) {
            for (const p of profiles) {
              let avatarUrl = null
              if (p.avatar_path) {
                const { data: urlData } = await supabase.storage
                  .from("profile-photos")
                  .createSignedUrl(p.avatar_path, 60 * 60)
                avatarUrl = urlData?.signedUrl ?? null
              }
              userProfiles[p.id] = {
                username: p.username,
                displayName: p.display_name || p.username,
                avatarUrl,
              }
            }
          }
        }

        const topCheerersToMe = Object.entries(cheererCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([oderId, count]) => ({
            oderId,
            username: userProfiles[oderId]?.username ?? "Unknown",
            displayName: userProfiles[oderId]?.displayName ?? "Unknown",
            avatarUrl: userProfiles[oderId]?.avatarUrl ?? null,
            count,
          }))

        const topCheeredByMe = Object.entries(cheeredByMeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([oderId, count]) => ({
            oderId,
            username: userProfiles[oderId]?.username ?? "Unknown",
            displayName: userProfiles[oderId]?.displayName ?? "Unknown",
            avatarUrl: userProfiles[oderId]?.avatarUrl ?? null,
            count,
          }))

        const totalReceived = receivedList.length
        const totalGiven = givenList.length
        const avgPerPost = myDrinkIds.length > 0 ? totalReceived / myDrinkIds.length : 0

        setCheersStats({
          totalReceived,
          totalGiven,
          avgPerPost,
          mostCheeredPost,
          topCheerersToMe,
          topCheeredByMe,
        })
      } catch (e) {
        console.error("Failed to load cheers stats:", e)
      }
    }

    load()
  }, [router, supabase])

  const filteredData = React.useMemo(() => {
    const now = new Date()
    const { start: startDate } = getDateRangeForTimeRange(timeRange, now)
    const todayStr = getLocalDateString(now)

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
        result.push({ date: dateStr, count: 0, types: [], hours: [], drinkIds: [], captions: [] })
      }

      current.setDate(current.getDate() + 1)
    }

    return result
  }, [allData, timeRange])

  const previousPeriodData = React.useMemo(() => {
    const now = new Date()
    const { start: prevStart, end: prevEnd } = getPreviousPeriodRange(timeRange, now)
    const prevEndStr = getLocalDateString(prevEnd)

    const dataByDate = new Map<string, DrinkEntry>()
    for (const entry of allData) {
      dataByDate.set(entry.date, entry)
    }

    const result: DrinkEntry[] = []
    const current = new Date(prevStart)

    while (getLocalDateString(current) <= prevEndStr) {
      const dateStr = getLocalDateString(current)
      const existing = dataByDate.get(dateStr)

      if (existing) {
        result.push(existing)
      } else {
        result.push({ date: dateStr, count: 0, types: [], hours: [], drinkIds: [], captions: [] })
      }

      current.setDate(current.getDate() + 1)
    }

    return result
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

    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
    const topCount = sortedTypes[0]?.[1] ?? 0
    const tiedTypes = sortedTypes.filter(([, count]) => count === topCount).map(([name]) => name)
    const mostCommon = tiedTypes.length > 0 ? tiedTypes.join("/") : "N/A"

    return { totalDrinks, avgPerDay, mostInADay, mostCommon }
  }, [filteredData])

  const streakData = React.useMemo(() => {
    let longestStreak = 0
    let tempStreak = 0
    let daysSinceLastDrink = 0

    // Calculate longest streak
    for (let i = 0; i < filteredData.length; i++) {
      const entry = filteredData[i]
      
      if (entry.count > 0) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    // Calculate days since last drink
    let foundLastDrink = false
    for (let i = filteredData.length - 1; i >= 0; i--) {
      if (filteredData[i].count > 0) {
        foundLastDrink = true
        break
      }
      daysSinceLastDrink++
    }

    // If no drinks found in the filtered period, count all days
    if (!foundLastDrink) {
      daysSinceLastDrink = filteredData.length
    }

    return {
      longestStreak,
      daysSinceLastDrink,
    }
  }, [filteredData])

  const paceData = React.useMemo(() => {
    const currentTotal = filteredData.reduce((sum, d) => sum + d.count, 0)
    const daysElapsed = filteredData.length
    const currentActiveDays = filteredData.filter(d => d.count > 0).length
    const currentAvgPerDay = daysElapsed > 0 ? currentTotal / daysElapsed : 0

    const prevDaysToCompare = Math.min(daysElapsed, previousPeriodData.length)
    const previousTotalAtSamePoint = previousPeriodData
      .slice(0, prevDaysToCompare)
      .reduce((sum, d) => sum + d.count, 0)

    const previousPeriodTotal = previousPeriodData.reduce((sum, d) => sum + d.count, 0)
    const previousActiveDays = previousPeriodData.filter(d => d.count > 0).length
    const previousAvgPerDay = previousPeriodData.length > 0 ? previousPeriodTotal / previousPeriodData.length : 0

    return {
      currentTotal,
      previousTotalAtSamePoint,
      previousPeriodTotal,
      currentAvgPerDay,
      previousAvgPerDay,
      currentActiveDays,
      previousActiveDays,
      daysElapsed,
      totalDays: filteredData.length,
    }
  }, [filteredData, previousPeriodData])

  const personalRecords = React.useMemo((): PersonalRecords => {
    let biggestDay: PersonalRecords["biggestDay"] = null
    let earliestDrink: PersonalRecords["earliestDrink"] = null
    let latestDrink: PersonalRecords["latestDrink"] = null

    let maxCount = 0
    let earliestHour = 24
    let latestHour = -1

    filteredData.forEach((entry) => {
      if (entry.count > maxCount) {
        maxCount = entry.count
        biggestDay = { date: entry.date, count: entry.count }
      }

      entry.hours.forEach((hour) => {
        if (hour < earliestHour) {
          earliestHour = hour
          earliestDrink = {
            time: `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
            date: entry.date,
          }
        }

        if (hour > latestHour) {
          latestHour = hour
          latestDrink = {
            time: `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
            date: entry.date,
          }
        }
      })
    })

    return { biggestDay, earliestDrink, latestDrink }
  }, [filteredData])

  const breakdownData = React.useMemo(() => {
    const typeCounts: Record<string, number> = {}
    filteredData.forEach((day) => {
      day.types.forEach((type) => {
        typeCounts[type] = (typeCounts[type] || 0) + 1
      })
    })

    return Object.entries(typeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredData])

  if (loading) {
    return (
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center justify-center rounded-full border p-2"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold">Analytics</h2>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center justify-center rounded-full border p-2"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold">Analytics</h2>
          </div>
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center rounded-full border p-2"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold">Analytics</h2>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      <div className="space-y-4">
        <KpiCards data={kpiData} />
        <StreakAndActivityCards data={streakData} />
        <DrinkChart data={filteredData} />
        <TypeTrendChart data={filteredData} timeRange={timeRange} />
        <DayOfWeekChart data={filteredData} />
        <CheersStatsCard stats={cheersStats} />
        <DrinkBreakdown data={breakdownData} />
      </div>
    </div>
  )
}