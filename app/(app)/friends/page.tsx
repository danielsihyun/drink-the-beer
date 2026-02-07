"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Search, ArrowUpDown, Plus, Check, X, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type FriendSort = "name_asc" | "name_desc" | "since_new" | "since_old"

type SearchProfileRow = {
  id: string
  username: string
  display_name: string
  avatar_path: string | null
  friend_count: number
  drink_count: number
  outgoing_pending?: boolean
}

type PendingIncomingRow = {
  friendshipId: string
  requesterId: string
  createdAt: string
  username: string
  display_name: string
  avatar_path: string | null
  friend_count: number
  drink_count: number
}

type UiPerson = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  friendCount: number
  drinkCount: number
  friendshipCreatedAt?: string
  outgoingPending?: boolean
}

type UiPending = {
  friendshipId: string
  requesterId: string
  createdAt: string
  username: string
  displayName: string
  avatarUrl: string | null
  friendCount: number
  drinkCount: number
}

function sortLabel(s: FriendSort) {
  if (s === "name_asc") return "A → Z"
  if (s === "name_desc") return "Z → A"
  if (s === "since_new") return "Newest"
  return "Oldest"
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
  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[400px] overflow-hidden rounded-[2rem] border border-white/20 dark:border-white/[0.08] bg-white dark:bg-neutral-900 shadow-2xl animate-in slide-in-from-bottom-12 zoom-in-95 duration-300">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] px-5 py-4 backdrop-blur-md">
          <div className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-white/50 transition-colors hover:bg-neutral-200 dark:hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-5 py-6">{children}</div>
      </div>
    </div>
  )
}

