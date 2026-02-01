"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type DrinkEntry = {
  date: string
  count: number
  types: string[]
}

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"

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

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// Same green as the chart line
const ACTIVE_COLOR = "#4ade80"

export function ActivityGrid({ data, timeRange }: { data: DrinkEntry[]; timeRange: TimeRange }) {
  const isHorizontal = timeRange === "1W" || timeRange === "1M"

  // Build a map of date -> count for quick lookup
  const dataByDate = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of data) {
      map.set(entry.date, entry.count)
    }
    return map
  }, [data])

  // Calculate the grid data based on time range
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

    // Align to the previous Monday (skip for 1W to keep exactly 7 days)
    if (timeRange !== "1W") {
      const jsDay = startDate.getDay()
      const mondayOffset = (jsDay + 6) % 7 // Mon=0, Tue=1, ..., Sun=6
      startDate.setDate(startDate.getDate() - mondayOffset)
    }

    // Generate all days from startDate to today
    const days: { date: string; count: number; dayOfWeek: number; weekIndex: number }[] = []
    const current = new Date(startDate)
    let weekIndex = 0

    while (current <= today) {
      const dateStr = getLocalDateString(current)
      const count = dataByDate.get(dateStr) ?? 0
      // Convert to Monday-based index: Mon=0, Tue=1, ..., Sun=6
      const mondayBasedDay = (current.getDay() + 6) % 7

      days.push({
        date: dateStr,
        count,
        dayOfWeek: mondayBasedDay,
        weekIndex,
      })

      current.setDate(current.getDate() + 1)
      // New week starts on Monday (getDay() === 1)
      if (current.getDay() === 1) {
        weekIndex++
      }
    }

    return days
  }, [dataByDate, timeRange])

  // Group days into weeks
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

  // Calculate month labels and their positions (for vertical layout)
  const monthLabels = React.useMemo(() => {
    const labels: { month: string; weekIndex: number }[] = []
    let lastMonth = -1

    for (const day of gridData) {
      const date = parseLocalDateString(day.date)
      const month = date.getMonth()

      if (month !== lastMonth && day.dayOfWeek === 0) {
        labels.push({
          month: MONTH_LABELS[month],
          weekIndex: day.weekIndex,
        })
        lastMonth = month
      }
    }

    return labels
  }, [gridData])

  // Calculate totals
  const totalDrinks = React.useMemo(() => {
    return gridData.reduce((sum, d) => sum + d.count, 0)
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

  const formatTooltipDate = (dateStr: string) => {
    const date = parseLocalDateString(dateStr)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Get cell size based on time range
  const getCellConfig = () => {
    if (timeRange === "1W") {
      return { size: 36, gap: 8, rounded: 8 }
    }
    if (timeRange === "1M") {
      return { size: 28, gap: 6, rounded: 6 }
    }
    if (timeRange === "3M") {
      return { size: 14, gap: 3, rounded: 3 }
    }
    // 6M, 1Y, YTD
    return { size: 12, gap: 3, rounded: 3 }
  }

  const cellConfig = getCellConfig()
  const todayStr = getLocalDateString(new Date())

  // Special layout for 1W - show days sequentially in a single row
  if (timeRange === "1W") {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <div className="mb-4 flex items-baseline gap-1.5">
          <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
          <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
        </div>

        {/* Day labels header */}
        <div
          className="flex mb-2"
          style={{ gap: cellConfig.gap }}
        >
          {gridData.map((day) => (
            <div
              key={`label-${day.date}`}
              className="text-xs text-muted-foreground text-center"
              style={{ width: cellConfig.size }}
            >
              {DAY_LABELS[day.dayOfWeek].slice(0, 3)}
            </div>
          ))}
        </div>

        {/* Days in a single row */}
        <div className="flex" style={{ gap: cellConfig.gap }}>
          {gridData.map((day) => {
            const hasActivity = day.count > 0
            const isToday = day.date === todayStr

            return (
              <div
                key={day.date}
                className={cn(
                  "cursor-pointer transition-all",
                  isToday && "ring-1 ring-foreground/30",
                  "hover:ring-1 hover:ring-foreground/50"
                )}
                style={{
                  width: cellConfig.size,
                  height: cellConfig.size,
                  borderRadius: cellConfig.rounded,
                  backgroundColor: hasActivity ? ACTIVE_COLOR : "rgba(128, 128, 128, 0.2)",
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

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="text-sm font-medium text-foreground">
              {tooltip.count} {tooltip.count === 1 ? "drink" : "drinks"}
            </p>
            <p className="text-xs text-muted-foreground">{formatTooltipDate(tooltip.date)}</p>
          </div>
        )}
      </Card>
    )
  }

  // Horizontal layout for 1M
  if (isHorizontal) {
    return (
      <Card className="bg-card border-border p-4 shadow-none">
        <div className="mb-4 flex items-baseline gap-1.5">
          <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
          <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
        </div>

        {/* Day labels header */}
        <div
          className="flex mb-2"
          style={{ gap: cellConfig.gap }}
        >
          {DAY_LABELS.map((day) => (
            <div
              key={day}
              className="text-xs text-muted-foreground text-center"
              style={{ width: cellConfig.size }}
            >
              {timeRange === "1W" ? day.slice(0, 3) : day[0]}
            </div>
          ))}
        </div>

        {/* Weeks as rows */}
        <div className="flex flex-col" style={{ gap: cellConfig.gap }}>
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="flex" style={{ gap: cellConfig.gap }}>
              {Array.from({ length: 7 }).map((_, dayIdx) => {
                const day = week.find((d) => d.dayOfWeek === dayIdx)

                if (!day) {
                  return (
                    <div
                      key={`empty-${weekIdx}-${dayIdx}`}
                      style={{
                        width: cellConfig.size,
                        height: cellConfig.size,
                      }}
                    />
                  )
                }

                const hasActivity = day.count > 0
                const isToday = day.date === todayStr

                return (
                  <div
                    key={day.date}
                    className={cn(
                      "cursor-pointer transition-all",
                      isToday && "ring-1 ring-foreground/30",
                      "hover:ring-1 hover:ring-foreground/50"
                    )}
                    style={{
                      width: cellConfig.size,
                      height: cellConfig.size,
                      borderRadius: cellConfig.rounded,
                      backgroundColor: hasActivity ? ACTIVE_COLOR : "rgba(128, 128, 128, 0.2)",
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

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="text-sm font-medium text-foreground">
              {tooltip.count} {tooltip.count === 1 ? "drink" : "drinks"}
            </p>
            <p className="text-xs text-muted-foreground">{formatTooltipDate(tooltip.date)}</p>
          </div>
        )}
      </Card>
    )
  }

  // Vertical layout for 3M+ (GitHub style)
  return (
    <Card className="bg-card border-border p-4 shadow-none">
      <div className="mb-4 flex items-baseline gap-1.5">
        <p className="text-2xl font-semibold text-foreground">{activeDays}</p>
        <span className="text-xs text-muted-foreground">active {activeDays === 1 ? "day" : "days"}</span>
      </div>

      <div className="relative overflow-x-auto">
        {/* Month labels */}
        <div className="flex mb-1 ml-8">
          {monthLabels.map((label, i) => (
            <div
              key={`${label.month}-${i}`}
              className="text-xs text-muted-foreground"
              style={{
                position: "absolute",
                left: `${32 + label.weekIndex * (cellConfig.size + cellConfig.gap)}px`,
              }}
            >
              {label.month}
            </div>
          ))}
        </div>

        <div className="flex mt-5">
          {/* Day labels */}
          <div
            className="flex flex-col mr-2"
            style={{ gap: cellConfig.gap }}
          >
            {DAY_LABELS.map((day, i) => (
              <div
                key={day}
                className={cn(
                  "text-xs text-muted-foreground flex items-center",
                  i % 2 === 1 ? "opacity-0" : ""
                )}
                style={{ height: cellConfig.size }}
              >
                {day[0]}
              </div>
            ))}
          </div>

          {/* Grid - weeks as columns, days as rows */}
          <div className="flex" style={{ gap: cellConfig.gap }}>
            {weeks.map((week, weekIdx) => (
              <div
                key={weekIdx}
                className="flex flex-col"
                style={{ gap: cellConfig.gap }}
              >
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const day = week.find((d) => d.dayOfWeek === dayIdx)

                  if (!day) {
                    return (
                      <div
                        key={`empty-${weekIdx}-${dayIdx}`}
                        style={{
                          width: cellConfig.size,
                          height: cellConfig.size,
                        }}
                      />
                    )
                  }

                  const hasActivity = day.count > 0
                  const isToday = day.date === todayStr

                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "cursor-pointer transition-all",
                        isToday && "ring-1 ring-foreground/30",
                        "hover:ring-1 hover:ring-foreground/50"
                      )}
                      style={{
                        width: cellConfig.size,
                        height: cellConfig.size,
                        borderRadius: cellConfig.rounded,
                        backgroundColor: hasActivity ? ACTIVE_COLOR : "rgba(128, 128, 128, 0.2)",
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

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-sm font-medium text-foreground">
            {tooltip.count} {tooltip.count === 1 ? "drink" : "drinks"}
          </p>
          <p className="text-xs text-muted-foreground">{formatTooltipDate(tooltip.date)}</p>
        </div>
      )}
    </Card>
  )
}