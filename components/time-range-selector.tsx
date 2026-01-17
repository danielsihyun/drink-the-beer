"use client"

import { cn } from "@/lib/utils"
import type { TimeRange } from "./analytics-dashboard"

const timeRanges: TimeRange[] = ["1W", "1M", "3M", "6M", "1Y", "YTD"]

interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (value: TimeRange) => void
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
      {timeRanges.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
            value === range
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          {range}
        </button>
      ))}
    </div>
  )
}