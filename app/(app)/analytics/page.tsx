"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Calendar, GlassWater, TrendingUp, Trophy, Star, Flame, CalendarDays, GripVertical } from "lucide-react"
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

// Card IDs for reordering
type CardId = "drinkChart" | "cheersStats" | "dayOfWeek" | "breakdown" | "typeTrend"
const DEFAULT_CARD_ORDER: CardId[] = ["drinkChart", "cheersStats", "dayOfWeek", "breakdown", "typeTrend"]

// Helper to validate card order from database
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

// Drag and Drop Context
interface DragContextValue {
  draggedId: CardId | null
  handleDragStart: (id: CardId, e: React.DragEvent) => void
  handleDragEnd: () => void
  handleDragOver: (id: CardId, e: React.DragEvent) => void
  positionMapRef: React.MutableRefObject<Map<CardId, DOMRect>>
  capturePositions: () => void
}

const DragContext = React.createContext<DragContextValue | null>(null)

function useDragContext() {
  const context = React.useContext(DragContext)
  if (!context) throw new Error("useDragContext must be used within DragProvider")
  return context
}

// Draggable Card Wrapper with FLIP animation
function DraggableCard({
  id,
  children,
}: {
  id: CardId
  children: React.ReactNode
}) {
  const { draggedId, handleDragStart, handleDragEnd, handleDragOver, positionMapRef, capturePositions } = useDragContext()
  const isDragging = draggedId === id
  const ref = React.useRef<HTMLDivElement>(null)

  // FLIP animation after DOM reorder
  React.useLayoutEffect(() => {
    const el = ref.current
    const prevRect = positionMapRef.current.get(id)
    
    if (el && prevRect) {
      const newRect = el.getBoundingClientRect()
      const deltaY = prevRect.top - newRect.top
      
      if (Math.abs(deltaY) > 1) {
        // Invert: instantly move to old position
        el.style.transform = `translateY(${deltaY}px)`
        el.style.transition = 'none'
        
        // Force reflow
        el.offsetHeight
        
        // Play: animate to new position
        el.style.transition = 'transform 200ms ease-out'
        el.style.transform = ''
      }
      
      // Clear the stored position
      positionMapRef.current.delete(id)
    }
  })

  const handleDragOverWithCapture = (e: React.DragEvent) => {
    capturePositions()
    handleDragOver(id, e)
  }

  return (
    <div
      ref={ref}
      data-card-id={id}
      draggable
      onDragStart={(e) => handleDragStart(id, e)}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOverWithCapture}
      className={cn(
        "relative",
        isDragging && "opacity-50 scale-[0.98]"
      )}
    >
      {/* Drag Handle */}
      <div
        className="absolute top-3 right-3 p-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-foreground/10 transition-colors touch-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  )
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
      suffix: data.mostInADay === 1 ? "drink" : "drinks",
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
      label: "Favorite",
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
      <div className="mb-6 pr-8">
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

// Auto-scrolling legend for charts
function MarqueeLegend({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [shouldScroll, setShouldScroll] = React.useState(false)
  const [isVisible, setIsVisible] = React.useState(false)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const [scrollDistance, setScrollDistance] = React.useState(0)
  const [scrollDuration, setScrollDuration] = React.useState(0)

  // Pixels per second - adjust this to change scroll speed
  const SCROLL_SPEED = 40

  // Check if content overflows
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
    // Recheck on resize
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [children])

  // Intersection Observer to detect when element is visible
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

  // Start scrolling after 2 seconds when visible
  React.useEffect(() => {
    if (!shouldScroll || !isVisible) return

    const startTimer = setTimeout(() => {
      setIsScrolling(true)
    }, 2000)

    return () => clearTimeout(startTimer)
  }, [shouldScroll, isVisible])

  // Reset and repeat cycle
  React.useEffect(() => {
    if (!isScrolling || !shouldScroll || !isVisible || scrollDuration === 0) return

    // Reset after scroll completes + 1.5s pause
    const resetTimer = setTimeout(() => {
      setIsScrolling(false)
      // Restart the cycle after reset
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

    if (currentBucket && Object.keys(currentBucket.types).length > 0) {
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
    
    // Check if this is the topmost bar with a value
    const typeIndex = allTypes.indexOf(dataKey)
    const typesAbove = allTypes.slice(typeIndex + 1)
    const isTopmost = typesAbove.every(type => !payload[type] || payload[type] === 0)
    
    if (isTopmost) {
      const radius = 4
      // Path with rounded top corners only
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

  if (chartData.length === 0 || allTypes.length === 0) {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <h3 className="text-sm font-medium text-muted-foreground mb-4 pr-8">Type Trend</h3>
        <p className="text-muted-foreground text-center py-8">No data available</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <h3 className="text-sm font-medium text-muted-foreground -mb-1 pr-8">Type Trend Over Time</h3>
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
      <h3 className="text-sm font-medium text-muted-foreground mb-4 pr-8">By Day of Week</h3>
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
  const [expandedSection, setExpandedSection] = React.useState<"received" | "given" | null>(null)

  const toggleSection = (section: "received" | "given") => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="flex items-center gap-2 -mb-2 pr-8">
        <CheersIcon filled className="h-5 w-5" />
        <h3 className="text-sm font-medium text-muted-foreground">Cheers</h3>
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

  // Card ordering state
  const [cardOrder, setCardOrder] = React.useState<CardId[]>(DEFAULT_CARD_ORDER)
  const [draggedId, setDraggedId] = React.useState<CardId | null>(null)
  const positionMapRef = React.useRef<Map<CardId, DOMRect>>(new Map())

  // Save card order to Supabase
  const saveCardOrderToDb = React.useCallback(async (order: CardId[]) => {
    if (!userId) return
    
    try {
      await supabase
        .from("profiles")
        .update({ analytics_card_order: order })
        .eq("id", userId)
    } catch (e) {
      console.error("Failed to save card order:", e)
    }
  }, [userId, supabase])

  // Capture all card positions before reorder
  const capturePositions = React.useCallback(() => {
    const cards = document.querySelectorAll('[data-card-id]')
    cards.forEach((card) => {
      const el = card as HTMLElement
      const cardId = el.dataset.cardId as CardId
      if (cardId) {
        positionMapRef.current.set(cardId, el.getBoundingClientRect())
      }
    })
  }, [])

  // Drag handlers
  const handleDragStart = React.useCallback((id: CardId, e: React.DragEvent) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", id)
  }, [])

  const handleDragEnd = React.useCallback(() => {
    if (draggedId) {
      // Save the final order to Supabase
      saveCardOrderToDb(cardOrder)
    }
    setDraggedId(null)
  }, [draggedId, cardOrder, saveCardOrderToDb])

  const handleDragOver = React.useCallback((targetId: CardId, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    
    if (!draggedId || draggedId === targetId) return

    setCardOrder(prev => {
      const draggedIndex = prev.indexOf(draggedId)
      const targetIndex = prev.indexOf(targetId)
      
      if (draggedIndex === -1 || targetIndex === -1) return prev
      if (draggedIndex === targetIndex) return prev
      
      // Create new order by moving dragged item to target position
      const newOrder = [...prev]
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedId)
      
      return newOrder
    })
  }, [draggedId])

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

        // Load user's card order preference from Supabase
        const { data: profileData } = await supabase
          .from("profiles")
          .select("analytics_card_order")
          .eq("id", userRes.user.id)
          .single()

        if (profileData?.analytics_card_order && isValidCardOrder(profileData.analytics_card_order)) {
          setCardOrder(profileData.analytics_card_order)
        }

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

  // Map of card IDs to their components
  const cardComponents: Record<CardId, React.ReactNode> = {
    drinkChart: <DrinkChart data={filteredData} />,
    cheersStats: <CheersStatsCard stats={cheersStats} />,
    dayOfWeek: <DayOfWeekChart data={filteredData} />,
    breakdown: <DrinkBreakdown data={breakdownData} />,
    typeTrend: <TypeTrendChart data={filteredData} timeRange={timeRange} />,
  }

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
    <DragContext.Provider value={{ draggedId, handleDragStart, handleDragEnd, handleDragOver, positionMapRef, capturePositions }}>
      <div className="container max-w-2xl px-3 py-1.5 pb-0">
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
          <KpiCards data={{ ...kpiData, ...streakData }} />
          
          {cardOrder.map((cardId) => (
            <DraggableCard key={cardId} id={cardId}>
              {cardComponents[cardId]}
            </DraggableCard>
          ))}
        </div>
      </div>
    </DragContext.Provider>
  )
}