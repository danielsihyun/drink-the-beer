"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Plus, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const DRINK_EMOJI: Record<string, string> = {
  Beer: "🍺",
  Wine: "🍷",
  Cocktail: "🍸",
  Spirit: "🥃",
  Shot: "🥂",
  Seltzer: "🧊",
  Other: "🍹",
}

type CollectionInfo = {
  id: string
  name: string
  emoji: string
  gradient: string
}

type CollectionDrink = {
  id: string
  name: string
  category: string
  imageUrl: string | null
}

export default function CollectionDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const collectionId = params.id as string

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [collection, setCollection] = React.useState<CollectionInfo | null>(null)
  const [drinks, setDrinks] = React.useState<CollectionDrink[]>([])

  React.useEffect(() => {
    async function load() {
      try {
        const { data: sessRes } = await supabase.auth.getSession()
        const token = sessRes.session?.access_token
        if (!token) { router.replace("/login"); return }

        const res = await fetch(`/api/discover/collections/${collectionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error ?? "Failed to load collection")

        setCollection(json.collection ?? null)
        setDrinks(json.drinks ?? [])
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [collectionId, supabase, router])

  if (loading) {
    return (
      <div className="container max-w-md mx-auto px-4 py-4 space-y-5">
        {/* Back button */}
        <button className="flex items-center gap-2 text-sm text-neutral-500 dark:text-white/40">
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            <div className="h-3 w-24 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
        </div>

        {/* Cards skeleton */}
        <div className="space-y-2 pb-24">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-3">
              <div className="h-20 w-20 rounded-2xl bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="h-3 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              </div>
              <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-md mx-auto px-4 py-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-neutral-500 dark:text-white/40 mb-6">
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="text-neutral-500 dark:text-white/45">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-md mx-auto px-4 py-4 pb-28">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-white/40 mb-5 transition-colors hover:text-neutral-700 dark:hover:text-white/60"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back</span>
      </button>

      {/* Collection Header */}
      {collection && (
        <div className="flex items-center gap-3.5 mb-6">
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl",
            collection.gradient
          )}>
            {collection.emoji}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{collection.name}</h1>
            <p className="text-[13px] text-neutral-500 dark:text-white/40 mt-0.5">{drinks.length} drinks</p>
          </div>
        </div>
      )}

      {/* Drinks list */}
      {drinks.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
          <p className="text-neutral-500 dark:text-white/45">No drinks in this collection yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drinks.map((drink) => (
            <div
              key={drink.id}
              className="flex items-center gap-4 rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-3 transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100/80 dark:bg-white/[0.06] border border-neutral-100 dark:border-white/[0.04]">
                {drink.imageUrl ? (
                  <Image src={drink.imageUrl} alt={drink.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="text-3xl">{DRINK_EMOJI[drink.category] ?? "🍹"}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight">{drink.name}</div>
                <div className="text-[12px] text-neutral-500 dark:text-white/35">{drink.category}</div>
              </div>

              <Link
                href="/log"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black shadow-sm transition-all active:scale-95 hover:bg-neutral-800 dark:hover:bg-neutral-100"
                aria-label="Log this drink"
              >
                <Plus className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}