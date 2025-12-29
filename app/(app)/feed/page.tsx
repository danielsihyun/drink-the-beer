"use client"

import * as React from "react"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { FilePenLine, Loader2, Plus, Trash2, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

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

/**
 * ✅ Matches Profile page modal exactly
 */
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 py-6" role="dialog" aria-modal="true">
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

  // Success banner control
  const [postedBanner, setPostedBanner] = React.useState(false)

  // edit/delete overlay state (only for your own posts)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [active, setActive] = React.useState<FeedItem | null>(null)

  const [postDrinkType, setPostDrinkType] = React.useState<DrinkType>("Beer")
  const [postCaption, setPostCaption] = React.useState("")
  const [postBusy, setPostBusy] = React.useState(false)
  const [postError, setPostError] = React.useState<string | null>(null)

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
      }))

      // already newest -> oldest, but safe:
      mapped.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))

      setItems(mapped)
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
            : p
        )
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
      const { error: delErr } = await supabase.from("drink_logs").delete().eq("id", active.id).eq("user_id", active.user_id)
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
              className="inline-flex items-center gap-2 rounded-full border bg-black px-4 text-sm font-medium text-white h-10 justify-center"
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
                  {it.avatarUrl ? (
                    <div className="relative h-10 w-10 overflow-hidden rounded-full">
                      <Image src={it.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: "#4ECDC4" }}
                    >
                      {it.username[0]?.toUpperCase() ?? "U"}
                    </div>
                  )}

                  <div className="flex-1">
                    <p className="text-sm font-medium">{it.username}</p>
                    <p className="text-xs opacity-60">{it.timestampLabel}</p>
                  </div>

                  <span className="inline-flex shrink-0 rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
                    {it.drink_type}
                  </span>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border">
                  <div className="relative aspect-square w-full">
                    {it.photoUrl ? (
                      <Image src={it.photoUrl} alt={`${it.drink_type} drink`} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-foreground/5 text-sm opacity-70">
                        Image unavailable
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                  <div className="flex h-7.5 items-center pl-2">
                    {it.caption ? (
                      <p className="text-sm leading-relaxed">{it.caption}</p>
                    ) : (
                      <p className="text-sm leading-relaxed opacity-50">No caption</p>
                    )}
                  </div>

                  {/* ✅ Only allow edit/delete for your own posts */}
                  {it.isMine ? (
                    <div className="flex items-end justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(it)}
                        className="inline-flex items-center justify-center text-foreground/70 transition-transform hover:scale-120 active:scale-[0.99]"
                        style={{ width: "30px", height: "30px" }}
                        aria-label="Edit post"
                        title="Edit"
                      >
                        <FilePenLine className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openDelete(it)}
                        className="inline-flex items-center justify-center text-red-400 transition-transform hover:scale-120 active:scale-[0.99]"
                        style={{ width: "30px", height: "30px" }}
                        aria-label="Delete post"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Edit popup */}
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
              <Image src={active.photoUrl || "/placeholder.svg"} alt="Post photo" fill className="object-cover" unoptimized />
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
                    className={[
                      "rounded-full border px-4 py-2 text-sm",
                      "active:scale-[0.99]",
                      selected ? "border-black bg-black text-white" : "bg-transparent hover:bg-foreground/5",
                    ].join(" ")}
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

      {/* ✅ Delete popup */}
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
              <Image src={active.photoUrl || "/placeholder.svg"} alt="Post photo" fill className="object-cover" unoptimized />
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
    <Suspense fallback={
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
    }>
      <FeedContent />
    </Suspense>
  )
}