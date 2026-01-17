export interface DrinkEntry {
    date: string
    count: number
    types: string[]
  }
  
  export interface DrinkLogRow {
    id: string
    drink_type: string
    created_at: string
  }
  
  export function transformDrinkLogs(logs: DrinkLogRow[]): DrinkEntry[] {
    const byDate: Record<string, { count: number; types: string[] }> = {}
  
    for (const log of logs) {
      const date = new Date(log.created_at).toISOString().split("T")[0]
  
      if (!byDate[date]) {
        byDate[date] = { count: 0, types: [] }
      }
  
      byDate[date].count += 1
      byDate[date].types.push(log.drink_type)
    }
  
    // Convert to array and sort by date
    return Object.entries(byDate)
      .map(([date, data]) => ({
        date,
        count: data.count,
        types: data.types,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }