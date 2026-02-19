"use client"

import * as React from "react"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { Check, ChevronDown, FilePenLine, Loader2, Plus, Trash2, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// --- Types ---
type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"
const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

type FeedApiItem = {
  id: string
  user_id: string
  photo_path: string
  drink_type: DrinkType
  drink_name: string | null
  caption: string | null
  created_at: string
  username: string
  avatarUrl: string | null
  photoUrl: string | null
  cheersCount: number
  cheeredByMe: boolean
}

type FeedItem = {
  id: string
  user_id: string
  photo_path: string
  drink_type: DrinkType
  drink_name: string | null
  caption: string | null
  created_at: string
  photoUrl: string | null
  username: string
  avatarUrl: string | null
  isMine: boolean
  timestampLabel: string
  cheersCount: number
  cheeredByMe: boolean
}

interface CheersUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

// --- Helpers ---

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

// --- Icons ---

function CheersIcon({ filled = false, className }: { filled?: boolean; className?: string }) {
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
      <g transform={filled ? "rotate(15, 8, 16)" : "translate(2,0)"} className="transition-transform duration-500 ease-spring">
        {filled && (
          <path
            d="M5 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2L5 9z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        <path
          d="M4 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3L4 6z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M8 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M5 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      <g transform={filled ? "rotate(-15, 24, 16)" : "translate(-2,0)"} className="transition-transform duration-500 ease-spring">
        {filled && (
          <path
            d="M21 9h6l-.8 4a2.5 2.5 0 0 1-2.2 2 2.5 2.5 0 0 1-2.2-2l-.8-4z"
            fill="rgba(251, 191, 36, 0.9)"
            stroke="none"
          />
        )}
        <path
          d="M20 6h8l-1 7a3 3 0 0 1-3 3 3 3 0 0 1-3-3l-1-7z"
          fill={filled ? "rgba(251, 191, 36, 0.3)" : "none"}
          stroke={filled ? "#d97706" : "currentColor"}
          strokeWidth="1.5"
        />
        <path d="M24 16v4" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
        <path d="M21 20h6" stroke={filled ? "#d97706" : "currentColor"} strokeWidth="1.5" />
      </g>

      {filled && (
        <g stroke="#fbbf24" className="animate-pulse">
          <path d="M16 -0.5v3" strokeWidth="1.5" />
          <g transform="translate(16, 0) scale(-1, 1) translate(-16, 0)">
            <path d="M19 3l2-2" strokeWidth="1.5" />
          </g>
          <path d="M19 3l2-2" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  )
}

// --- Components ---

function EditDrinkTypeDropdown({
  value,
  onChange,
  disabled,
}: {
  value: DrinkType
  onChange: (value: DrinkType) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative mt-5" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-neutral-200 dark:border-white/[0.1] bg-white/50 dark:bg-white/[0.06] backdrop-blur-sm px-4 py-4 text-sm transition-all duration-200",
          "active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10",
          open ? "ring-2 ring-black/5 dark:ring-white/10 bg-white dark:bg-white/[0.08]" : "hover:bg-white dark:hover:bg-white/[0.08]",
          disabled ? "opacity-50 cursor-not-allowed" : ""
        )}
      >
        <span className="font-medium text-neutral-900 dark:text-white">{value}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-neutral-500 dark:text-white/40 transition-transform duration-300",
            open ? "rotate-180" : ""
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-neutral-200/50 dark:border-white/[0.08] bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl shadow-xl ring-1 ring-black/5 dark:ring-white/[0.06] animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-[240px] overflow-y-auto p-1">
            {DRINK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onChange(t)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  t === value
                    ? "bg-black/5 dark:bg-white/[0.08] font-semibold text-black dark:text-white"
                    : "text-neutral-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/[0.06] hover:text-black dark:hover:text-white"
                )}
              >
                <span>{t}</span>
                {t === value && <Check className="h-4 w-4 text-black dark:text-white" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CheersListModal({
  drinkLogId,
  cheersCount,
  onClose,
}: {
  drinkLogId: string
  cheersCount: number
  onClose: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [users, setUsers] = React.useState<CheersUser[]>([])
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  React.useEffect(() => {
    async function fetchCheers() {
      setLoading(true)
      setError(null)
      try {
        const { data: cheersData, error: cheersErr } = await supabase
          .from("drink_cheers")
          .select("user_id, created_at")
          .eq("drink_log_id", drinkLogId)
          .order("created_at", { ascending: false })

        if (cheersErr) throw cheersErr

        if (!cheersData || cheersData.length === 0) {
          setUsers([])
          setLoading(false)
          return
        }

        const userIds = [...new Set(cheersData.map((c) => c.user_id))]
        const { data: profilesData, error: profilesErr } = await supabase
          .from("profile_public_stats")
          .select("id, username, display_name, avatar_path")
          .in("id", userIds)

        if (profilesErr) throw profilesErr
        const profilesMap = new Map((profilesData ?? []).map((p: any) => [p.id, p]))

        const avatarPaths = cheersData.map((cheer: any) => {
          const profile = profilesMap.get(cheer.user_id)
          return profile?.avatar_path ?? null
        })

        const avatarUrls = await Promise.all(
          avatarPaths.map((path: string | null) =>
            path
              ? supabase.storage.from("profile-photos").createSignedUrl(path, 60 * 60).then(r => r.data?.signedUrl ?? null)
              : Promise.resolve(null)
          )
        )

        const cheersUsers: CheersUser[] = cheersData.map((cheer: any, i: number) => {
          const profile = profilesMap.get(cheer.user_id)
          return {
            id: profile?.id ?? cheer.user_id,
            username: profile?.username ?? "Unknown",
            displayName: profile?.display_name ?? profile?.username ?? "Unknown",
            avatarUrl: avatarUrls[i],
          }
        })
        setUsers(cheersUsers)
      } catch (e: any) {
        setError(e?.message ?? "Failed to load cheers")
      } finally {
        setLoading(false)
      }
    }
    fetchCheers()
  }, [drinkLogId, supabase])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[360px] overflow-hidden rounded-3xl border border-white/20 dark:border-white/[0.08] bg-white/90 dark:bg-neutral-900/90 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-10 duration-300">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/[0.06] px-5 py-4">
          <div className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">Cheers ({cheersCount})</div>
          <button onClick={onClose} className="rounded-full bg-black/5 dark:bg-white/10 p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/15">
            <X className="h-4 w-4 text-neutral-500 dark:text-white/50" />
          </button>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400 dark:text-white/30" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-500 dark:text-red-400">{error}</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-neutral-400 dark:text-white/40">No cheers yet</div>
          ) : (
            <div className="space-y-1">
              {users.map((user) => (
                <Link
                  key={user.id}
                  href={`/profile/${user.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/[0.06]"
                >
                  {user.avatarUrl ? (
                    <div className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
                      <Image src={user.avatarUrl} alt={user.username} fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-1 ring-black/5 dark:ring-white/10">
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-neutral-400 dark:text-white/30">
                        <circle cx="12" cy="8" r="4" fill="currentColor" />
                        <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{user.displayName}</p>
                    <p className="text-xs text-neutral-500 dark:text-white/40 truncate">@{user.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function OverlayPage({
  title,
  children,
  onClose,
  onSave,
  saving,
  saveIcon,
  saveIconClassName,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  onSave?: () => void
  saving?: boolean
  saveIcon?: React.ReactNode
  saveIconClassName?: string
}) {
  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[400px] overflow-hidden rounded-[2rem] border border-white/20 dark:border-white/[0.08] bg-white dark:bg-neutral-900 shadow-2xl animate-in slide-in-from-bottom-12 zoom-in-95 duration-300">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] px-5 py-4 backdrop-blur-md">
          <div className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">{title}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-white/50 transition-colors hover:bg-neutral-200 dark:hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
            {onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-95",
                  saving ? "bg-neutral-100 dark:bg-white/10" : "bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100",
                  saveIconClassName
                )}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400 dark:text-white/30" /> : (saveIcon || <Check className="h-4 w-4" />)}
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-6">{children}</div>
      </div>
    </div>
  )
}

// --- Main Content ---

function FeedContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<FeedItem[]>([])
  
  // Pagination
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  // Refs to avoid stale closures in the intersection observer
  const nextCursorRef = React.useRef<string | null>(null)
  const loadingMoreRef = React.useRef(false)
  const viewerIdRef = React.useRef<string | null>(null)

  const [viewerId, setViewerId] = React.useState<string | null>(null)

  // Keep refs in sync with state
  React.useEffect(() => { nextCursorRef.current = nextCursor }, [nextCursor])
  React.useEffect(() => { loadingMoreRef.current = loadingMore }, [loadingMore])
  React.useEffect(() => { viewerIdRef.current = viewerId }, [viewerId])
  const [postedBanner, setPostedBanner] = React.useState(false)

  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [active, setActive] = React.useState<FeedItem | null>(null)

  const [postDrinkType, setPostDrinkType] = React.useState<DrinkType>("Beer")
  const [postCaption, setPostCaption] = React.useState("")
  const [postBusy, setPostBusy] = React.useState(false)
  const [postError, setPostError] = React.useState<string | null>(null)

  const [cheersBusy, setCheersBusy] = React.useState<Record<string, boolean>>({})
  const [cheersAnimating, setCheersAnimating] = React.useState<Record<string, boolean>>({})
  const [cheersListPost, setCheersListPost] = React.useState<FeedItem | null>(null)

  // Stable ref for token so we can use it in fetchPage without re-renders
  const tokenRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (searchParams.get("posted") === "1") {
      setPostedBanner(true)
      router.replace("/feed")
    }
  }, [searchParams, router])

  React.useEffect(() => {
    if (postedBanner) {
      const t = setTimeout(() => setPostedBanner(false), 4000)
      return () => clearTimeout(t)
    }
  }, [postedBanner])

  /* ── Fetch a page of feed items ──────────────────────────────── */

  const fetchPage = React.useCallback(async (
    token: string,
    userId: string,
    cursor: string | null,
  ): Promise<{ mapped: FeedItem[]; nextCursor: string | null }> => {
    const params = new URLSearchParams()
    if (cursor) params.set("cursor", cursor)
    params.set("limit", "10")

    const res = await fetch(`/api/feed?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error ?? "Could not load feed.")

    const mapped: FeedItem[] = (json?.items ?? []).map((it: FeedApiItem) => ({
      ...it,
      photoUrl: it.photoUrl ?? null,
      avatarUrl: it.avatarUrl ?? null,
      isMine: it.user_id === userId,
      timestampLabel: formatCardTimestamp(it.created_at),
      cheersCount: it.cheersCount ?? 0,
      cheeredByMe: it.cheeredByMe ?? false,
    }))

    return { mapped, nextCursor: json?.nextCursor ?? null }
  }, [])

  /* ── Initial load ────────────────────────────────────────────── */

  const load = React.useCallback(async () => {
    setError(null)
    try {
      const { data: sessRes } = await supabase.auth.getSession()
      const session = sessRes.session
      if (!session?.user) { router.replace("/login?redirectTo=%2Ffeed"); return }

      const user = session.user
      const token = session.access_token
      setViewerId(user.id)
      tokenRef.current = token

      const { mapped, nextCursor: nc } = await fetchPage(token, user.id, null)

      setItems(mapped)
      setNextCursor(nc)
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong loading your feed.")
    } finally {
      setLoading(false)
    }
  }, [router, supabase, fetchPage])

  React.useEffect(() => { load() }, [load])

  /* ── Load more (next page) ───────────────────────────────────── */

  const loadMore = React.useCallback(async () => {
    const cursor = nextCursorRef.current
    const viewer = viewerIdRef.current
    const token = tokenRef.current

    if (loadingMoreRef.current || !cursor || !viewer || !token) return

    setLoadingMore(true)
    loadingMoreRef.current = true

    try {
      const { mapped, nextCursor: nc } = await fetchPage(token, viewer, cursor)

      if (mapped.length > 0) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((p) => p.id))
          const newItems = mapped.filter((m) => !existingIds.has(m.id))
          return [...prev, ...newItems]
        })
        setNextCursor(nc)
        nextCursorRef.current = nc
      } else {
        setNextCursor(null)
        nextCursorRef.current = null
      }
    } catch (e: any) {
      console.error("Failed to load more:", e)
    } finally {
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [fetchPage])

  /* ── Intersection observer for infinite scroll ───────────────── */

  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: "400px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  /* ── Actions ─────────────────────────────────────────────────── */

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
    if (!active || !active.isMine) return
    setPostError(null)
    setPostBusy(true)
    try {
      const nextCaption = postCaption.trim()
      const { error: updErr } = await supabase.from("drink_logs").update({ drink_type: postDrinkType, caption: nextCaption.length ? nextCaption : null }).eq("id", active.id).eq("user_id", active.user_id)
      if (updErr) throw updErr

      setItems(prev => prev.map(p => p.id === active.id ? { ...p, drink_type: postDrinkType, caption: nextCaption.length ? nextCaption : null } : p))
      setEditOpen(false)
      setActive(null)
    } catch (e: any) { setPostError(e?.message) } finally { setPostBusy(false) }
  }

  async function confirmDelete() {
    if (!active || !active.isMine) return
    setPostError(null)
    setPostBusy(true)
    try {
      const { error: delErr } = await supabase.from("drink_logs").delete().eq("id", active.id).eq("user_id", active.user_id)
      if (delErr) throw delErr
      if (active.photo_path) await supabase.storage.from("drink-photos").remove([active.photo_path])
      setItems(prev => prev.filter(p => p.id !== active.id))
      setDeleteOpen(false)
      setActive(null)
    } catch (e: any) { setPostError(e?.message) } finally { setPostBusy(false) }
  }

  async function toggleCheers(it: FeedItem) {
    if (!viewerId || cheersBusy[it.id]) return
    const nextCheered = !it.cheeredByMe
    const nextCount = Math.max(0, it.cheersCount + (nextCheered ? 1 : -1))

    if (nextCheered) {
      setCheersAnimating(p => ({ ...p, [it.id]: true }))
      setTimeout(() => setCheersAnimating(p => ({ ...p, [it.id]: false })), 600)
    }

    setCheersBusy(p => ({ ...p, [it.id]: true }))
    setItems(prev => prev.map(p => p.id === it.id ? { ...p, cheeredByMe: nextCheered, cheersCount: nextCount } : p))

    try {
      const { data } = await supabase.rpc("toggle_cheer", { p_drink_log_id: it.id, p_user_id: viewerId })
      const row = Array.isArray(data) ? data[0] : data
      setItems(prev => prev.map(p => p.id === it.id ? { ...p, cheeredByMe: Boolean(row?.cheered), cheersCount: Number(row?.cheers_count ?? nextCount) } : p))
    } catch {
      setItems(prev => prev.map(p => p.id === it.id ? { ...p, cheeredByMe: it.cheeredByMe, cheersCount: it.cheersCount } : p))
    } finally {
      setCheersBusy(p => ({ ...p, [it.id]: false }))
    }
  }

  // --- Skeletons ---
  if (loading) {
    return (
      <div className="container max-w-md mx-auto px-0 sm:px-4 py-4 space-y-5">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Feed</h2>
          <div className="h-10 w-28 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                  <div className="h-3 w-32 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
            {/* Photo */}
            <div className="aspect-square w-full bg-neutral-100 dark:bg-white/[0.04] animate-pulse" />
            {/* Actions */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-4">
              <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-3.5 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="container max-w-md mx-auto px-0 sm:px-4 py-4 pb-24">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between px-2">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Feed</h2>
          <Link
            href="/log"
            className="group flex h-10 items-center gap-2 rounded-full bg-black dark:bg-white px-4 text-sm font-medium text-white dark:text-black shadow-sm transition-all duration-200 active:scale-95 hover:bg-neutral-800 dark:hover:bg-neutral-100 hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Log Drink</span>
          </Link>
        </div>

        {postedBanner && (
          <div className="mb-6 animate-in slide-in-from-top-4 fade-in duration-500 rounded-2xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/10 backdrop-blur-md px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Cheers! Your drink has been posted.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="mt-20 flex flex-col items-center text-center">
            <Link
              href="/friends"
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-neutral-300 dark:border-white/15 bg-white/50 dark:bg-white/[0.04] text-neutral-400 dark:text-white/25 transition-colors hover:border-neutral-400 dark:hover:border-white/25 hover:text-neutral-500 dark:hover:text-white/40"
            >
              <Plus className="h-8 w-8" />
            </Link>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">No posts yet</h3>
            <p className="mt-2 max-w-xs text-sm text-neutral-500 dark:text-white/45 leading-relaxed">
              It's looking a bit empty here. Add your friends or log your first drink to get the party started!
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((it) => (
              <article 
                key={it.id} 
                className="group relative overflow-hidden rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-4">
                  <Link href={`/profile/${it.username}`} className="flex items-center gap-3 group/profile">
                    {it.avatarUrl ? (
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white dark:ring-neutral-800 shadow-sm border border-neutral-100 dark:border-white/[0.06]">
                        <Image
                          src={it.avatarUrl}
                          alt="Profile"
                          fill
                          className="object-cover transition-transform duration-500 group-hover/profile:scale-110"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-2 ring-white dark:ring-neutral-800 shadow-sm">
                        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-neutral-400 dark:text-white/30">
                          <circle cx="12" cy="8" r="4" fill="currentColor" />
                          <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
                        </svg>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight">{it.username}</span>
                      <span className="text-[13px] text-neutral-500 dark:text-white/40 font-medium">{it.timestampLabel}</span>
                    </div>
                  </Link>

                  {/* Drink pill — specific name when available, category fallback */}
                  <span className="inline-flex items-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1 text-xs font-medium text-neutral-500 dark:text-white/50 max-w-[160px] truncate">
                    {it.drink_name ?? it.drink_type}
                  </span>
                </div>

                {/* Photo Area */}
                <div>
                  <div className="relative aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-white/[0.04]">
                    {it.photoUrl ? (
                      <Image
                        src={it.photoUrl}
                        alt={`${it.drink_type} drink`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-neutral-400 dark:text-white/20 text-sm">No Image</div>
                    )}
                  </div>
                </div>

                {/* Actions & Caption Area */}
                <div className="flex flex-col gap-1 px-4 pt-4 pb-4">
                  
                  {/* Action Buttons Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleCheers(it)}
                        disabled={!!cheersBusy[it.id]}
                        className={cn(
                          "relative flex items-center justify-center transition-all duration-300 active:scale-90",
                          cheersAnimating[it.id] ? "scale-125" : "hover:scale-105"
                        )}
                      >
                         {cheersAnimating[it.id] && (
                           <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/20" />
                         )}
                        <CheersIcon filled={it.cheeredByMe} className={cn("h-8 w-8", it.cheeredByMe ? "text-amber-500" : "text-neutral-800 dark:text-white/50")} />
                      </button>
                      
                      {it.cheersCount > 0 && (
                        <button
                          onClick={() => setCheersListPost(it)}
                          className="text-[15px] font-semibold text-neutral-900 dark:text-white hover:text-neutral-600 dark:hover:text-white/70 transition-colors"
                        >
                          {it.cheersCount} <span className="font-normal text-neutral-500 dark:text-white/40">cheers</span>
                        </button>
                      )}
                    </div>

                    {/* Edit/Delete Buttons */}
                    {it.isMine && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => openEdit(it)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 dark:text-white/25 transition-all duration-150 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-neutral-700 dark:hover:text-white/60"
                          aria-label="Edit post"
                        >
                          <FilePenLine className="h-[18px] w-[18px]" />
                        </button>
                        <button
                          onClick={() => openDelete(it)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 dark:text-red-400/40 transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                          aria-label="Delete post"
                        >
                          <Trash2 className="h-[18px] w-[18px]" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Caption */}
                  {it.caption && (
                    <div className="pl-1">
                      <p className="text-[15px] leading-relaxed text-neutral-800 dark:text-white/75">
                        {it.caption}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="py-4 flex justify-center">
              {loadingMore && (
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400 dark:text-white/30" />
              )}
              {!loadingMore && !nextCursor && items.length > 0 && (
                <p className="text-[13px] text-neutral-400 dark:text-white/25">You're all caught up</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {cheersListPost && (
        <CheersListModal
          drinkLogId={cheersListPost.id}
          cheersCount={cheersListPost.cheersCount}
          onClose={() => setCheersListPost(null)}
        />
      )}

      {editOpen && active && (
        <OverlayPage
          title="Edit Drink"
          onClose={() => { if (!postBusy) { setEditOpen(false); setActive(null) } }}
          onSave={saveEdits}
          saving={postBusy}
        >
          {postError && <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-500 dark:text-red-400">{postError}</div>}
          <div className="flex gap-4">
             <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-white/[0.04] ring-1 ring-black/5 dark:ring-white/[0.06]">
                <Image src={active.photoUrl || "/placeholder.svg"} alt="Preview" fill className="object-cover" unoptimized />
             </div>
             <div className="flex-1">
               <EditDrinkTypeDropdown value={postDrinkType} onChange={setPostDrinkType} disabled={postBusy} />
             </div>
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-neutral-500 dark:text-white/40">Caption</label>
            <textarea
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              className="w-full resize-none rounded-2xl border border-neutral-200 dark:border-white/[0.1] bg-neutral-50 dark:bg-white/[0.04] p-4 text-base text-neutral-900 dark:text-white placeholder:text-neutral-300 dark:placeholder:text-white/20 focus:border-black/20 dark:focus:border-white/20 focus:bg-white dark:focus:bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-white/10 transition-all"
              rows={4}
              maxLength={200}
              disabled={postBusy}
            />
          </div>
        </OverlayPage>
      )}

      {deleteOpen && active && (
        <OverlayPage
          title="Delete Post?"
          onClose={() => { if (!postBusy) { setDeleteOpen(false); setActive(null) } }}
          onSave={confirmDelete}
          saving={postBusy}
          saveIcon={<Trash2 className="h-4 w-4" />}
          saveIconClassName="bg-red-500 hover:bg-red-600 text-white"
        >
          <p className="mb-6 text-neutral-600 dark:text-white/55">This action cannot be undone. The photo and cheers associated with this log will be removed permanently.</p>
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-white/[0.04] opacity-80 grayscale">
            <Image src={active.photoUrl || "/placeholder.svg"} alt="Preview" fill className="object-cover" unoptimized />
          </div>
        </OverlayPage>
      )}
    </>
  )
}

export default function FeedPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400 dark:text-white/30">Loading feed...</div>}>
      <FeedContent />
    </Suspense>
  )
}