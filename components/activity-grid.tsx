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
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// Same green as the chart line
const ACTIVE_COLOR = "#4ade80"

export function ActivityGrid({ data, timeRange }: { data: DrinkEntry[]; timeRange: TimeRange }) {
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
    
    // Align to the previous Sunday
    const dayOfWeek = startDate.getDay()
    startDate.setDate(startDate.getDate() - dayOfWeek)
    
    // Generate all days from startDate to today
    const days: { date: string; count: number; dayOfWeek: number; weekIndex: number }[] = []
    const current = new Date(startDate)
    let weekIndex = 0
    
    while (current <= today) {
      const dateStr = getLocalDateString(current)
      const count = dataByDate.get(dateStr) ?? 0
      
      days.push({
        date: dateStr,
        count,
        dayOfWeek: current.getDay(),
        weekIndex,
      })
      
      current.setDate(current.getDate() + 1)
      if (current.getDay() === 0) {
        weekIndex++
      }
    }
    
    return days
  }, [dataByDate, timeRange])

  // Group days into weeks (columns)
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

  // Calculate month labels and their positions
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
    return gridData.filter(d => d.count > 0).length
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

  return (
    <Card className="bg-card border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{totalDrinks}</span> drinks over{" "}
          <span className="font-medium text-foreground">{activeDays}</span> days
        </div>
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
                left: `${32 + label.weekIndex * 15}px`,
              }}
            >
              {label.month}
            </div>
          ))}
        </div>

        <div className="flex mt-5">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mr-2 pt-0">
            {DAY_LABELS.map((day, i) => (
              <div
                key={day}
                className={cn(
                  "text-xs text-muted-foreground h-[12px] flex items-center",
                  i % 2 === 1 ? "opacity-0" : ""
                )}
              >
                {day[0]}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-[3px]">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const day = week.find(d => d.dayOfWeek === dayIdx)
                  
                  if (!day) {
                    return (
                      <div
                        key={`empty-${weekIdx}-${dayIdx}`}
                        className="w-[12px] h-[12px]"
                      />
                    )
                  }

                  const hasActivity = day.count > 0
                  const today = getLocalDateString(new Date())
                  const isToday = day.date === today

                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "w-[12px] h-[12px] rounded-[3px] cursor-pointer transition-all",
                        isToday && "ring-1 ring-foreground/30",
                        "hover:ring-1 hover:ring-foreground/50"
                      )}
                      style={{
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

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-4">
          <div
            className="w-[12px] h-[12px] rounded-[3px]"
            style={{ backgroundColor: "rgba(128, 128, 128, 0.2)" }}
          />
          <span className="text-xs text-muted-foreground">No drinks</span>
          <div
            className="w-[12px] h-[12px] rounded-[3px] ml-2"
            style={{ backgroundColor: ACTIVE_COLOR }}
          />
          <span className="text-xs text-muted-foreground">Drinks logged</span>
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
          <p className="text-xs text-muted-foreground">
            {formatTooltipDate(tooltip.date)}
          </p>
        </div>
      )}
    </Card>
  )
}