function PersonCard({
  avatarUrl,
  username,
  displayName,
  friendCount,
  drinkCount,
  actions,
}: {
  avatarUrl: string | null
  username: string
  displayName: string
  friendCount: number
  drinkCount: number
  actions?: React.ReactNode
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-4">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${username}`} className="flex items-center gap-3 flex-1 min-w-0 group/profile">
          {avatarUrl ? (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white dark:ring-neutral-800 shadow-sm border border-neutral-100 dark:border-white/[0.06]">
              <Image
                src={avatarUrl}
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

          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight truncate">{displayName}</div>
            <div className="text-[13px] text-neutral-500 dark:text-white/40 font-medium truncate">@{username}</div>

            <div className="mt-1.5 flex gap-4 text-[13px]">
              <div>
                <span className="font-semibold text-neutral-900 dark:text-white">{friendCount}</span>{" "}
                <span className="text-neutral-500 dark:text-white/40">friends</span>
              </div>
              <div>
                <span className="font-semibold text-neutral-900 dark:text-white">{drinkCount}</span>{" "}
                <span className="text-neutral-500 dark:text-white/40">drinks</span>
              </div>
            </div>
          </div>
        </Link>

        {actions && <div className="shrink-0 flex items-center gap-1.5">{actions}</div>}
      </div>
    </article>
  )
}

export default function FriendsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [meId, setMeId] = React.useState<string | null>(null)

  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<UiPerson[]>([])

  const [pending, setPending] = React.useState<UiPending[]>([])
  const [pendingBusyId, setPendingBusyId] = React.useState<string | null>(null)

  const [friends, setFriends] = React.useState<UiPerson[]>([])
  const [sort, setSort] = React.useState<FriendSort>("name_asc")
  const [showSortMenu, setShowSortMenu] = React.useState(false)

  const sortMenuRef = React.useRef<HTMLDivElement>(null)

  const [toastMsg, setToastMsg] = React.useState<string | null>(null)
  const toastTimerRef = React.useRef<number | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3000)
  }

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const [outgoingPendingIds, setOutgoingPendingIds] = React.useState<Record<string, true>>({})

  const loadFriends = React.useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user
      if (!user) {
        router.replace("/login?redirectTo=%2Ffeed")
        return
      }

      setMeId(user.id)

      const { data: friendships, error: fErr } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, created_at")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted")
        .limit(500)

      if (fErr) throw fErr

      const friendIds = (friendships ?? []).map((f: any) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      )

      const friendshipMap = new Map(
        (friendships ?? []).map((f: any) => {
          const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id
          return [friendId, f.created_at]
        })
      )

      if (friendIds.length === 0) {
        setFriends([])
      } else {
        const { data: profiles, error: pErr } = await supabase
          .from("profile_public_stats")
          .select("id, username, display_name, avatar_path, friend_count, drink_count")
          .in("id", friendIds)

        if (pErr) throw pErr

        const avatarPaths = (profiles ?? []).map((p: any) => p.avatar_path)
        const avatarUrls = await Promise.all(
          avatarPaths.map((path: string | null) =>
            path
              ? supabase.storage.from("profile-photos").createSignedUrl(path, 60 * 60).then(r => r.data?.signedUrl ?? null)
              : Promise.resolve(null)
          )
        )

        const mappedFriends: UiPerson[] = (profiles ?? []).map((r: any, i: number) => ({
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          avatarUrl: avatarUrls[i],
          friendCount: r.friend_count ?? 0,
          drinkCount: r.drink_count ?? 0,
          friendshipCreatedAt: friendshipMap.get(r.id),
        }))

        setFriends(mappedFriends)
      }

      const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) throw sessErr
      const token = sessRes.session?.access_token
      if (!token) throw new Error("Missing session token. Please log out and back in.")

      const pendingRes = await fetch("/api/friends/pending-incoming", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })

      const pendingJson = await pendingRes.json().catch(() => ({}))
      if (!pendingRes.ok) throw new Error(pendingJson?.error ?? "Could not load pending requests.")

      const pendingRows = (pendingJson?.items ?? []) as PendingIncomingRow[]

      const pendingAvatarUrls = await Promise.all(
        pendingRows.map((p) =>
          p.avatar_path
            ? supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60).then(r => r.data?.signedUrl ?? null)
            : Promise.resolve(null)
        )
      )

      const mappedPending: UiPending[] = pendingRows.map((p, i) => ({
        friendshipId: p.friendshipId,
        requesterId: p.requesterId,
        createdAt: p.createdAt,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: pendingAvatarUrls[i],
        friendCount: p.friend_count ?? 0,
        drinkCount: p.drink_count ?? 0,
      }))

      setPending(mappedPending)
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong loading your friends.")
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  React.useEffect(() => {
    loadFriends()
  }, [loadFriends])

  React.useEffect(() => {
    if (!friends.length) return
    setOutgoingPendingIds((prev) => {
      let changed = false
      const next = { ...prev }
      for (const f of friends) {
        if (next[f.id]) {
          delete next[f.id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [friends])

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false)
      }
    }

    if (showSortMenu) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showSortMenu])

  React.useEffect(() => {
    if (!meId) return

    let myFriendshipIds = new Set<string>()

    const fetchMyFriendshipIds = async () => {
      const { data } = await supabase
        .from("friendships")
        .select("id")
        .or(`requester_id.eq.${meId},addressee_id.eq.${meId}`)

      myFriendshipIds = new Set((data ?? []).map((r) => r.id))
    }

    fetchMyFriendshipIds()

    const friendshipsChannel = supabase
      .channel("friends-page-friendships")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        (payload) => {
          const newRow = payload.new as any
          const oldRow = payload.old as any

          let shouldReload = false

          if (payload.eventType === "DELETE") {
            const deletedId = oldRow?.id
            if (deletedId && myFriendshipIds.has(deletedId)) {
              shouldReload = true
            }
          } else {
            const involvesMe =
              newRow?.requester_id === meId ||
              newRow?.addressee_id === meId ||
              oldRow?.requester_id === meId ||
              oldRow?.addressee_id === meId

            if (involvesMe) {
              shouldReload = true
              if (payload.eventType === "INSERT" && newRow?.id) {
                myFriendshipIds.add(newRow.id)
              }
            }
          }

          if (shouldReload) {
            loadFriends().then(() => {
              fetchMyFriendshipIds()
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(friendshipsChannel)
    }
  }, [meId, supabase, loadFriends])

  React.useEffect(() => {
    if (!meId) return
    const q = query.trim()
    if (!q.length) {
      setSearchResults([])
      return
    }

    const t = window.setTimeout(async () => {
      setSearching(true)
      try {
        const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
        if (sessErr) throw sessErr
        const token = sessRes.session?.access_token
        if (!token) throw new Error("Missing session token. Please log out and back in.")

        const res = await fetch("/api/profile/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ q }),
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error ?? "Search failed.")

        const base = (json?.items ?? []) as SearchProfileRow[]
        const friendIdSet = new Set(friends.map((f) => f.id))

        const filtered = base.filter((p) => p.id !== meId && !friendIdSet.has(p.id))

        const avatarUrls = await Promise.all(
          filtered.map((p) =>
            p.avatar_path
              ? supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60).then(r => r.data?.signedUrl ?? null)
              : Promise.resolve(null)
          )
        )

        const mapped: UiPerson[] = filtered.map((p, i) => ({
          id: p.id,
          username: p.username,
          displayName: p.display_name,
          avatarUrl: avatarUrls[i],
          friendCount: p.friend_count ?? 0,
          drinkCount: p.drink_count ?? 0,
          outgoingPending: !!p.outgoing_pending || !!outgoingPendingIds[p.id],
        }))

        setSearchResults(mapped)
      } catch (e: any) {
        setError(e?.message ?? "Search failed.")
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => window.clearTimeout(t)
  }, [query, meId, supabase, friends, outgoingPendingIds])

  function sortedFriends(list: UiPerson[]) {
    const copy = [...list]
    if (sort === "name_asc") copy.sort((a, b) => a.username.localeCompare(b.username))
    else if (sort === "name_desc") copy.sort((a, b) => b.username.localeCompare(a.username))
    else if (sort === "since_new")
      copy.sort((a, b) => (b.friendshipCreatedAt ?? "").localeCompare(a.friendshipCreatedAt ?? ""))
    else if (sort === "since_old")
      copy.sort((a, b) => (a.friendshipCreatedAt ?? "").localeCompare(b.friendshipCreatedAt ?? ""))
    return copy
  }

  async function addFriend(friendId: string) {
    setError(null)
    try {
      const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) throw sessErr
      const token = sessRes.session?.access_token
      if (!token) throw new Error("Missing session token. Please log out and back in.")

      const res = await fetch("/api/friends/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendId }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Could not add friend.")

      if (json?.autoAccepted) {
        showToast("Friend added!")
        setSearchResults((prev) => prev.filter((p) => p.id !== friendId))
      } else {
        showToast("Request sent!")

        setOutgoingPendingIds((prev) => ({ ...prev, [friendId]: true }))

        setSearchResults((prev) => prev.map((p) => (p.id === friendId ? { ...p, outgoingPending: true } : p)))
      }

      await loadFriends()

      window.dispatchEvent(new Event("refresh-nav-badges"))
    } catch (e: any) {
      setError(e?.message ?? "Could not add friend.")
    }
  }

  async function respondToRequest(requestId: string, action: "accepted" | "rejected") {
    setError(null)
    setPendingBusyId(requestId)

    try {
      const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) throw sessErr
      const token = sessRes.session?.access_token
      if (!token) throw new Error("Missing session token. Please log out and back in.")

      const res = await fetch("/api/friends/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId, action }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Could not update request.")

      showToast(action === "accepted" ? "Friend added!" : "Request rejected")

      await loadFriends()

      window.dispatchEvent(new Event("refresh-nav-badges"))
    } catch (e: any) {
      setError(e?.message ?? "Could not update request.")
    } finally {
      setPendingBusyId(null)
    }
  }

  const [removeOpen, setRemoveOpen] = React.useState(false)
  const [removeBusy, setRemoveBusy] = React.useState(false)
  const [removeError, setRemoveError] = React.useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = React.useState<UiPerson | null>(null)

  function openRemove(friend: UiPerson) {
    setRemoveTarget(friend)
    setRemoveError(null)
    setRemoveOpen(true)
  }

  async function confirmRemoveFriend() {
    if (!removeTarget) return
    setRemoveError(null)
    setRemoveBusy(true)

    try {
      const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) throw sessErr
      const token = sessRes.session?.access_token
      if (!token) throw new Error("Missing session token. Please log out and back in.")

      const res = await fetch("/api/friends/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendId: removeTarget.id }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Could not remove friend.")

      setRemoveOpen(false)
      setRemoveTarget(null)
      showToast("Friend removed.")
      await loadFriends()

      window.dispatchEvent(new Event("refresh-nav-badges"))
    } catch (e: any) {
      setRemoveError(e?.message ?? "Could not remove friend.")
    } finally {
      setRemoveBusy(false)
    }
  }

  // --- Skeleton Loading ---
  if (loading) {
    return (
      <div className="container max-w-md mx-auto px-0 sm:px-4 py-4 space-y-5">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Friends</h2>
          <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-neutral-500 dark:text-white/50">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortLabel(sort)}
          </div>
        </div>

        <div className="px-2">
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl px-4 py-3">
            <Search className="h-4 w-4 text-neutral-400 dark:text-white/25" />
            <span className="text-sm text-neutral-300 dark:text-white/20">Search people by username or name…</span>
          </div>
        </div>

        <div className="px-2 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30 px-1">Pending requests</div>
          <div className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-3.5 w-32 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="h-3 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              </div>
              <div className="h-9 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            </div>
          </div>
        </div>

        <div className="px-2 space-y-3 pb-24">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30 px-1">Your friends</div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3.5 w-36 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                  <div className="h-3 w-24 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                  <div className="flex gap-4 pt-1">
                    <div className="h-3 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                    <div className="h-3 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                  </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const friendsSorted = sortedFriends(friends)

  return (
    <>
      <div className="container max-w-md mx-auto px-0 sm:px-4 py-4 pb-24">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between px-2">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Friends</h2>

          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200 active:scale-95",
                showSortMenu
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                  : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-white/50 hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortLabel(sort)}
            </button>

            {showSortMenu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-200/50 dark:border-white/[0.08] bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl shadow-xl ring-1 ring-black/5 dark:ring-white/[0.06] animate-in fade-in zoom-in-95 duration-200">
                <div className="p-1">
                  {(
                    [
                      { key: "name_asc", label: "Name (A → Z)" },
                      { key: "name_desc", label: "Name (Z → A)" },
                      { key: "since_new", label: "Friendship (Newest)" },
                      { key: "since_old", label: "Friendship (Oldest)" },
                    ] as { key: FriendSort; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setSort(opt.key)
                        setShowSortMenu(false)
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        sort === opt.key
                          ? "bg-black/5 dark:bg-white/[0.08] font-semibold text-black dark:text-white"
                          : "text-neutral-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/[0.06] hover:text-black dark:hover:text-white"
                      )}
                    >
                      <span>{opt.label}</span>
                      {sort === opt.key && <Check className="h-4 w-4 text-black dark:text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="mb-6 animate-in slide-in-from-top-4 fade-in duration-500 rounded-2xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/10 backdrop-blur-md px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {toastMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6 px-2">
          <div className={cn(
            "flex items-center gap-3 rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl px-4 py-3 transition-all duration-200",
            "focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10 focus-within:bg-white dark:focus-within:bg-white/[0.06]"
          )}>
            <Search className="h-4 w-4 text-neutral-400 dark:text-white/25" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people by username or name…"
              className="w-full bg-transparent text-sm text-neutral-900 dark:text-white placeholder:text-neutral-300 dark:placeholder:text-white/20 outline-none"
            />
            {searching && <Loader2 className="h-4 w-4 animate-spin text-neutral-400 dark:text-white/30" />}
          </div>
        </div>

        {/* Search Results */}
        {query.trim().length > 0 && (
          <div className="mb-6 px-2 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30 px-1">Search results</div>

            {searchResults.length === 0 && !searching ? (
              <div className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-5 text-center text-sm text-neutral-400 dark:text-white/40">
                No matches found.
              </div>
            ) : (
              searchResults.map((p) => (
                <PersonCard
                  key={p.id}
                  avatarUrl={p.avatarUrl}
                  username={p.username}
                  displayName={p.displayName}
                  friendCount={p.friendCount}
                  drinkCount={p.drinkCount}
                  actions={
                    p.outgoingPending ? (
                      <button
                        type="button"
                        disabled
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-neutral-400 dark:text-white/30"
                        aria-label="Request pending"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addFriend(p.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black shadow-sm transition-all active:scale-95 hover:bg-neutral-800 dark:hover:bg-neutral-100"
                        aria-label="Add friend"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )
                  }
                />
              ))
            )}
          </div>
        )}

        {/* Pending Requests */}
        <div className="px-2 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30 px-1">Pending requests</div>

          {pending.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-5 text-center text-sm text-neutral-400 dark:text-white/40">
              No pending requests.
            </div>
          ) : (
            pending.map((p) => (
              <PersonCard
                key={p.friendshipId}
                avatarUrl={p.avatarUrl}
                username={p.username}
                displayName={p.displayName}
                friendCount={p.friendCount}
                drinkCount={p.drinkCount}
                actions={
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => respondToRequest(p.friendshipId, "accepted")}
                      disabled={pendingBusyId === p.friendshipId}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black shadow-sm transition-all active:scale-95 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50"
                      aria-label="Accept"
                    >
                      {pendingBusyId === p.friendshipId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToRequest(p.friendshipId, "rejected")}
                      disabled={pendingBusyId === p.friendshipId}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-white/50 transition-all active:scale-95 hover:bg-neutral-200 dark:hover:bg-white/15 disabled:opacity-50"
                      aria-label="Reject"
                    >
                      {pendingBusyId === p.friendshipId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                }
              />
            ))
          )}
        </div>

        {/* Friends List */}
        <div className="mt-6 px-2 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30 px-1">
            Your friends{friendsSorted.length > 0 && ` (${friendsSorted.length})`}
          </div>

          {friendsSorted.length === 0 ? (
            <div className="mt-8 flex flex-col items-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-neutral-300 dark:border-white/15 bg-white/50 dark:bg-white/[0.04] text-neutral-400 dark:text-white/25">
                <Plus className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">No friends yet</h3>
              <p className="mt-2 max-w-xs text-sm text-neutral-500 dark:text-white/45 leading-relaxed">
                Search for people above and hit + to add them as a friend.
              </p>
            </div>
          ) : (
            friendsSorted.map((f) => (
              <PersonCard
                key={f.id}
                avatarUrl={f.avatarUrl}
                username={f.username}
                displayName={f.displayName}
                friendCount={f.friendCount}
                drinkCount={f.drinkCount}
                actions={
                  <button
                    type="button"
                    onClick={() => openRemove(f)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 dark:text-red-400/40 transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                    aria-label="Remove friend"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                }
              />
            ))
          )}
        </div>
      </div>

      {/* Remove Friend Modal */}
      {removeOpen && removeTarget && (
        <OverlayPage
          title="Remove Friend"
          onClose={() => {
            if (removeBusy) return
            setRemoveOpen(false)
            setRemoveError(null)
            setRemoveTarget(null)
          }}
        >
          {removeError && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 p-3 text-sm text-red-500 dark:text-red-400">
              {removeError}
            </div>
          )}

          <p className="mb-6 text-neutral-600 dark:text-white/55">
            Are you sure you want to remove <span className="font-semibold text-neutral-900 dark:text-white">@{removeTarget.username}</span> from your friends? You can always add them back later.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (removeBusy) return
                setRemoveOpen(false)
                setRemoveError(null)
                setRemoveTarget(null)
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-100 dark:bg-white/10 px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white transition-all active:scale-[0.98] hover:bg-neutral-200 dark:hover:bg-white/15"
              disabled={removeBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmRemoveFriend}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-medium text-white shadow-sm transition-all active:scale-[0.98] hover:bg-red-600"
              disabled={removeBusy}
            >
              {removeBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Remove
            </button>
          </div>
        </OverlayPage>
      )}
    </>
  )
}