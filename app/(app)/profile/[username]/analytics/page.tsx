"use client"

import * as React from "react"
import { ArrowLeft, Calendar, GlassWater, TrendingUp, Trophy, Star, Flame, CalendarDays } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts"

function CheersIcon({ filled = false, className }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 -4 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <g transform={filled ? "rotate(15, 8, 16)" : "translate(2,0)"}>
        {filled && <path d="M5 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2L5 9z" fill="rgba(251, 191, 36, 0.9)" stroke="none" />}
        <path d="M4 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3L4 6z" fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"} stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M8 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M5 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>
      <g transform={filled ? "rotate(-15, 24, 16)" : "translate(-2,0)"}>
        {filled && <path d="M21 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2l-.8-4z" fill="rgba(251, 191, 36, 0.9)" stroke="none" />}
        <path d="M20 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3l-1-7z" fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"} stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M24 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M21 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>
      {filled && (
        <g stroke="#fbbf24">
          <path d="M16 -0.5v3" strokeWidth="1.5" />
          <g transform="translate(16, 0) scale(-1, 1) translate(-16, 0)"><path d="M19 3l2-2" strokeWidth="1.5" /></g>
          <path d="M19 3l2-2" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  )
}

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"
type DrinkLogRow = { id: string; drink_type: string; created_at: string; caption: string | null }
type DrinkEntry = { date: string; count: number; types: string[]; hours: number[]; drinkIds: string[]; captions: (string | null)[] }
type CheersStats = { totalReceived: number; totalGiven: number; avgPerPost: number }
type CardId = "drinkChart" | "cheersStats" | "activityGrid" | "dayOfWeek" | "breakdown" | "typeTrend"

const DEFAULT_CARD_ORDER: CardId[] = ["drinkChart", "activityGrid", "cheersStats", "dayOfWeek", "breakdown", "typeTrend"]
const timeRangeOptions: { key: TimeRange; label: string }[] = [
  { key: "1W", label: "1W" }, { key: "1M", label: "1M" }, { key: "3M", label: "3M" },
  { key: "6M", label: "6M" }, { key: "1Y", label: "1Y" }, { key: "YTD", label: "YTD" },
]
const PIE_COLORS = ["#4ade80", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf"]
const STACKED_COLORS: Record<string, string> = {
  Beer: "#fbbf24", Wine: "#a855f7", Cocktail: "#ec4899", Shot: "#ef4444",
  Seltzer: "#22d3ee", Spirit: "#f97316", Other: "#6b7280",
}
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function isValidCardOrder(order: unknown): order is CardId[] {
  if (!Array.isArray(order) || order.length !== DEFAULT_CARD_ORDER.length) return false
  return DEFAULT_CARD_ORDER.every((id) => order.includes(id))
}

function getLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function parseLocalDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function getDateRangeForTimeRange(timeRange: TimeRange, now: Date): { start: Date; end: Date } {
  let startDate: Date
  switch (timeRange) {
    case "1W": startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); break
    case "1M": startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break
    case "3M": startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break
    case "6M": startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break
    case "1Y": startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break
    case "YTD": startDate = new Date(now.getFullYear(), 0, 1); break
    default: startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  }
  startDate.setHours(0, 0, 0, 0)
  return { start: startDate, end: now }
}

function transformDrinkLogs(logs: DrinkLogRow[]): DrinkEntry[] {
  const byDate: Record<string, { count: number; types: string[]; hours: number[]; drinkIds: string[]; captions: (string | null)[] }> = {}
  for (const log of logs) {
    const d = new Date(log.created_at)
    const date = getLocalDateString(d)
    if (!byDate[date]) byDate[date] = { count: 0, types: [], hours: [], drinkIds: [], captions: [] }
    byDate[date].count++
    byDate[date].types.push(log.drink_type)
    byDate[date].hours.push(d.getHours())
    byDate[date].drinkIds.push(log.id)
    byDate[date].captions.push(log.caption)
  }
  return Object.entries(byDate).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date))
}

// ── Sub-components (rendering only, no data fetching) ───────────────────────

