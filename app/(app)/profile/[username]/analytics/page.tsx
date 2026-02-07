"use client"

import * as React from "react"
import { ArrowLeft, Calendar, GlassWater, TrendingUp, Trophy, Star, Flame, CalendarDays } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
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
      <g transform={filled ? "rotate(15, 8, 16)" : "translate(2,0)"}>
        {filled && (
          <path
            d="M5 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2L5 9z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        <path
          d="M4 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3L4 6z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M8 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M5 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      <g transform={filled ? "rotate(-15, 24, 16)" : "translate(-2,0)"}>
        {filled && (
          <path
            d="M21 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2l-.8-4z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        <path
          d="M20 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3l-1-7z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M24 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M21 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      {filled && (
        <g stroke="#fbbf24">
          <path d="M16 -0.5v3" strokeWidth="1.5" />
          <g transform="translate(16, 0) scale(-1, 1) translate(-16, 0)">
            <path d="M19 3l2-2" strokeWidth="1.5" />
          </g>
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

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// Card IDs for ordering
type CardId = "drinkChart" | "cheersStats" | "activityGrid" | "dayOfWeek" | "breakdown" | "typeTrend"
const DEFAULT_CARD_ORDER: CardId[] = ["drinkChart", "activityGrid", "cheersStats", "dayOfWeek", "breakdown", "typeTrend"]

function isValidCardOrder(order: unknown): order is CardId[] {
  if (!Array.isArray(order)) return false
  if (order.length !== DEFAULT_CARD_ORDER.length) return false
  return DEFAULT_CARD_ORDER.every(id => order.includes(id))
}

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
    <div ref={menuRef} className="relative shrink-0">
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

function ResponsiveTitle({ text }: { text: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = React.useState(24)
  const baseSize = 24
  const minSize = 16

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const calculateSize = () => {
      const containerWidth = container.clientWidth
      if (containerWidth === 0) return

      const measureSpan = document.createElement('span')
      measureSpan.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font-size: ${baseSize}px;
        font-weight: 700;
        font-family: inherit;
      `
      measureSpan.textContent = text
      document.body.appendChild(measureSpan)
      
      const textWidth = measureSpan.offsetWidth
      document.body.removeChild(measureSpan)

      if (textWidth > containerWidth) {
        const ratio = containerWidth / textWidth
        const newSize = Math.max(Math.floor(baseSize * ratio * 0.95), minSize)
        setFontSize(newSize)
      } else {
        setFontSize(baseSize)
      }
    }

    calculateSize()

    const resizeObserver = new ResizeObserver(calculateSize)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [text])

  return (
    <div ref={containerRef} className="min-w-0 flex-1 overflow-hidden">
      <h2
        className="font-bold whitespace-nowrap"
        style={{ fontSize: `${fontSize}px`, lineHeight: '1.25' }}
      >
        {text}
      </h2>
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
    longestStreak: number
    daysSinceLastDrink: number
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
      suffix: data.totalDrinks === 1 ? "drink" : "drinks",
      icon: GlassWater,
      color: "text-chart-1",
    },
    {
      label: "Avg per Day",
      value: data.avgPerDay.toFixed(2),
      suffix: "drinks",
      icon: TrendingUp,
      color: "text-chart-2",
    },
    {
      label: "Best Day",
      value: data.mostInADay.toString(),
      suffix: data.mostInADay === 1 ? "drink" : "drinks",
      icon: Trophy,
      color: "text-chart-3",
    },
    {
      label: "Favorite Drink",
      value: data.mostCommon,
      icon: Star,
      color: "text-chart-4",
    },
    {
      label: "Longest Streak",
      value: data.longestStreak.toString(),
      suffix: data.longestStreak === 1 ? "day" : "days",
      icon: Flame,
      color: "text-orange-500",
    },
    {
      label: "Since Last Drink",
      value: data.daysSinceLastDrink.toString(),
      suffix: data.daysSinceLastDrink === 1 ? "day" : "days",
      icon: CalendarDays,
      color: "text-green-500",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((card) => {
        const isMostCommon = card.label === "Most Common"
        const hasSuffix = 'suffix' in card && card.suffix
        return (
          <Card key={card.label} className="bg-card border-border px-3 pt-3 pb-2 shadow-none">
            <div className="flex items-center gap-2">
              <card.icon className={cn("w-4 h-4", card.color)} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            {hasSuffix ? (
              <div className="-mt-4 h-9 flex items-baseline gap-1.5">
                <p className="font-semibold text-foreground text-2xl">
                  {card.value}
                </p>
                <span className="text-xs text-muted-foreground">{card.suffix}</span>
              </div>
            ) : (
              <p
                ref={isMostCommon ? mostCommonRef : undefined}
                className="font-semibold text-foreground truncate -mt-4 h-9 flex items-center text-2xl"
                style={isMostCommon && fontSize ? { fontSize: `${fontSize}px` } : undefined}
              >
                {card.value}
              </p>
            )}
          </Card>
        )
      })}
    </div>
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
      <div className="mb-6 flex items-baseline gap-1.5">
        <p className="text-2xl font-semibold text-foreground">{totalDrinks}</p>
        <span className="text-xs text-muted-foreground">{totalDrinks === 1 ? "drink" : "drinks"}</span>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCountFriend" x1="0" y1="0" x2="0" y2="1">
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
              fill="url(#colorCountFriend)"
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

// Auto-scrolling legend for charts
function MarqueeLegend({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [shouldScroll, setShouldScroll] = React.useState(false)
  const [isVisible, setIsVisible] = React.useState(false)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const [scrollDistance, setScrollDistance] = React.useState(0)
  const [scrollDuration, setScrollDuration] = React.useState(0)

  const SCROLL_SPEED = 40

  React.useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    const checkOverflow = () => {
      const isOverflowing = content.scrollWidth > container.clientWidth
      setShouldScroll(isOverflowing)
      if (isOverflowing) {
        const distance = content.scrollWidth - container.clientWidth + 8
        setScrollDistance(distance)
        setScrollDuration(distance / SCROLL_SPEED)
      }
    }

    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [children])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
        if (!entry.isIntersecting) {
          setIsScrolling(false)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!shouldScroll || !isVisible) return

    const startTimer = setTimeout(() => {
      setIsScrolling(true)
    }, 2000)

    return () => clearTimeout(startTimer)
  }, [shouldScroll, isVisible])

  React.useEffect(() => {
    if (!isScrolling || !shouldScroll || !isVisible || scrollDuration === 0) return

    const resetTimer = setTimeout(() => {
      setIsScrolling(false)
      setTimeout(() => {
        if (isVisible) setIsScrolling(true)
      }, 2000)
    }, (scrollDuration * 1000) + 1500)

    return () => clearTimeout(resetTimer)
  }, [isScrolling, shouldScroll, isVisible, scrollDuration])

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)}>
      <div
        ref={contentRef}
        className="flex gap-3 w-max"
        style={{
          transform: isScrolling ? `translateX(-${scrollDistance}px)` : 'translateX(0)',
          transition: isScrolling ? `transform ${scrollDuration}s linear` : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
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

    if (currentBucket) {
      buckets.push({ date: currentBucket.date, label: currentBucket.label, ...currentBucket.types })
    }

    return buckets
  }, [data, timeRange])

  // Sort types by total count descending (highest at bottom of stack)
  const allTypes = React.useMemo(() => {
    const typeTotals: Record<string, number> = {}
    data.forEach((entry) => entry.types.forEach((t) => {
      typeTotals[t] = (typeTotals[t] || 0) + 1
    }))
    
    return Object.entries(typeTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type)
  }, [data])

  // Custom bar shape that rounds top corners only for the topmost segment
  const RoundedTopBar = React.useCallback((props: any) => {
    const { x, y, width, height, fill, dataKey, payload } = props
    
    if (!height || height <= 0) return null
    
    const typeIndex = allTypes.indexOf(dataKey)
    const typesAbove = allTypes.slice(typeIndex + 1)
    const isTopmost = typesAbove.every(type => !payload[type] || payload[type] === 0)
    
    if (isTopmost) {
      const radius = 4
      const path = `
        M ${x},${y + height}
        L ${x},${y + radius}
        Q ${x},${y} ${x + radius},${y}
        L ${x + width - radius},${y}
        Q ${x + width},${y} ${x + width},${y + radius}
        L ${x + width},${y + height}
        Z
      `
      return <path d={path} fill={fill} />
    }
    
    return <rect x={x} y={y} width={width} height={height} fill={fill} />
  }, [allTypes])

  if (chartData.length === 0) {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Type Trend</h3>
        <p className="text-muted-foreground text-center py-8">No data available</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <h3 className="text-sm font-medium text-muted-foreground -mb-1">Type Trend Over Time</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: -15, right: 10, left: 10, bottom: 0 }}>
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
                shape={RoundedTopBar as any}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <MarqueeLegend className="-mt-5">
        {allTypes.map((type) => (
          <div key={type} className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STACKED_COLORS[type] || "#6b7280" }} />
            <span className="text-xs text-muted-foreground">{type}</span>
          </div>
        ))}
      </MarqueeLegend>
    </Card>
  )
}

function DayOfWeekChart({ data }: { data: DrinkEntry[] }) {
  const dayData = React.useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    
    data.forEach((entry) => {
      if (entry.count > 0) {
        const date = parseLocalDateString(entry.date)
        const dayOfWeek = (date.getDay() + 6) % 7
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

function CheersStatsCard({ stats }: { stats: CheersStats }) {
  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="flex items-center gap-2 -mb-2">
        <CheersIcon filled className="h-5 w-5" />
        <h3 className="text-sm font-medium text-muted-foreground">Cheers</h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center py-2">
          <p className="text-2xl font-semibold">{stats.totalReceived}</p>
          <p className="text-xs text-muted-foreground">Received</p>
        </div>
        <div className="text-center py-2">
          <p className="text-2xl font-semibold">{stats.totalGiven}</p>
          <p className="text-xs text-muted-foreground">Given</p>
        </div>
        <div className="text-center py-2">
          <p className="text-2xl font-semibold">{stats.avgPerPost.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Avg/Post</p>
        </div>
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

        <div className="w-full md:w-1/2 space-y-3 mb-1 max-h-[140px] overflow-y-auto">
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

function ActivityGrid({ data, timeRange }: { data: DrinkEntry[]; timeRange: TimeRange }) {
  const primaryColor = "#4ade80"
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = React.useState<number | null>(null)

  const dataByDate = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of data) {
      map.set(entry.date, entry.count)
    }
    return map
  }, [data])

  const gridData = React.useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let startDate: Date

    switch (timeRange) {
      case "1W":
        startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
        break
      case "1M":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
        break
      case "3M":
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
        break
      case "6M":
        startDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())
        break
      case "1Y":
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
        break
      case "YTD":
        startDate = new Date(today.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
    }
    startDate.setHours(0, 0, 0, 0)

    if (timeRange !== "1W") {
      const jsDay = startDate.getDay()
      const mondayOffset = (jsDay + 6) % 7
      startDate.setDate(startDate.getDate() - mondayOffset)
    }

    const days: { date: string; count: number; dayOfWeek: number; weekIndex: number }[] = []
    const current = new Date(startDate)
    let weekIndex = 0

    while (current <= today) {
      const dateStr = getLocalDateString(current)
      const count = dataByDate.get(dateStr) ?? 0
      const mondayBasedDay = (current.getDay() + 6) % 7

      days.push({
        date: dateStr,
        count,
        dayOfWeek: mondayBasedDay,
        weekIndex,
      })

      current.setDate(current.getDate() + 1)
      if (current.getDay() === 1) {
        weekIndex++
      }
    }

    return days
  }, [dataByDate, timeRange])

  const weeks = React.useMemo(() => {
    const weekMap = new Map<number, typeof gridData>()

    for (const day of gridData) {
      if (!weekMap.has(day.weekIndex)) {
        weekMap.set(day.weekIndex, [])
      }
      weekMap.get(day.weekIndex)!.push(day)
    }

    return Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, days]) => days)
  }, [gridData])

  const monthLabels = React.useMemo(() => {
    const monthWeeks = new Map<string, { month: number; weekIndices: number[] }>()
    
    for (const day of gridData) {
      const date = parseLocalDateString(day.date)
      const month = date.getMonth()
      const year = date.getFullYear()
      const key = `${year}-${month}`
      
      if (!monthWeeks.has(key)) {
        monthWeeks.set(key, { month, weekIndices: [] })
      }
      const entry = monthWeeks.get(key)!
      if (!entry.weekIndices.includes(day.weekIndex)) {
        entry.weekIndices.push(day.weekIndex)
      }
    }
    
    const labels: { month: string; weekIndex: number }[] = []
    const sortedMonths = Array.from(monthWeeks.entries()).sort((a, b) => {
      return (a[1].weekIndices[0] ?? 0) - (b[1].weekIndices[0] ?? 0)
    })
    
    for (const [, { month, weekIndices }] of sortedMonths) {
      if (weekIndices.length > 0) {
        weekIndices.sort((a, b) => a - b)
        const middleIdx = Math.floor(weekIndices.length / 2)
        labels.push({
          month: MONTH_LABELS[month],
          weekIndex: weekIndices[middleIdx],
        })
      }
    }

    return labels
  }, [gridData])

  const activeDays = React.useMemo(() => {
    return gridData.filter((d) => d.count > 0).length
  }, [gridData])

  const [tooltip, setTooltip] = React.useState<{
    date: string
    count: number
    x: number
    y: number
  } | null>(null)

  const formatActivityTooltipDate = (dateStr: string) => {
    const date = parseLocalDateString(dateStr)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const gap = (timeRange === "1W" || timeRange === "1M") ? 6 : 3

  React.useEffect(() => {
    const calculateSize = () => {
      if (!containerRef.current) return

      const containerWidth = containerRef.current.offsetWidth

      if (timeRange === "1W" || timeRange === "1M") {
        const numCells = 7
        const totalGap = (numCells - 1) * gap
        const size = Math.floor((containerWidth - totalGap) / numCells)
        setCellSize(size)
      } else {
        const dayLabelWidth = 24
        const referenceWeeks = 14
        const availableWidth = containerWidth - dayLabelWidth
        const totalGap = (referenceWeeks - 1) * gap
        const size = Math.floor((availableWidth - totalGap) / referenceWeeks)
        setCellSize(Math.max(size, 8))
      }
    }

    calculateSize()
    window.addEventListener("resize", calculateSize)
    return () => window.removeEventListener("resize", calculateSize)
  }, [timeRange, weeks.length, gap])

  const todayStr = getLocalDateString(new Date())
  const rounded = (timeRange === "1W" || timeRange === "1M") ? 6 : 3

  if (cellSize === null) {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <div className="-mb-2 flex items-baseline gap-1.5">
          <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
          <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
        </div>
        <div ref={containerRef} className="h-10" />
      </Card>
    )
  }

  if (timeRange === "1W") {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <div className="-mb-2 flex items-baseline gap-1.5">
          <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
          <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
        </div>

        <div ref={containerRef}>
          <div className="flex mb-2" style={{ gap }}>
            {gridData.map((day) => (
              <div
                key={`label-${day.date}`}
                className="text-xs text-muted-foreground text-center"
                style={{ width: cellSize }}
              >
                {DAY_NAMES[day.dayOfWeek][0]}
              </div>
            ))}
          </div>

          <div className="flex" style={{ gap }}>
            {gridData.map((day) => {
              const hasActivity = day.count > 0

              return (
                <div
                  key={day.date}
                  className={cn(
                    "cursor-pointer transition-all",
                    "hover:ring-1 hover:ring-foreground/50"
                  )}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: rounded,
                    backgroundColor: hasActivity ? primaryColor : "rgba(128, 128, 128, 0.2)",
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltip({
                      date: day.date,
                      count: day.count,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </div>
        </div>

        {tooltip && (
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="text-sm font-medium text-foreground">
              {tooltip.count} {tooltip.count === 1 ? "drink" : "drinks"}
            </p>
            <p className="text-xs text-muted-foreground">{formatActivityTooltipDate(tooltip.date)}</p>
          </div>
        )}
      </Card>
    )
  }

  if (timeRange === "1M") {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <div className="-mb-2 flex items-baseline gap-1.5">
          <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
          <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
        </div>

        <div ref={containerRef}>
          <div className="flex mb-2" style={{ gap }}>
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="text-xs text-muted-foreground text-center"
                style={{ width: cellSize }}
              >
                {day[0]}
              </div>
            ))}
          </div>

          <div className="flex flex-col" style={{ gap }}>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex" style={{ gap }}>
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const day = week.find((d) => d.dayOfWeek === dayIdx)

                  if (!day) {
                    return (
                      <div
                        key={`empty-${weekIdx}-${dayIdx}`}
                        style={{
                          width: cellSize,
                          height: cellSize,
                        }}
                      />
                    )
                  }

                  const hasActivity = day.count > 0

                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "cursor-pointer transition-all",
                        "hover:ring-1 hover:ring-foreground/50"
                      )}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: rounded,
                        backgroundColor: hasActivity ? primaryColor : "rgba(128, 128, 128, 0.2)",
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setTooltip({
                          date: day.date,
                          count: day.count,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {tooltip && (
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="text-sm font-medium text-foreground">
              {tooltip.count} {tooltip.count === 1 ? "drink" : "drinks"}
            </p>
            <p className="text-xs text-muted-foreground">{formatActivityTooltipDate(tooltip.date)}</p>
          </div>
        )}
      </Card>
    )
  }

  const dayLabelWidth = 16
  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="-mb-2 flex items-baseline gap-1.5">
        <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
        <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
      </div>

      <div ref={containerRef} className="overflow-x-auto">
        <div className="relative h-4 mb-1" style={{ marginLeft: dayLabelWidth + 8 }}>
          {monthLabels.map((label, i) => (
            <div
              key={`${label.month}-${i}`}
              className="text-xs text-muted-foreground absolute"
              style={{
                left: label.weekIndex * (cellSize + gap),
              }}
            >
              {label.month}
            </div>
          ))}
        </div>

        <div className="flex">
          <div className="flex flex-col mr-2" style={{ gap, width: dayLabelWidth }}>
            {DAY_NAMES.map((day, i) => (
              <div
                key={day}
                className={cn(
                  "text-xs text-muted-foreground flex items-center",
                  i % 2 === 1 ? "opacity-0" : ""
                )}
                style={{ height: cellSize }}
              >
                {day[0]}
              </div>
            ))}
          </div>

          <div className="flex" style={{ gap }}>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col" style={{ gap }}>
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const day = week.find((d) => d.dayOfWeek === dayIdx)

                  if (!day) {
                    return (
                      <div
                        key={`empty-${weekIdx}-${dayIdx}`}
                        style={{
                          width: cellSize,
                          height: cellSize,
                        }}
                      />
                    )
                  }

                  const hasActivity = day.count > 0

                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "cursor-pointer transition-all",
                        "hover:ring-1 hover:ring-foreground/50"
                      )}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: rounded,
                        backgroundColor: hasActivity ? primaryColor : "rgba(128, 128, 128, 0.2)",
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setTooltip({
                          date: day.date,
                          count: day.count,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-sm font-medium text-foreground">
            {tooltip.count} {tooltip.count === 1 ? "drink" : "drinks"}
          </p>
          <p className="text-xs text-muted-foreground">{formatActivityTooltipDate(tooltip.date)}</p>
        </div>
      )}
    </Card>
  )
}

export default function FriendAnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const username = params.username as string

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [allData, setAllData] = React.useState<DrinkEntry[]>([])
  const [allLogs, setAllLogs] = React.useState<DrinkLogRow[]>([])
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M")
  const [cardOrder, setCardOrder] = React.useState<CardId[]>(DEFAULT_CARD_ORDER)
  const [friendUserId, setFriendUserId] = React.useState<string | null>(null)

  // Raw cheers data — fetched once, filtered reactively by time range
  const [rawReceivedCheers, setRawReceivedCheers] = React.useState<{ drink_log_id: string; user_id: string }[]>([])
  const [rawGivenCheers, setRawGivenCheers] = React.useState<{ drink_log_id: string; user_id: string; created_at: string }[]>([])

  React.useEffect(() => {
    async function load() {
      setError(null)
      setLoading(true)

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!userRes.user) {
          router.replace(`/login?redirectTo=%2Fprofile%2F${username}%2Fanalytics`)
          return
        }

        const viewerId = userRes.user.id

        const { data: publicData, error: publicErr } = await supabase
          .from("profile_public_stats")
          .select("id, display_name")
          .eq("username", username)
          .single()

        if (publicErr) {
          if (publicErr.code === "PGRST116") {
            setError("User not found")
            setLoading(false)
            return
          }
          throw publicErr
        }

        const profileUserId = publicData.id
        setFriendUserId(profileUserId)

        const { data: profileData } = await supabase
          .from("profiles")
          .select("analytics_card_order")
          .eq("id", profileUserId)
          .single()

        if (profileData?.analytics_card_order && isValidCardOrder(profileData.analytics_card_order)) {
          setCardOrder(profileData.analytics_card_order)
        }

        if (profileUserId === viewerId) {
          router.replace("/analytics")
          return
        }

        const { data: friendshipData, error: friendshipErr } = await supabase
          .from("friendships")
          .select("status")
          .or(
            `and(requester_id.eq.${viewerId},addressee_id.eq.${profileUserId}),and(requester_id.eq.${profileUserId},addressee_id.eq.${viewerId})`
          )
          .eq("status", "accepted")
          .maybeSingle()

        if (friendshipErr) throw friendshipErr

        if (!friendshipData) {
          setError("You must be friends to view their analytics")
          setLoading(false)
          return
        }

        const { data: logs, error: logsErr } = await supabase
          .from("drink_logs")
          .select("id, drink_type, created_at, caption")
          .eq("user_id", profileUserId)
          .order("created_at", { ascending: true })

        if (logsErr) throw logsErr

        const typedLogs = (logs ?? []) as DrinkLogRow[]
        setAllLogs(typedLogs)
        const transformed = transformDrinkLogs(typedLogs)
        setAllData(transformed)

        // Fetch all cheers data once (filtered reactively via useMemo)
        await loadCheersData(profileUserId, typedLogs)
      } catch (e: any) {
        setError(e?.message ?? "Could not load analytics.")
      } finally {
        setLoading(false)
      }
    }

    async function loadCheersData(targetUserId: string, logs: DrinkLogRow[]) {
      try {
        const friendDrinkIds = logs.map(l => l.id)
        
        // Fetch all cheers received by the friend
        const { data: receivedData } = await supabase
          .from("drink_cheers")
          .select("drink_log_id, user_id")
          .in("drink_log_id", friendDrinkIds.length > 0 ? friendDrinkIds : [""])

        // Fetch all cheers given by the friend (with created_at for time-range filtering)
        const { data: givenData } = await supabase
          .from("drink_cheers")
          .select("drink_log_id, user_id, created_at")
          .eq("user_id", targetUserId)

        setRawReceivedCheers((receivedData ?? []) as { drink_log_id: string; user_id: string }[])
        setRawGivenCheers((givenData ?? []) as { drink_log_id: string; user_id: string; created_at: string }[])
      } catch (e) {
        console.error("Failed to load cheers data:", e)
      }
    }

    load()
  }, [router, supabase, username])

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

  // Cheers stats — computed reactively from raw data + current time range
  const cheersStats = React.useMemo<CheersStats>(() => {
    const now = new Date()
    const { start: rangeStart } = getDateRangeForTimeRange(timeRange, now)

    // Drink IDs that fall within the selected time range
    const filteredDrinkIds = new Set(filteredData.flatMap((d) => d.drinkIds))

    // Filter received cheers to only those on posts in the time range
    const received = rawReceivedCheers.filter((c) => filteredDrinkIds.has(c.drink_log_id))

    // Filter given cheers to those made during the time range (by cheer timestamp)
    const given = rawGivenCheers.filter((c) => new Date(c.created_at) >= rangeStart)

    const totalReceived = received.length
    const totalGiven = given.length
    const postsInRange = filteredDrinkIds.size
    const avgPerPost = postsInRange > 0 ? totalReceived / postsInRange : 0

    return {
      totalReceived,
      totalGiven,
      avgPerPost,
    }
  }, [filteredData, rawReceivedCheers, rawGivenCheers, timeRange])

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

    for (let i = 0; i < filteredData.length; i++) {
      const entry = filteredData[i]
      
      if (entry.count > 0) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    let foundLastDrink = false
    for (let i = filteredData.length - 1; i >= 0; i--) {
      if (filteredData[i].count > 0) {
        foundLastDrink = true
        break
      }
      daysSinceLastDrink++
    }

    if (!foundLastDrink) {
      daysSinceLastDrink = filteredData.length
    }

    return {
      longestStreak,
      daysSinceLastDrink,
    }
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

  const cardComponents: Record<CardId, React.ReactNode> = {
    drinkChart: <DrinkChart data={filteredData} />,
    cheersStats: <CheersStatsCard stats={cheersStats} />,
    activityGrid: <ActivityGrid data={filteredData} timeRange={timeRange} />,
    dayOfWeek: <DayOfWeekChart data={filteredData} />,
    breakdown: <DrinkBreakdown data={breakdownData} />,
    typeTrend: <TypeTrendChart data={filteredData} timeRange={timeRange} />,
  }

  const titleText = `${username}'s Analytics`

  if (loading) {
    return (
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center justify-center rounded-full border p-2 shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <ResponsiveTitle text={titleText} />
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center justify-center rounded-full border p-2 shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <ResponsiveTitle text={titleText} />
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
    <div className="container max-w-2xl px-3 py-1.5 pb-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center rounded-full border p-2 shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ResponsiveTitle text={titleText} />
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      <div className="space-y-4">
        <KpiCards data={{ ...kpiData, ...streakData }} />
        
        {cardOrder.map((cardId) => (
          <div key={cardId}>
            {cardComponents[cardId]}
          </div>
        ))}
      </div>
    </div>
  )
}