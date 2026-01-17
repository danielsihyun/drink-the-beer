"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { transformDrinkLogs, type DrinkLogRow } from "@/lib/analytics-data"

export default function AnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<ReturnType<typeof transformDrinkLogs>>([])

  React.useEffect(() => {
    async function load() {
      setError(null)
      setLoading(true)

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!userRes.user) {
          router.replace("/login?redirectTo=%2Fanalytics")
          return
        }

        const { data: logs, error: logsErr } = await supabase
          .from("drink_logs")
          .select("id, drink_type, created_at")
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: true })

        if (logsErr) throw logsErr

        const transformed = transformDrinkLogs((logs ?? []) as DrinkLogRow[])
        setData(transformed)
      } catch (e: any) {
        setError(e?.message ?? "Could not load analytics.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Analytics</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Analytics</h2>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl px-3 py-1.5 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
      <AnalyticsDashboard data={data} />
    </div>
  )
}