function ResponsiveTitle({ text }: { text: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = React.useState(24)
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const calc = () => {
      const w = container.clientWidth
      if (!w) return
      const span = document.createElement("span")
      span.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:24px;font-weight:700;font-family:inherit"
      span.textContent = text
      document.body.appendChild(span)
      const tw = span.offsetWidth
      document.body.removeChild(span)
      setFontSize(tw > w ? Math.max(Math.floor(24 * (w / tw) * 0.95), 16) : 24)
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(container)
    return () => ro.disconnect()
  }, [text])
  return (
    <div ref={containerRef} className="min-w-0 flex-1 overflow-hidden">
      <h2 className="font-bold whitespace-nowrap" style={{ fontSize, lineHeight: "1.25" }}>{text}</h2>
    </div>
  )
}

function TimeRangeSelector({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  const [showMenu, setShowMenu] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handle = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false) }
    if (showMenu) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [showMenu])
  return (
    <div ref={menuRef} className="relative shrink-0">
      <button type="button" onClick={() => setShowMenu(!showMenu)} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium">
        <Calendar className="h-4 w-4" />
        {timeRangeOptions.find((o) => o.key === value)?.label ?? value}
      </button>
      {showMenu && (
        <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-xl border bg-background shadow-lg">
          {timeRangeOptions.map((opt) => (
            <button key={opt.key} type="button" onClick={() => { onChange(opt.key); setShowMenu(false) }}
              className={cn("w-full px-4 py-3 text-left text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-foreground/5", value === opt.key ? "font-semibold" : "")}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCards({ data }: { data: { totalDrinks: number; avgPerDay: number; mostInADay: number; mostCommon: string; longestStreak: number; daysSinceLastDrink: number } }) {
  const mostCommonRef = React.useRef<HTMLParagraphElement>(null)
  const [fontSize, setFontSize] = React.useState<number | null>(null)
  React.useLayoutEffect(() => { setFontSize(null) }, [data.mostCommon])
  React.useEffect(() => {
    if (mostCommonRef.current && fontSize === null) {
      const el = mostCommonRef.current
      if (el.scrollWidth > el.clientWidth) setFontSize(Math.max(Math.floor(24 * el.clientWidth / el.scrollWidth), 12))
    }
  }, [data.mostCommon, fontSize])

  const cards = [
    { label: "Total Drinks", value: data.totalDrinks.toString(), suffix: data.totalDrinks === 1 ? "drink" : "drinks", icon: GlassWater, color: "text-chart-1" },
    { label: "Avg per Day", value: data.avgPerDay.toFixed(2), suffix: "drinks", icon: TrendingUp, color: "text-chart-2" },
    { label: "Best Day", value: data.mostInADay.toString(), suffix: data.mostInADay === 1 ? "drink" : "drinks", icon: Trophy, color: "text-chart-3" },
    { label: "Favorite Drink", value: data.mostCommon, icon: Star, color: "text-chart-4" },
    { label: "Longest Streak", value: data.longestStreak.toString(), suffix: data.longestStreak === 1 ? "day" : "days", icon: Flame, color: "text-orange-500" },
    { label: "Since Last Drink", value: data.daysSinceLastDrink.toString(), suffix: data.daysSinceLastDrink === 1 ? "day" : "days", icon: CalendarDays, color: "text-green-500" },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((card) => {
        const isFavorite = card.label === "Favorite Drink"
        const hasSuffix = "suffix" in card && card.suffix
        return (
          <Card key={card.label} className="bg-card border-border px-3 pt-3 pb-2 shadow-none">
            <div className="flex items-center gap-2">
              <card.icon className={cn("w-4 h-4", card.color)} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            {hasSuffix ? (
              <div className="-mt-4 h-9 flex items-baseline gap-1.5">
                <p className="font-semibold text-foreground text-2xl">{card.value}</p>
                <span className="text-xs text-muted-foreground">{card.suffix}</span>
              </div>
            ) : (
              <p ref={isFavorite ? mostCommonRef : undefined}
                className="font-semibold text-foreground truncate -mt-4 h-9 flex items-center text-2xl"
                style={isFavorite && fontSize ? { fontSize: `${fontSize}px` } : undefined}>
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
  const chartData = data.map((e) => ({ date: e.date, count: e.count, displayDate: parseLocalDateString(e.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) }))
  const startDate = data[0]?.date ?? ""
  const endDate = data[data.length - 1]?.date ?? ""
  const color = "#4ade80"
  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="mb-6 flex items-baseline gap-1.5">
        <p className="text-2xl font-semibold text-foreground">{totalDrinks}</p>
        <span className="text-xs text-muted-foreground">{totalDrinks === 1 ? "drink" : "drinks"}</span>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorFriend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" axisLine={false} tickLine={false} ticks={[startDate, endDate]} interval={0}
              tick={({ x, y, payload }) => {
                const isFirst = payload.value === startDate
                return <text x={x} y={y + 12} fill="#666" fontSize={12} textAnchor={isFirst ? "start" : "end"}>{parseLocalDateString(payload.value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</text>
              }} />
            <YAxis hide domain={[0, Math.max(...data.map((d) => d.count), 1)]} />
            <Tooltip position={{ y: -44 }} wrapperStyle={{ pointerEvents: "none" }}
              content={({ active, payload }) => active && payload?.[0] ? (
                <div className="bg-popover border border-border rounded-lg px-2.5 py-1.5">
                  <p className="text-xs font-medium text-foreground">{payload[0].payload.count} {payload[0].payload.count === 1 ? "drink" : "drinks"}</p>
                  <p className="text-[10px] text-muted-foreground">{payload[0].payload.displayDate}</p>
                </div>
              ) : null} />
            <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2} fill="url(#colorFriend)" dot={false} activeDot={{ r: 6, fill: color, stroke: "#1a1a2e", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function MarqueeLegend({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [shouldScroll, setShouldScroll] = React.useState(false)
  const [isVisible, setIsVisible] = React.useState(false)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const [scrollDistance, setScrollDistance] = React.useState(0)
  const [scrollDuration, setScrollDuration] = React.useState(0)
  const SPEED = 40

  React.useEffect(() => {
    const c = containerRef.current, ct = contentRef.current
    if (!c || !ct) return
    const check = () => {
      const over = ct.scrollWidth > c.clientWidth
      setShouldScroll(over)
      if (over) { const d = ct.scrollWidth - c.clientWidth + 8; setScrollDistance(d); setScrollDuration(d / SPEED) }
    }
    check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check)
  }, [children])

  React.useEffect(() => {
    const c = containerRef.current; if (!c) return
    const ob = new IntersectionObserver(([e]) => { setIsVisible(e.isIntersecting); if (!e.isIntersecting) setIsScrolling(false) }, { threshold: 0.5 })
    ob.observe(c); return () => ob.disconnect()
  }, [])

  React.useEffect(() => { if (!shouldScroll || !isVisible) return; const t = setTimeout(() => setIsScrolling(true), 2000); return () => clearTimeout(t) }, [shouldScroll, isVisible])
  React.useEffect(() => {
    if (!isScrolling || !shouldScroll || !isVisible || !scrollDuration) return
    const t = setTimeout(() => { setIsScrolling(false); setTimeout(() => { if (isVisible) setIsScrolling(true) }, 2000) }, scrollDuration * 1000 + 1500)
    return () => clearTimeout(t)
  }, [isScrolling, shouldScroll, isVisible, scrollDuration])

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)}>
      <div ref={contentRef} className="flex gap-3 w-max"
        style={{ transform: isScrolling ? `translateX(-${scrollDistance}px)` : "translateX(0)", transition: isScrolling ? `transform ${scrollDuration}s linear` : "transform 0.3s ease-out" }}>
        {children}
      </div>
    </div>
  )
}

function TypeTrendChart({ data, timeRange }: { data: DrinkEntry[]; timeRange: TimeRange }) {
  const chartData = React.useMemo(() => {
    const bucketSize = timeRange === "1W" ? 1 : timeRange === "1M" ? 7 : timeRange === "3M" ? 14 : 30
    const buckets: { date: string; label: string; [k: string]: number | string }[] = []
    let current: { date: string; label: string; types: Record<string, number> } | null = null
    let dayCount = 0, bi = 0
    for (const entry of data) {
      if (!current || dayCount >= bucketSize) {
        if (current) buckets.push({ date: current.date, label: current.label, ...current.types })
        bi++
        current = { date: entry.date, label: timeRange === "1W" ? parseLocalDateString(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : `W${bi}`, types: {} }
        dayCount = 0
      }
      entry.types.forEach((t) => { current!.types[t] = (current!.types[t] || 0) + 1 })
      dayCount++
    }
    if (current) buckets.push({ date: current.date, label: current.label, ...current.types })
    return buckets
  }, [data, timeRange])

  const allTypes = React.useMemo(() => {
    const tc: Record<string, number> = {}
    data.forEach((e) => e.types.forEach((t) => { tc[t] = (tc[t] || 0) + 1 }))
    return Object.entries(tc).sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [data])

  const RoundedTop = React.useCallback((props: any) => {
    const { x, y, width, height, fill, dataKey, payload } = props
    if (!height || height <= 0) return null
    const isTop = allTypes.slice(allTypes.indexOf(dataKey) + 1).every((t) => !payload[t] || payload[t] === 0)
    if (isTop) {
      const r = 4
      return <path d={`M ${x},${y + height} L ${x},${y + r} Q ${x},${y} ${x + r},${y} L ${x + width - r},${y} Q ${x + width},${y} ${x + width},${y + r} L ${x + width},${y + height} Z`} fill={fill} />
    }
    return <rect x={x} y={y} width={width} height={height} fill={fill} />
  }, [allTypes])

  if (!chartData.length) return (
    <Card className="bg-card border-border p-4 shadow-none">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Type Trend</h3>
      <p className="text-muted-foreground text-center py-8">No data available</p>
    </Card>
  )

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <h3 className="text-sm font-medium text-muted-foreground -mb-1">Type Trend Over Time</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: -15, right: 10, left: 10, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#888" }} />
            <YAxis hide />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }}
              content={({ active, payload }) => active && payload?.length ? (
                <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                  <p className="text-xs font-medium text-foreground mb-1">{payload.reduce((s: number, p: any) => s + (p.value || 0), 0)} drinks</p>
                  {payload.map((p: any) => p.value > 0 && <div key={p.dataKey} className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} /><span>{p.dataKey}: {p.value}</span></div>)}
                </div>
              ) : null} />
            {allTypes.map((t) => <Bar key={t} dataKey={t} stackId="1" fill={STACKED_COLORS[t] || "#6b7280"} shape={RoundedTop as any} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <MarqueeLegend className="-mt-5">
        {allTypes.map((t) => (
          <div key={t} className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STACKED_COLORS[t] || "#6b7280" }} />
            <span className="text-xs text-muted-foreground">{t}</span>
          </div>
        ))}
      </MarqueeLegend>
    </Card>
  )
}

function DayOfWeekChart({ data }: { data: DrinkEntry[] }) {
  const dayData = React.useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    data.forEach((e) => { if (e.count > 0) counts[(parseLocalDateString(e.date).getDay() + 6) % 7] += e.count })
    return DAY_NAMES.map((name, i) => ({ day: name, drinks: counts[i] }))
  }, [data])
  const maxDrinks = Math.max(...dayData.map((d) => d.drinks), 1)
  return (
    <Card className="bg-card border-border px-4 pt-4 pb-2 shadow-none">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">By Day of Week</h3>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dayData} margin={{ top: 17, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#888" }} />
            <YAxis hide domain={[0, maxDrinks]} />
            <Tooltip position={{ y: -36 }} wrapperStyle={{ pointerEvents: "none" }} cursor={{ fill: "rgba(255,255,255,0.05)" }}
              content={({ active, payload }) => active && payload?.[0] ? (
                <div className="bg-popover border border-border rounded-lg px-2.5 py-1.5">
                  <p className="text-xs font-medium text-foreground">{payload[0].payload.drinks} {payload[0].payload.drinks === 1 ? "drink" : "drinks"}</p>
                  <p className="text-[10px] text-muted-foreground">{payload[0].payload.day}</p>
                </div>
              ) : null} />
            <Bar dataKey="drinks" fill="#60a5fa" radius={[4, 4, 0, 0]} />
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
        {[["Received", stats.totalReceived.toString()], ["Given", stats.totalGiven.toString()], ["Avg/Post", stats.avgPerPost.toFixed(1)]].map(([label, val]) => (
          <div key={label} className="text-center py-2">
            <p className="text-2xl font-semibold">{val}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function DrinkBreakdown({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!data.length) return <Card className="bg-card border-border p-4 shadow-none"><p className="text-muted-foreground text-center py-8">No data available</p></Card>
  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="flex flex-col md:flex-row items-center gap-1">
        <div className="w-full md:w-1/2 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={({ active, payload }) => active && payload?.[0] ? (
                <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                  <p className="text-sm font-medium text-foreground">{payload[0].payload.name}</p>
                  <p className="text-xs text-muted-foreground">{payload[0].payload.value} ({((payload[0].payload.value / total) * 100).toFixed(1)}%)</p>
                </div>
              ) : null} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full md:w-1/2 space-y-3 mb-1 max-h-[140px] overflow-y-auto">
          {data.map((item, i) => {
            const pct = ((item.value / total) * 100).toFixed(1)
            return (
              <div key={item.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground truncate">{item.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
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
  const color = "#4ade80"
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = React.useState<number | null>(null)
  const [tooltip, setTooltip] = React.useState<{ date: string; count: number; x: number; y: number } | null>(null)
  const gap = timeRange === "1W" || timeRange === "1M" ? 6 : 3
  const rounded = timeRange === "1W" || timeRange === "1M" ? 6 : 3

  const dataByDate = React.useMemo(() => { const m = new Map<string, number>(); data.forEach((e) => m.set(e.date, e.count)); return m }, [data])

  const gridData = React.useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let start: Date
    switch (timeRange) {
      case "1W": start = new Date(today.getTime() - 6 * 86400000); break
      case "1M": start = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()); break
      case "3M": start = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()); break
      case "6M": start = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()); break
      case "1Y": start = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()); break
      case "YTD": start = new Date(today.getFullYear(), 0, 1); break
      default: start = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
    }
    start.setHours(0, 0, 0, 0)
    if (timeRange !== "1W" && timeRange !== "1M") { const off = (start.getDay() + 6) % 7; start.setDate(start.getDate() - off) }
    const days: { date: string; count: number; dayOfWeek: number; weekIndex: number }[] = []
    const cur = new Date(start); let wi = 0
    while (cur <= today) {
      const ds = getLocalDateString(cur)
      days.push({ date: ds, count: dataByDate.get(ds) ?? 0, dayOfWeek: (cur.getDay() + 6) % 7, weekIndex: wi })
      cur.setDate(cur.getDate() + 1)
      if (cur.getDay() === 1) wi++
    }
    return days
  }, [dataByDate, timeRange])

  const weeks = React.useMemo(() => {
    const m = new Map<number, typeof gridData>()
    gridData.forEach((d) => { if (!m.has(d.weekIndex)) m.set(d.weekIndex, []); m.get(d.weekIndex)!.push(d) })
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]).map(([, d]) => d)
  }, [gridData])

  const monthLabels = React.useMemo(() => {
    const mw = new Map<string, { month: number; weekIndices: number[] }>()
    gridData.forEach((d) => {
      const dt = parseLocalDateString(d.date)
      const k = `${dt.getFullYear()}-${dt.getMonth()}`
      if (!mw.has(k)) mw.set(k, { month: dt.getMonth(), weekIndices: [] })
      const e = mw.get(k)!
      if (!e.weekIndices.includes(d.weekIndex)) e.weekIndices.push(d.weekIndex)
    })
    return Array.from(mw.entries()).sort((a, b) => (a[1].weekIndices[0] ?? 0) - (b[1].weekIndices[0] ?? 0)).map(([, { month, weekIndices }]) => {
      weekIndices.sort((a, b) => a - b)
      return { month: MONTH_LABELS[month], weekIndex: weekIndices[Math.floor(weekIndices.length / 2)] }
    })
  }, [gridData])

  const activeDays = React.useMemo(() => gridData.filter((d) => d.count > 0).length, [gridData])

  React.useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      if (timeRange === "1W" || timeRange === "1M") {
        setCellSize(Math.floor((w - 6 * gap) / 7))
      } else {
        setCellSize(Math.max(Math.floor((w - 24 - 13 * gap) / 14), 8))
      }
    }
    calc(); window.addEventListener("resize", calc); return () => window.removeEventListener("resize", calc)
  }, [timeRange, weeks.length, gap])

  const Cell = ({ day }: { day: (typeof gridData)[0] }) => (
    <div className="cursor-pointer hover:ring-1 hover:ring-foreground/50 transition-all"
      style={{ width: cellSize!, height: cellSize!, borderRadius: rounded, backgroundColor: day.count > 0 ? color : "rgba(128,128,128,0.2)" }}
      onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ date: day.date, count: day.count, x: r.left + r.width / 2, y: r.top }) }}
      onMouseLeave={() => setTooltip(null)} />
  )

  const TooltipEl = () => tooltip ? (
    <div className="fixed z-50 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap" style={{ left: tooltip.x, top: tooltip.y - 8, transform: "translate(-50%, -100%)" }}>
      <p className="text-sm font-medium text-foreground">{tooltip.count} {tooltip.count === 1 ? "drink" : "drinks"}</p>
      <p className="text-xs text-muted-foreground">{parseLocalDateString(tooltip.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
    </div>
  ) : null

  if (cellSize === null) return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="-mb-2 flex items-baseline gap-1.5">
        <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
        <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
      </div>
      <div ref={containerRef} className="h-10" />
    </Card>
  )

  if (timeRange === "1W") return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="-mb-2 flex items-baseline gap-1.5">
        <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
        <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
      </div>
      <div ref={containerRef}>
        <div className="flex mb-2" style={{ gap }}>{gridData.map((d) => <div key={`l-${d.date}`} className="text-xs text-muted-foreground text-center" style={{ width: cellSize }}>{DAY_NAMES[d.dayOfWeek][0]}</div>)}</div>
        <div className="flex" style={{ gap }}>{gridData.map((d) => <Cell key={d.date} day={d} />)}</div>
      </div>
      <TooltipEl />
    </Card>
  )

  if (timeRange === "1M") return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="-mb-2 flex items-baseline gap-1.5">
        <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
        <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
      </div>
      <div ref={containerRef}>
        <div className="flex mb-2" style={{ gap }}>{DAY_NAMES.map((d) => <div key={d} className="text-xs text-muted-foreground text-center" style={{ width: cellSize }}>{d[0]}</div>)}</div>
        <div className="flex flex-col" style={{ gap }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex" style={{ gap }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const day = week.find((d) => d.dayOfWeek === di)
                return day ? <Cell key={day.date} day={day} /> : <div key={`e-${wi}-${di}`} style={{ width: cellSize, height: cellSize }} />
              })}
            </div>
          ))}
        </div>
      </div>
      <TooltipEl />
    </Card>
  )

  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="-mb-2 flex items-baseline gap-1.5">
        <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
        <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
      </div>
      <div ref={containerRef} className="overflow-x-auto">
        <div className="relative h-4 mb-1" style={{ marginLeft: 24 }}>
          {monthLabels.map((l, i) => <div key={`${l.month}-${i}`} className="text-xs text-muted-foreground absolute" style={{ left: l.weekIndex * (cellSize + gap) }}>{l.month}</div>)}
        </div>
        <div className="flex">
          <div className="flex flex-col mr-2" style={{ gap, width: 16 }}>
            {DAY_NAMES.map((d, i) => <div key={d} className={cn("text-xs text-muted-foreground flex items-center", i % 2 === 1 ? "opacity-0" : "")} style={{ height: cellSize }}>{d[0]}</div>)}
          </div>
          <div className="flex" style={{ gap }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap }}>
                {Array.from({ length: 7 }).map((_, di) => {
                  const day = week.find((d) => d.dayOfWeek === di)
                  return day ? <Cell key={day.date} day={day} /> : <div key={`e-${wi}-${di}`} style={{ width: cellSize, height: cellSize }} />
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <TooltipEl />
    </Card>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function FriendAnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const username = params.username as string

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [allData, setAllData] = React.useState<DrinkEntry[]>([])
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M")
  const [cardOrder, setCardOrder] = React.useState<CardId[]>(DEFAULT_CARD_ORDER)

  // Raw cheers — fetched once, filtered reactively
  const [rawReceivedCheers, setRawReceivedCheers] = React.useState<{ drink_log_id: string; user_id: string }[]>([])
  const [rawGivenCheers, setRawGivenCheers] = React.useState<{ drink_log_id: string; user_id: string; created_at: string }[]>([])

  // ── Single fetch replaces 7 sequential round trips ────────────────────────
  React.useEffect(() => {
    async function load() {
      setError(null)
      setLoading(true)
      try {
        const { data: sessRes } = await supabase.auth.getSession()
        const token = sessRes.session?.access_token
        if (!token) {
          router.replace(`/login?redirectTo=%2Fprofile%2F${username}%2Fanalytics`)
          return
        }

        const res = await fetch(`/api/profile/${encodeURIComponent(username)}/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => ({}))

        if (res.ok && json.redirect) {
          router.replace(json.redirect)
          return
        }
        if (!res.ok) {
          if (res.status === 403) setError(json?.error ?? "You must be friends to view their analytics")
          else if (res.status === 404) setError("User not found")
          else throw new Error(json?.error ?? "Could not load analytics.")
          return
        }

        setAllData(transformDrinkLogs(json.logs ?? []))
        setRawReceivedCheers(json.receivedCheers ?? [])
        setRawGivenCheers(json.givenCheers ?? [])
        if (json.analyticsCardOrder && isValidCardOrder(json.analyticsCardOrder)) {
          setCardOrder(json.analyticsCardOrder)
        }
      } catch (e: any) {
        setError(e?.message ?? "Could not load analytics.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase, username])

  // ── All reactive computation unchanged ───────────────────────────────────

  const filteredData = React.useMemo(() => {
    const now = new Date()
    const { start } = getDateRangeForTimeRange(timeRange, now)
    const todayStr = getLocalDateString(now)
    const byDate = new Map(allData.map((e) => [e.date, e]))
    const result: DrinkEntry[] = []
    const cur = new Date(start)
    while (getLocalDateString(cur) <= todayStr) {
      const ds = getLocalDateString(cur)
      result.push(byDate.get(ds) ?? { date: ds, count: 0, types: [], hours: [], drinkIds: [], captions: [] })
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }, [allData, timeRange])

  const cheersStats = React.useMemo<CheersStats>(() => {
    const now = new Date()
    const { start: rangeStart } = getDateRangeForTimeRange(timeRange, now)
    const filteredIds = new Set(filteredData.flatMap((d) => d.drinkIds))
    const received = rawReceivedCheers.filter((c) => filteredIds.has(c.drink_log_id))
    const given = rawGivenCheers.filter((c) => new Date(c.created_at) >= rangeStart)
    return {
      totalReceived: received.length,
      totalGiven: given.length,
      avgPerPost: filteredIds.size > 0 ? received.length / filteredIds.size : 0,
    }
  }, [filteredData, rawReceivedCheers, rawGivenCheers, timeRange])

  const kpiData = React.useMemo(() => {
    const totalDrinks = filteredData.reduce((s, d) => s + d.count, 0)
    const avgPerDay = filteredData.length > 0 ? totalDrinks / filteredData.length : 0
    const mostInADay = Math.max(...filteredData.map((d) => d.count), 0)
    const tc: Record<string, number> = {}
    filteredData.forEach((d) => d.types.forEach((t) => { tc[t] = (tc[t] || 0) + 1 }))
    const sorted = Object.entries(tc).sort((a, b) => b[1] - a[1])
    const top = sorted[0]?.[1] ?? 0
    const mostCommon = sorted.filter(([, c]) => c === top).map(([n]) => n).join("/") || "N/A"
    return { totalDrinks, avgPerDay, mostInADay, mostCommon }
  }, [filteredData])

  const streakData = React.useMemo(() => {
    let longest = 0, temp = 0, daysSince = 0, found = false
    filteredData.forEach((e) => { if (e.count > 0) { temp++; longest = Math.max(longest, temp) } else temp = 0 })
    for (let i = filteredData.length - 1; i >= 0; i--) {
      if (filteredData[i].count > 0) { found = true; break }
      daysSince++
    }
    return { longestStreak: longest, daysSinceLastDrink: found ? daysSince : filteredData.length }
  }, [filteredData])

  const breakdownData = React.useMemo(() => {
    const tc: Record<string, number> = {}
    filteredData.forEach((d) => d.types.forEach((t) => { tc[t] = (tc[t] || 0) + 1 }))
    return Object.entries(tc).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
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

  const header = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center justify-center rounded-full border p-2 shrink-0" aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ResponsiveTitle text={titleText} />
      </div>
      <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
    </div>
  )

  if (loading) {
    return (
      <div className="container max-w-2xl px-3 py-1.5">
        {header}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[1,2,3,4,5,6].map((i) => (
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
        {header}
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl px-3 py-1.5 pb-0">
      {header}
      <div className="space-y-4">
        <KpiCards data={{ ...kpiData, ...streakData }} />
        {cardOrder.map((cardId) => <div key={cardId}>{cardComponents[cardId]}</div>)}
      </div>
    </div>
  )
}