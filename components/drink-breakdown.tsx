"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

interface DrinkBreakdownProps {
  data: { name: string; value: number }[]
}

const COLORS = ["#4ade80", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf"]

export function DrinkBreakdown({ data }: DrinkBreakdownProps) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  if (data.length === 0) {
    return (
      <Card className="bg-card border-border p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Drink Type Breakdown</h3>
        <p className="text-muted-foreground text-center py-8">No data available</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-6 space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Drink Type Breakdown</h3>

      <div className="flex flex-col md:flex-row items-center gap-6">
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
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground truncate">{item.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">{percentage}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length],
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