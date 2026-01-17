"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import type { DrinkEntry } from "@/lib/analytics-data"
import type { TimeRange } from "./analytics-dashboard"

interface DrinkChartProps {
  data: DrinkEntry[]
  timeRange: TimeRange
}

export function DrinkChart({ data, timeRange }: DrinkChartProps) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const chartData = data.map((entry) => ({
    date: entry.date,
    count: entry.count,
    displayDate: formatDate(entry.date, timeRange),
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
                        <p className="text-sm font-medium text-foreground">{payload[0].payload.count} drinks</p>
                        <p className="text-xs text-muted-foreground">{payload[0].payload.displayDate}</p>
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

function formatDate(dateStr: string, timeRange: TimeRange): string {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions =
    timeRange === "1W"
      ? { weekday: "short" }
      : timeRange === "1M" || timeRange === "3M"
        ? { month: "short", day: "numeric" }
        : { month: "short", year: "2-digit" }
  return date.toLocaleDateString("en-US", options)
}