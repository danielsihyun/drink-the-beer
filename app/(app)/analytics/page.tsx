"use client"

import * as React from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

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

const MOCK_DATA: Record<TimeRange, AnalyticsData> = {
  week: {
    totalDrinks: 12,
    avgPerDay: 1.7,
    maxInDay: 4,
    mostCommonType: "Beer",
    drinksPerDay: [
      { day: "Mon", count: 2 },
      { day: "Tue", count: 1 },
      { day: "Wed", count: 3 },
      { day: "Thu", count: 0 },
      { day: "Fri", count: 4 },
      { day: "Sat", count: 2 },
      { day: "Sun", count: 0 },
    ],
    typeBreakdown: [
      { type: "Beer", count: 6, percentage: 50 },
      { type: "Wine", count: 3, percentage: 25 },
      { type: "Cocktail", count: 2, percentage: 16.7 },
      { type: "Seltzer", count: 1, percentage: 8.3 },
    ],
  },
  month: {
    totalDrinks: 48,
    avgPerDay: 1.6,
    maxInDay: 5,
    mostCommonType: "Beer",
    drinksPerDay: [
      { day: "W1", count: 8 },
      { day: "W2", count: 12 },
      { day: "W3", count: 15 },
      { day: "W4", count: 13 },
    ],
    typeBreakdown: [
      { type: "Beer", count: 20, percentage: 41.7 },
      { type: "Wine", count: 12, percentage: 25 },
      { type: "Cocktail", count: 8, percentage: 16.7 },
      { type: "Seltzer", count: 5, percentage: 10.4 },
      { type: "Shot", count: 3, percentage: 6.2 },
    ],
  },
  year: {
    totalDrinks: 512,
    avgPerDay: 1.4,
    maxInDay: 6,
    mostCommonType: "Beer",
    drinksPerDay: [
      { day: "Jan", count: 35 },
      { day: "Feb", count: 42 },
      { day: "Mar", count: 48 },
      { day: "Apr", count: 44 },
      { day: "May", count: 50 },
      { day: "Jun", count: 52 },
      { day: "Jul", count: 48 },
      { day: "Aug", count: 45 },
      { day: "Sep", count: 40 },
      { day: "Oct", count: 38 },
      { day: "Nov", count: 35 },
      { day: "Dec", count: 35 },
    ],
    typeBreakdown: [
      { type: "Beer", count: 210, percentage: 41 },
      { type: "Wine", count: 140, percentage: 27.3 },
      { type: "Cocktail", count: 85, percentage: 16.6 },
      { type: "Seltzer", count: 50, percentage: 9.8 },
      { type: "Spirit", count: 20, percentage: 3.9 },
      { type: "Shot", count: 7, percentage: 1.4 },
    ],
  },
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
            stroke="black"
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

export default function AnalyticsPage() {
  const [range, setRange] = React.useState<TimeRange>("week")
  const [loading, setLoading] = React.useState(true)
  const [hasData, setHasData] = React.useState(false)

  React.useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => {
      setHasData(true)
      setLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  const data = MOCK_DATA[range]
  const maxDrinksPerDay = Math.max(...data.drinksPerDay.map((d) => d.count))

  function handleRangeChange(newRange: TimeRange) {
    setRange(newRange)
    setLoading(true)
    setTimeout(() => setLoading(false), 300)
  }

  return (
    <div className="container max-w-2xl px-4 py-6">
      <h2 className="mb-4 text-2xl font-bold">Analytics</h2>

      {loading ? (
        <LoadingSkeleton />
      ) : !hasData ? (
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
              <SummaryCard label="Avg per day" value={data.avgPerDay.toFixed(1)} />
              <SummaryCard label="Max in a day" value={data.maxInDay} />
              <SummaryCard label="Most common" value={data.mostCommonType} />
            </div>

            <LineGraph data={data.drinksPerDay} maxValue={maxDrinksPerDay} />
            <TypeBreakdown data={data.typeBreakdown} />
          </div>
        </>
      )}
    </div>
  )
}
