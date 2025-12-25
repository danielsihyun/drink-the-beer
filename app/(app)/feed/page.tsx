"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"

type DrinkLogRow = {
  id: string
  user_id: string
  photo_path: string
  drink_type: DrinkType
  caption: string | null
  created_at: string
}

type FeedItem = DrinkLogRow & {
  photoUrl: string | null
}

function formatTimestamp(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d)
}

export default function FeedPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<FeedItem[]>([])
  const [refreshing, setRefreshing] = React.useState(false)

  const load = React.useCallback(async () => {
    setError(null)
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user

      if (!user) {
        router.replace("/login?redirectTo=%2Ffeed")
        return
      }

      // 1) Fetch logs
      const { data: logs, error: logsErr } = await supabase
        .from("drink_logs")
        .select("id,user_id,photo_path,drink_type,caption,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (logsErr) throw logsErr

      const rows = (logs ?? []) as DrinkLogRow[]

      // 2) Create signed URLs for images in private bucket
      const signed = await Promise.all(
        rows.map(async (row) => {
          const { data, error: urlErr } = await supabase.storage
            .from("drink-photos")
            .createSignedUrl(row.photo_path, 60 * 60) // 1 hour

          if (urlErr) {
            // If this fails, still show the post card (image placeholder)
            return { ...row, photoUrl: null } as FeedItem
          }

          return { ...row, photoUrl: data?.signedUrl ?? null } as FeedItem
        })
      )

      setItems(signed)
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong loading your feed.")
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  React.useEffect(() => {
    load()
  }, [load])

  async function onRefresh() {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Feed</h2>
          <div className="h-9 w-24 animate-pulse rounded-full bg-foreground/10" />
        </div>

        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border bg-background/50 p-3">
              <div className="h-4 w-40 rounded bg-foreground/10" />
              <div className="mt-2 h-3 w-24 rounded bg-foreground/10" />
              <div className="mt-4 h-64 rounded-xl bg-foreground/10" />
              <div className="mt-3 h-7 w-20 rounded-full bg-foreground/10" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Feed</h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </button>

          <Link
            href="/log"
            className="inline-flex items-center gap-2 rounded-full border bg-black px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Log
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed">
            <Plus className="h-7 w-7 opacity-50" />
          </div>
          <h3 className="text-lg font-semibold">No posts yet</h3>
          <p className="mt-1 max-w-sm text-sm opacity-70">
            Post your first drink and it’ll show up here.
          </p>
          <Link href="/log" className="mt-6 rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
            Log a drink
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
          {items.map((it) => (
            <article key={it.id} className="rounded-2xl border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">you</p>
                  <p className="text-xs opacity-60">{formatTimestamp(it.created_at)}</p>
                </div>
                <span className="inline-flex rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
                  {it.drink_type}
                </span>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border">
                {it.photoUrl ? (
                  <Image
                    src={it.photoUrl}
                    alt={`${it.drink_type} drink`}
                    width={900}
                    height={900}
                    className="h-72 w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-72 w-full items-center justify-center bg-foreground/5 text-sm opacity-70">
                    Image unavailable
                  </div>
                )}
              </div>

              {it.caption ? <p className="mt-3 text-sm leading-relaxed">{it.caption}</p> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
