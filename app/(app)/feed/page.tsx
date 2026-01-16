"use client"

import * as React from "react"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { FilePenLine, Loader2, Plus, Trash2, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"
const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

type FeedApiItem = {
  id: string
  user_id: string
  photo_path: string
  drink_type: DrinkType
  caption: string | null
  created_at: string
  username: string
  avatarUrl: string | null
  photoUrl: string | null
}

type FeedItem = {
  id: string
  user_id: string
  photo_path: string
  drink_type: DrinkType
  caption: string | null
  created_at: string
  photoUrl: string | null
  username: string
  avatarUrl: string | null
  isMine: boolean
  timestampLabel: string

  // ✅ Cheers state
  cheersCount: number
  cheeredByMe: boolean
}

function formatCardTimestamp(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  const month = d.toLocaleString("en-US", { month: "short" })
  const day = d.getDate()
  const year2 = String(d.getFullYear()).slice(-2)

  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  if (hours === 0) hours = 12

  return `${month} ${day}, ${year2}' at ${hours}:${minutes}${ampm}`
}

// ✅ Custom clinking wine glasses icon
interface CheersIconProps {
  filled?: boolean
  className?: string
}

function CheersIcon({ filled = false, className }: CheersIconProps) {
  return (
    <svg
      viewBox="0 -4 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Left wine glass - rotated when filled, straight when not */}
      <g transform={filled ? "rotate(15, 8, 16)" : "translate(2,0)"}>
        {/* Liquid FIRST (behind glass) - taller fill */}
        {filled && (
          <path
            d="M5 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2L5 9z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        {/* Glass outline SECOND (on top) */}
        <path
          d="M4 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3L4 6z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M8 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M5 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      {/* Right wine glass - rotated when filled, straight when not */}
      <g transform={filled ? "rotate(-15, 24, 16)" : "translate(-2,0)"}>
        {/* Liquid FIRST (behind glass) - taller fill */}
        {filled && (
          <path
            d="M21 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2l-.8-4z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        {/* Glass outline SECOND (on top) */}
        <path
          d="M20 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3l-1-7z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M24 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M21 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      {/* Clink sparkles - only show when filled */}
      {filled && (
        <g stroke="#fbbf24">
          {/* Center line - vertical */}
          <path d="M16 -0.5v3" strokeWidth="1.5" />
          {/* Left line - mirrored from right */}
          <g transform="translate(16, 0) scale(-1, 1) translate(-16, 0)">
            <path d="M19 3l2-2" strokeWidth="1.5" />
          </g>
          {/* Right line - angled +45° (going up-right) */}
          <path d="M19 3l2-2" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  )
}

function OverlayPage({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="container max-w-2xl px-4">
        <div className="mx-auto w-[50%] min-w-[320px] overflow-hidden rounded-2xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-base font-semibold">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full"
              aria-label="Close"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[80vh] overflow-y-auto px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

function FeedContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<FeedItem[]>([])
  const [refreshing, setRefreshing] = React.useState(false)

  const [viewerId, setViewerId] = React.useState<string | null>(null)

  const [postedBanner, setPostedBanner] = React.useState(false)

  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [active, setActive] = React.useState<FeedItem | null>(null)

  const [postDrinkType, setPostDrinkType] = React.useState<DrinkType>("Beer")
  const [postCaption, setPostCaption] = React.useState("")
  const [postBusy, setPostBusy] = React.useState(false)
  const [postError, setPostError] = React.useState<string | null>(null)

  // Prevent double-tapping cheers while a request is in-flight for that post
  const [cheersBusy, setCheersBusy] = React.useState<Record<string, boolean>>({})

  // Track animation state for burst effect
  const [cheersAnimating, setCheersAnimating] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    const posted = searchParams.get("posted")
    if (posted === "1") {
      setPostedBanner(true)
      router.replace("/feed")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  React.useEffect(() => {
    if (!postedBanner) return
    const t = window.setTimeout(() => setPostedBanner(false), 5000)
    return () => window.clearTimeout(t)
  }, [postedBanner])

  const loadCheersState = React.useCallback(
    async (postIds: string[], currentViewerId: string) => {
      if (!postIds.length) return

      // RPC returns: { drink_log_id, cheers_count, cheered }
      const { data, error: rpcErr } = await supabase.rpc("get_cheers_state", {
        post_ids: postIds,
        viewer_id: currentViewerId,
      })

      if (rpcErr) throw rpcErr

      const rows = (data ?? []) as Array<{
        drink_log_id: string
        cheers_count: number
        cheered: boolean
      }>

      const byId = new Map<string, { count: number; cheered: boolean }>()
      for (const r of rows) {
        byId.set(r.drink_log_id, { count: Number(r.cheers_count ?? 0), cheered: Boolean(r.cheered) })
      }

      setItems((prev) =>
        prev.map((it) => {
          const s = byId.get(it.id)
          if (!s) return it
          return { ...it, cheersCount: s.count, cheeredByMe: s.cheered }
        }),
      )
    },
    [supabase],
  )

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

      setViewerId(user.id)

      const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) throw sessErr
      const token = sessRes.session?.access_token
      if (!token) throw new Error("Missing session token. Please log out and back in.")

      const res = await fetch("/api/feed", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Could not load feed.")

      const base = (json?.items ?? []) as FeedApiItem[]

      const mapped: FeedItem[] = base.map((it) => ({
        id: it.id,
        user_id: it.user_id,
        photo_path: it.photo_path,
        drink_type: it.drink_type,
        caption: it.caption,
        created_at: it.created_at,
        photoUrl: it.photoUrl ?? null,
        username: it.username,
        avatarUrl: it.avatarUrl ?? null,
        isMine: it.user_id === user.id,
        timestampLabel: formatCardTimestamp(it.created_at),

        // ✅ default until we load from RPC
        cheersCount: 0,
        cheeredByMe: false,
      }))

      mapped.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      setItems(mapped)

      // ✅ load cheers counts + whether viewer cheered
      const ids = mapped.map((m) => m.id)
      await loadCheersState(ids, user.id)
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong loading your feed.")
    } finally {
      setLoading(false)
    }
  }, [router, supabase, loadCheersState])

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

  function openEdit(it: FeedItem) {
    setActive(it)
    setPostDrinkType(it.drink_type)
    setPostCaption(it.caption ?? "")
    setPostError(null)
    setEditOpen(true)
  }

  function openDelete(it: FeedItem) {
    setActive(it)
    setPostError(null)
    setDeleteOpen(true)
  }

  async function saveEdits() {
    if (!active) return
    if (!active.isMine) return

    setPostError(null)
    setPostBusy(true)
    try {
      const nextCaption = postCaption.trim()
      const { error: updErr } = await supabase
        .from("drink_logs")
        .update({
          drink_type: postDrinkType,
          caption: nextCaption.length ? nextCaption : null,
        })
        .eq("id", active.id)
        .eq("user_id", active.user_id)

      if (updErr) throw updErr

      setItems((prev) =>
        prev.map((p) =>
          p.id === active.id
            ? {
                ...p,
                drink_type: postDrinkType,
                caption: nextCaption.length ? nextCaption : null,
              }
            : p,
        ),
      )

      setEditOpen(false)
      setActive(null)
    } catch (e: any) {
      setPostError(e?.message ?? "Could not update post.")
    } finally {
      setPostBusy(false)
    }
  }

  async function confirmDelete() {
    if (!active) return
    if (!active.isMine) return

    setPostError(null)
    setPostBusy(true)
    try {
      const { error: delErr } = await supabase
        .from("drink_logs")
        .delete()
        .eq("id", active.id)
        .eq("user_id", active.user_id)
      if (delErr) throw delErr

      if (active.photo_path) {
        await supabase.storage.from("drink-photos").remove([active.photo_path])
      }

      setItems((prev) => prev.filter((p) => p.id !== active.id))

      setDeleteOpen(false)
      setActive(null)
    } catch (e: any) {
      setPostError(e?.message ?? "Could not delete post.")
    } finally {
      setPostBusy(false)
    }
  }

  async function toggleCheers(it: FeedItem) {
    if (!viewerId) return
    if (cheersBusy[it.id]) return

    // Optimistic UI
    const nextCheered = !it.cheeredByMe
    const nextCount = Math.max(0, it.cheersCount + (nextCheered ? 1 : -1))

    // Trigger animation only when cheering (not uncheering)
    if (nextCheered) {
      setCheersAnimating((p) => ({ ...p, [it.id]: true }))
      setTimeout(() => setCheersAnimating((p) => ({ ...p, [it.id]: false })), 600)
    }

    setCheersBusy((p) => ({ ...p, [it.id]: true }))
    setItems((prev) =>
      prev.map((p) =>
        p.id === it.id
          ? {
              ...p,
              cheeredByMe: nextCheered,
              cheersCount: nextCount,
            }
          : p,
      ),
    )

    try {
      const { data, error: rpcErr } = await supabase.rpc("toggle_cheer", {
        p_drink_log_id: it.id,
        p_user_id: viewerId,
      })
      if (rpcErr) throw rpcErr

      // RPC returns one row: { cheered, cheers_count }
      const row = Array.isArray(data) ? data[0] : data
      const cheered = Boolean(row?.cheered)
      const cheers_count = Number(row?.cheers_count ?? nextCount)

      // Reconcile with server truth
      setItems((prev) =>
        prev.map((p) =>
          p.id === it.id
            ? {
                ...p,
                cheeredByMe: cheered,
                cheersCount: cheers_count,
              }
            : p,
        ),
      )
    } catch {
      // Roll back on failure
      setItems((prev) =>
        prev.map((p) =>
          p.id === it.id
            ? {
                ...p,
                cheeredByMe: it.cheeredByMe,
                cheersCount: it.cheersCount,
              }
            : p,
        ),
      )
    } finally {
      setCheersBusy((p) => ({ ...p, [it.id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="container max-w-2xl px-3 py-1.5">
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
    <>
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Feed</h2>

          <div className="flex items-center gap-2">
            <Link
              href="/log"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border bg-black px-4 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              <span className="leading-none">Log</span>
            </Link>
          </div>
        </div>

        {postedBanner ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Posted!
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center text-center">
            <Link
              href="/friends"
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed"
              aria-label="Add friends"
              title="Add friends"
            >
              <Plus className="h-7 w-7 opacity-50" />
            </Link>

            <h3 className="text-lg font-semibold">No posts yet</h3>
            <p className="mt-1 max-w-sm text-sm opacity-70">Add your friends to build out your feed!</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
            {items.map((it) => (
              <article key={it.id} className="rounded-2xl border bg-background/50 p-3">
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${it.username}`} className="flex min-w-0 flex-1 items-center gap-2">
                    {it.avatarUrl ? (
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                        <Image
                          src={it.avatarUrl || "/placeholder.svg"}
                          alt="Profile"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                        style={{ backgroundColor: "#4ECDC4" }}
                      >
                        {it.username[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium hover:underline">{it.username}</p>
                      <p className="text-xs opacity-60">{it.timestampLabel}</p>
                    </div>
                  </Link>

                  <span className="inline-flex shrink-0 rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
                    {it.drink_type}
                  </span>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border">
                  <div className="relative aspect-square w-full">
                    {it.photoUrl ? (
                      <Image
                        src={it.photoUrl || "/placeholder.svg"}
                        alt={`${it.drink_type} drink`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-foreground/5 text-sm opacity-70">
                        Image unavailable
                      </div>
                    )}
                  </div>
                </div>

                {/* ✅ Cheers button + edit/delete on same row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0">
                    <button
                      type="button"
                      onClick={() => toggleCheers(it)}
                      disabled={!!cheersBusy[it.id]}
                      className={cn(
                        "relative inline-flex items-center justify-center p-1",
                        "transition-all duration-200",
                        it.cheeredByMe ? "text-amber-500" : "text-foreground",
                        cheersBusy[it.id] ? "opacity-70" : "",
                        cheersAnimating[it.id] ? "animate-bounce-beer" : "active:scale-95 hover:scale-110",
                      )}
                      aria-pressed={it.cheeredByMe}
                      aria-label={it.cheeredByMe ? "Uncheer" : "Cheer"}
                      title={it.cheeredByMe ? "Uncheer" : "Cheer"}
                    >
                      <CheersIcon filled={it.cheeredByMe} className="h-10 w-10" />

                      {/* Burst effect on cheer */}
                      {cheersAnimating[it.id] && it.cheeredByMe && (
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="absolute h-8 w-8 animate-ping rounded-full bg-amber-400/30 translate-y-0.25 -translate-x-0.25" />
                        </span>
                      )}
                    </button>

                    {/* Count outside the button */}
                    {it.cheersCount > 0 && (
                      <span className="text-base font-semibold text-foreground/70 translate-y-0.25">{it.cheersCount}</span>
                    )}
                  </div>

                  {/* Edit/Delete buttons - only for own posts */}
                  {it.isMine && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(it)}
                        className="inline-flex items-center justify-center text-foreground/70 transition-transform hover:scale-[1.2] active:scale-[0.99]"
                        style={{ width: "30px", height: "30px" }}
                        aria-label="Edit post"
                        title="Edit"
                      >
                        <FilePenLine className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openDelete(it)}
                        className="inline-flex items-center justify-center text-red-400 transition-transform hover:scale-[1.2] active:scale-[0.99]"
                        style={{ width: "30px", height: "30px" }}
                        aria-label="Delete post"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Caption - full width */}
                <div className="-mt-1.5 mb-1 pl-2">
                  {it.caption ? (
                    <p className="text-sm leading-relaxed">{it.caption}</p>
                  ) : (
                    <p className="text-sm leading-relaxed opacity-50">No caption</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {editOpen && active ? (
        <OverlayPage
          title="Edit post"
          onClose={() => {
            if (postBusy) return
            setEditOpen(false)
            setActive(null)
            setPostError(null)
          }}
        >
          {postError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {postError}
            </div>
          ) : null}

          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-background/50">
            <div className="relative aspect-square w-full">
              <Image
                src={active.photoUrl || "/placeholder.svg"}
                alt="Post photo"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border bg-background/50 p-3">
            <div className="text-sm font-medium">Drink type</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DRINK_TYPES.map((t) => {
                const selected = t === postDrinkType
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPostDrinkType(t)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm",
                      "active:scale-[0.99]",
                      selected ? "border-black bg-black text-white" : "bg-transparent hover:bg-foreground/5",
                    )}
                    aria-pressed={selected}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-background/50 p-3">
            <div className="text-sm font-medium">Caption</div>
            <textarea
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              placeholder="Update your caption…"
              className="mt-3 h-28 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
              maxLength={200}
              disabled={postBusy}
            />
            <div className="mt-2 text-right text-xs opacity-60">{postCaption.length}/200</div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (postBusy) return
                setEditOpen(false)
                setActive(null)
                setPostError(null)
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              disabled={postBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={saveEdits}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-black px-4 py-2.5 text-sm font-medium text-white"
              disabled={postBusy}
            >
              {postBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </OverlayPage>
      ) : null}

      {deleteOpen && active ? (
        <OverlayPage
          title="Delete post"
          onClose={() => {
            if (postBusy) return
            setDeleteOpen(false)
            setActive(null)
            setPostError(null)
          }}
        >
          {postError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {postError}
            </div>
          ) : null}

          <div className="rounded-2xl border bg-background/50 p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold">Are you sure?</div>
                <p className="mt-1 text-sm opacity-70">This action cannot be undone.</p>
              </div>
            </div>
          </div>

          <div className="mt-5 mx-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-background/50">
            <div className="relative aspect-square w-full">
              <Image
                src={active.photoUrl || "/placeholder.svg"}
                alt="Post photo"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (postBusy) return
                setDeleteOpen(false)
                setActive(null)
                setPostError(null)
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              disabled={postBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmDelete}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-200"
              disabled={postBusy}
            >
              {postBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </button>
          </div>
        </OverlayPage>
      ) : null}
    </>
  )
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-2xl px-3 py-1.5">
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
      }
    >
      <FeedContent />
    </Suspense>
  )
}