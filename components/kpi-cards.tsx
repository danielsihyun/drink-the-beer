"use client"

import { Card } from "@/components/ui/card"
import { GlassWater, TrendingUp, Trophy, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface KpiCardsProps {
  data: {
    totalDrinks: number
    avgPerDay: number
    mostInADay: number
    mostCommon: string
  }
}

export function KpiCards({ data }: KpiCardsProps) {
  const cards = [
    {
      label: "Total Drinks",
      value: data.totalDrinks.toString(),
      icon: GlassWater,
      color: "text-chart-1",
    },
    {
      label: "Avg per Day",
      value: data.avgPerDay.toFixed(1),
      icon: TrendingUp,
      color: "text-chart-2",
    },
    {
      label: "Most in a Day",
      value: data.mostInADay.toString(),
      icon: Trophy,
      color: "text-chart-3",
    },
    {
      label: "Most Common",
      value: data.mostCommon,
      icon: Star,
      color: "text-chart-4",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card border-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <card.icon className={cn("w-4 h-4", card.color)} />
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </div>
          <p className="text-2xl font-semibold text-foreground truncate">{card.value}</p>
        </Card>
      ))}
    </div>
  )
}