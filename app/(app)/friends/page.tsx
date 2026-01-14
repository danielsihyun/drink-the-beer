"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Search, ArrowUpDown, Plus, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type FriendSort = "name_asc" | "name_desc" | "since_new" | "since_old"

type FriendRow = {
  user_id: string
  friend_id: string
  friendship_created_at: string
  username: string
  display_name: string
  avatar_path: string | null
  friend_count: number
  drink_count: number
}

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

  async function getSignedUrlOrNull(bucket: string, path: string | null, expiresInSeconds = 60 * 60) {
    if (!path) return null
    const { data, error: e } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
    if (e) return null
    return data?.signedUrl ?? null
  }

  const loadFriends = React.useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user
      if (!user) {
        router.replace("/login?redirectTo=%2Ffriends")
        return
      }

      setMeId(user.id)

      const { data: rows, error: fErr } = await supabase
        .from("friends_with_stats")
        .select("user_id,friend_id,friendship_created_at,username,display_name,avatar_path,friend_count,drink_count")
        .eq("user_id", user.id)
        .limit(500)

      if (fErr) throw fErr

      const base = (rows ?? []) as FriendRow[]
      const mappedFriends: UiPerson[] = await Promise.all(
        base.map(async (r) => {
          const avatarUrl = await getSignedUrlOrNull("profile-photos", r.avatar_path)
          return {
            id: r.friend_id,
            username: r.username,
            displayName: r.display_name,
            avatarUrl,
            friendCount: r.friend_count ?? 0,
            drinkCount: r.drink_count ?? 0,
            friendshipCreatedAt: r.friendship_created_at,
          }
        })
      )
      setFriends(mappedFriends)

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
      const mappedPending: UiPending[] = await Promise.all(
        pendingRows.map(async (p) => {
          const avatarUrl = await getSignedUrlOrNull("profile-photos", p.avatar_path)
          return {
            friendshipId: p.friendshipId,
            requesterId: p.requesterId,
            createdAt: p.createdAt,
            username: p.username,
            displayName: p.display_name,
            avatarUrl,
            friendCount: p.friend_count ?? 0,
            drinkCount: p.drink_count ?? 0,
          }
        })
      )

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

        const mapped: UiPerson[] = await Promise.all(
          filtered.map(async (p) => {
            const avatarUrl = await getSignedUrlOrNull("profile-photos", p.avatar_path)
            return {
              id: p.id,
              username: p.username,
              displayName: p.display_name,
              avatarUrl,
              friendCount: p.friend_count ?? 0,
              drinkCount: p.drink_count ?? 0,
              outgoingPending: !!p.outgoing_pending || !!outgoingPendingIds[p.id],
            }
          })
        )

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
    } catch (e: any) {
      setRemoveError(e?.message ?? "Could not remove friend.")
    } finally {
      setRemoveBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Friends</h2>
          <div className="h-9 w-24 animate-pulse rounded-full bg-foreground/10" />
        </div>

        <div className="mt-4 h-11 animate-pulse rounded-xl bg-foreground/10" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border bg-background/50 p-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-foreground/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded bg-foreground/10" />
                  <div className="h-2 w-20 rounded bg-foreground/10" />
                </div>
              </div>
              <div className="mt-3 h-3 w-40 rounded bg-foreground/10" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const friendsSorted = sortedFriends(friends)

  return (
    <>
      <div className="container max-w-2xl px-3 py-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Friends</h2>
        </div>

        {toastMsg ? (
          <div className="mt-3 rounded-2xl border border-black/20 bg-black/90 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
            {toastMsg}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2 rounded-xl border bg-background/50 px-3 py-2">
          <Search className="h-4 w-4 opacity-60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people by username or name…"
            className="w-full bg-transparent text-sm outline-none"
          />
          {searching ? <Loader2 className="h-4 w-4 animate-spin opacity-70" /> : null}
        </div>

        <div className="mt-3 flex items-center justify-end">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
            >
              <ArrowUpDown className="h-4 w-4" />
              {sortLabel(sort)}
            </button>

            {showSortMenu ? (
              <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-xl border bg-background shadow-lg">
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
                    className={`w-full px-4 py-3 text-left text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-foreground/5 ${
                      sort === opt.key ? "font-semibold" : ""
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {query.trim().length ? (
          <div className="mt-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-60">Search results</div>

            {searchResults.length === 0 && !searching ? (
              <div className="rounded-2xl border bg-background/50 p-4 text-sm opacity-70">No matches.</div>
            ) : null}

            {searchResults.map((p) => (
              <article key={p.id} className="rounded-2xl border bg-background/50 p-3">
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${p.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {p.avatarUrl ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                        <Image src={p.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/10 text-sm font-semibold">
                        {p.username[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold hover:underline">{p.displayName}</div>
                      <div className="text-xs opacity-60">@{p.username}</div>

                      <div className="mt-2 flex gap-4 text-sm">
                        <div>
                          <span className="font-bold">{p.friendCount}</span> <span className="opacity-60">Friends</span>
                        </div>
                        <div>
                          <span className="font-bold">{p.drinkCount}</span> <span className="opacity-60">Drinks</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {p.outgoingPending ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center rounded-full border bg-black px-3 py-2 text-sm font-medium text-white opacity-70 shrink-0"
                      aria-label="Request pending"
                      title="Request pending"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addFriend(p.id)}
                      className="inline-flex items-center justify-center rounded-full border bg-black px-3 py-2 text-sm font-medium text-white shrink-0"
                      aria-label="Add friend"
                      title="Add friend"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide opacity-60">Pending requests</div>

          {pending.length === 0 ? (
            <div className="rounded-2xl border bg-background/50 p-4 text-sm opacity-70">No pending requests.</div>
          ) : (
            pending.map((p) => (
              <article key={p.friendshipId} className="rounded-2xl border bg-background/50 p-3">
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${p.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {p.avatarUrl ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                        <Image src={p.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/10 text-sm font-semibold">
                        {p.username[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold hover:underline">{p.displayName}</div>
                      <div className="text-xs opacity-60">@{p.username}</div>

                      <div className="mt-2 flex gap-4 text-sm">
                        <div>
                          <span className="font-bold">{p.friendCount}</span> <span className="opacity-60">Friends</span>
                        </div>
                        <div>
                          <span className="font-bold">{p.drinkCount}</span> <span className="opacity-60">Drinks</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => respondToRequest(p.friendshipId, "accepted")}
                      disabled={pendingBusyId === p.friendshipId}
                      className="inline-flex items-center justify-center rounded-full border bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      aria-label="Accept"
                      title="Accept"
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
                      className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium disabled:opacity-60"
                      aria-label="Reject"
                      title="Reject"
                    >
                      {pendingBusyId === p.friendshipId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="mt-6 space-y-3 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
          <div className="text-xs font-semibold uppercase tracking-wide opacity-60">Your friends</div>

          {friendsSorted.length === 0 ? (
            <div className="rounded-2xl border bg-background/50 p-4 text-sm opacity-70">
              No friends yet. Search someone above and hit the + to add them.
            </div>
          ) : (
            friendsSorted.map((f) => (
              <article key={f.id} className="rounded-2xl border bg-background/50 p-3">
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${f.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {f.avatarUrl ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                        <Image src={f.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/10 text-sm font-semibold">
                        {f.username[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold hover:underline">{f.displayName}</div>
                      <div className="text-xs opacity-60">@{f.username}</div>

                      <div className="mt-2 flex gap-4 text-sm">
                        <div>
                          <span className="font-bold">{f.friendCount}</span> <span className="opacity-60">Friends</span>
                        </div>
                        <div>
                          <span className="font-bold">{f.drinkCount}</span> <span className="opacity-60">Drinks</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => openRemove(f)}
                    className="inline-flex items-center justify-center text-red-400 transition-transform hover:scale-[1.2] active:scale-[0.99] shrink-0"
                    style={{ width: "30px", height: "30px" }}
                    aria-label="Remove friend"
                    title="Remove friend"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {removeOpen && removeTarget ? (
        <OverlayPage
          title="Remove friend"
          onClose={() => {
            if (removeBusy) return
            setRemoveOpen(false)
            setRemoveError(null)
            setRemoveTarget(null)
          }}
        >
          {removeError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {removeError}
            </div>
          ) : null}

          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="text-base font-semibold">Are you sure?</div>
            <p className="mt-1 text-sm opacity-70">
              This will remove <span className="font-semibold">@{removeTarget.username}</span> from your friends.
            </p>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (removeBusy) return
                setRemoveOpen(false)
                setRemoveError(null)
                setRemoveTarget(null)
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              disabled={removeBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmRemoveFriend}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-200"
              disabled={removeBusy}
            >
              {removeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Remove
            </button>
          </div>
        </OverlayPage>
      ) : null}
    </>
  )
}