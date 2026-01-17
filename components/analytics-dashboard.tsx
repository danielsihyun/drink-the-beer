"use client"

import { useState, useMemo } from "react"
import { KpiCards } from "./kpi-cards"
import { DrinkChart } from "./drink-chart"
import { DrinkBreakdown } from "./drink-breakdown"
import { TimeRangeSelector } from "./time-range-selector"
import type { DrinkEntry } from "@/lib/analytics-data"

export type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"

interface AnalyticsDashboardProps {
  data: DrinkEntry[]
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M")

  const filteredData = useMemo(() => {
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

    return data.filter((entry) => new Date(entry.date) >= startDate)
  }, [data, timeRange])

  const kpiData = useMemo(() => {
    const totalDrinks = filteredData.reduce((sum, day) => sum + day.count, 0)
    const daysWithData = filteredData.filter((d) => d.count > 0).length
    const avgPerDay = filteredData.length > 0 ? totalDrinks / filteredData.length : 0
    const mostInADay = Math.max(...filteredData.map((d) => d.count), 0)

    const typeCounts: Record<string, number> = {}
    filteredData.forEach((day) => {
      day.types.forEach((type) => {
        typeCounts[type] = (typeCounts[type] || 0) + 1
      })
    })

    const mostCommon = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"

    return { totalDrinks, avgPerDay, mostInADay, mostCommon }
  }, [filteredData])

  const breakdownData = useMemo(() => {
    const typeCounts: Record<string, number> = {}
    filteredData.forEach((day) => {
      day.types.forEach((type) => {
        typeCounts[type] = (typeCounts[type] || 0) + 1
      })
    })

    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }))
  }, [filteredData])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      <KpiCards data={kpiData} />
      <DrinkChart data={filteredData} timeRange={timeRange} />
      <DrinkBreakdown data={breakdownData} />
    </div>
  )
}