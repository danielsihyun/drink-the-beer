"use client"

import * as React from "react"
import Image from "next/image"
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
}

type PendingApiRow = {
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
}

type UiPending = UiPerson & {
  friendshipId: string
  requestedAt: string
}

function sortLabel(s: FriendSort) {
  if (s === "name_asc") return "A → Z"
  if (s === "name_desc") return "Z → A"
  if (s === "since_new") return "Newest"
  return "Oldest"
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

  async function getSignedUrlOrNull(bucket: string, path: string | null, expiresInSeconds = 60 * 60) {
    if (!path) return null
    const { data, error: e } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
    if (e) return null
    return data?.signedUrl ?? null
  }

  const ensureAuthed = React.useCallback(async () => {
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr) throw userErr
    const user = userRes.user
    if (!user) {
      router.replace("/login?redirectTo=%2Ffriends")
      return null
    }
    setMeId(user.id)
    return user.id
  }, [router, supabase])

  const loadPending = React.useCallback(async () => {
    try {
      const me = await ensureAuthed()
      if (!me) return

      const { data: sessRes, error: sessErr } = await supabase.auth.getSession()
      if (sessErr) throw sessErr
      const token = sessRes.session?.access_token
      if (!token) throw new Error("Missing session token. Please log out and back in.")

      const res = await fetch("/api/friends/pending-incoming", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Could not load pending requests.")

      const base = (json.items ?? []) as PendingApiRow[]
      const mapped: UiPending[] = await Promise.all(
        base.map(async (r) => {
          const avatarUrl = await getSignedUrlOrNull("profile-photos", r.avatar_path)
          return {
            friendshipId: r.friendshipId,
            requestedAt: r.createdAt,
            id: r.requesterId,
            username: r.username,
            displayName: r.display_name,
            avatarUrl,
            friendCount: r.friend_count ?? 0,
            drinkCount: r.drink_count ?? 0,
          }
        })
      )

      setPending(mapped)
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong loading pending requests.")
    }
  }, [ensureAuthed, supabase])

  const loadFriends = React.useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      const me = await ensureAuthed()
      if (!me) return

      const { data: rows, error: fErr } = await supabase
        .from("friends_with_stats")
        .select("user_id,friend_id,friendship_created_at,username,display_name,avatar_path,friend_count,drink_count")
        .eq("user_id", me)
        .limit(500)

      if (fErr) throw fErr

      const base = (rows ?? []) as FriendRow[]

      const mapped: UiPerson[] = await Promise.all(
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

      setFriends(mapped)

      // also load pending after friends load
      await loadPending()
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong loading your friends.")
    } finally {
      setLoading(false)
    }
  }, [ensureAuthed, loadPending, router, supabase])

  React.useEffect(() => {
    loadFriends()
  }, [loadFriends])

  // Search (debounced)
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
        const { data: rows, error: sErr } = await supabase
          .from("profile_public_stats")
          .select("id,username,display_name,avatar_path,friend_count,drink_count")
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
          .limit(25)

        if (sErr) throw sErr

        const base = (rows ?? []) as SearchProfileRow[]
        const filtered = base.filter((p) => p.id !== meId)

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
  }, [query, meId, supabase])

  function sortedFriends(list: UiPerson[]) {
    const copy = [...list]
    if (sort === "name_asc") copy.sort((a, b) => a.username.localeCompare(b.username))
    else if (sort === "name_desc") copy.sort((a, b) => b.username.localeCompare(a.username))
    else if (sort === "since_new") copy.sort((a, b) => (b.friendshipCreatedAt ?? "").localeCompare(a.friendshipCreatedAt ?? ""))
    else copy.sort((a, b) => (a.friendshipCreatedAt ?? "").localeCompare(b.friendshipCreatedAt ?? ""))
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

      await loadFriends()
    } catch (e: any) {
      setError(e?.message ?? "Could not add friend.")
    }
  }

  async function respondToRequest(requestId: string, action: "accepted" | "rejected") {
    setError(null)
  
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
  
      // 👇 always read the body, even when not JSON
      const raw = await res.text()
      let json: any = null
      try {
        json = raw ? JSON.parse(raw) : null
      } catch {
        json = null
      }
  
      if (!res.ok) {
        // Prefer server's json error, otherwise show the raw body
        const msg =
          json?.error ??
          raw ??
          `Request failed (HTTP ${res.status})`
  
        throw new Error(msg)
      }
  
      await loadFriends()
    } catch (e: any) {
      setError(e?.message ?? "Could not update request.")
    }
  }
  


  if (loading) {
    return (
      <div className="container max-w-2xl px-4 py-6">
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
    <div className="container max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Friends</h2>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {/* Search bar */}
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

      {/* Sort control (top-right under search bar) */}
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

      {/* Search results (shown when typing) */}
      {query.trim().length ? (
        <div className="mt-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide opacity-60">Search results</div>

          {searchResults.length === 0 && !searching ? (
            <div className="rounded-2xl border bg-background/50 p-4 text-sm opacity-70">No matches.</div>
          ) : null}

          {searchResults.map((p) => (
            <article key={p.id} className="rounded-2xl border bg-background/50 p-3">
              <div className="flex items-center gap-3">
                {p.avatarUrl ? (
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <Image src={p.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/10 text-sm font-semibold">
                    {p.username[0]?.toUpperCase() ?? "U"}
                  </div>
                )}

                <div className="flex-1">
                  <div className="text-sm font-semibold">{p.displayName}</div>
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

                <button
                  type="button"
                  onClick={() => addFriend(p.id)}
                  className="inline-flex items-center justify-center rounded-full border bg-black px-3 py-2 text-sm font-medium text-white"
                  aria-label="Add friend"
                  title="Add friend"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {/* ✅ Pending requests (above friends list) */}
      <div className="mt-6 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-60">Pending requests</div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border bg-background/50 p-4 text-sm opacity-70">No pending requests.</div>
        ) : (
          pending.map((p) => (
            <article key={p.friendshipId} className="rounded-2xl border bg-background/50 p-3">
              <div className="flex items-center gap-3">
                {p.avatarUrl ? (
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <Image src={p.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/10 text-sm font-semibold">
                    {p.username[0]?.toUpperCase() ?? "U"}
                  </div>
                )}

                <div className="flex-1">
                  <div className="text-sm font-semibold">{p.displayName}</div>
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => respondToRequest(p.friendshipId, "accepted")}
                    disabled={pendingBusyId === p.friendshipId}
                    className="inline-flex items-center justify-center rounded-full border bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    aria-label="Accept"
                    title="Accept"
                  >
                    {pendingBusyId === p.friendshipId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => respondToRequest(p.friendshipId, "rejected")}
                    disabled={pendingBusyId === p.friendshipId}
                    className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium disabled:opacity-60"
                    aria-label="Reject"
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Friends list */}
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
                {f.avatarUrl ? (
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <Image src={f.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/10 text-sm font-semibold">
                    {f.username[0]?.toUpperCase() ?? "U"}
                  </div>
                )}

                <div className="flex-1">
                  <div className="text-sm font-semibold">{f.displayName}</div>
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
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
