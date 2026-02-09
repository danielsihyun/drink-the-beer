"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface FriendProfile {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  friendCount: number
  drinkCount: number
  cheersCount: number
}

function PersonCard({
  avatarUrl,
  username,
  displayName,
  friendCount,
  drinkCount,
  cheersCount,
}: {
  avatarUrl: string | null
  username: string
  displayName: string
  friendCount: number
  drinkCount: number
  cheersCount: number
}) {
  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-4">
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

          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-tight truncate">{displayName}</div>
            <div className="text-[13px] text-neutral-500 dark:text-white/40 font-medium truncate">@{username}</div>

            <div className="flex gap-4 text-[13px]">
              <div>
                <span className="font-semibold text-neutral-900 dark:text-white">{friendCount}</span>{" "}
                <span className="text-neutral-500 dark:text-white/40">friends</span>
              </div>
              <div>
                <span className="font-semibold text-neutral-900 dark:text-white">{drinkCount}</span>{" "}
                <span className="text-neutral-500 dark:text-white/40">drinks</span>
              </div>
              <div>
                <span className="font-semibold text-neutral-900 dark:text-white">{cheersCount}</span>{" "}
                <span className="text-neutral-500 dark:text-white/40">cheers</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </article>
  )
}

export default function UserFriendsPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const username = params.username as string

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [friends, setFriends] = React.useState<FriendProfile[]>([])
  const [displayName, setDisplayName] = React.useState(username)

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        // Get current user
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!userRes.user) {
          router.replace("/login")
          return
        }

        // Get the profile for this username
        const { data: prof, error: profErr } = await supabase
          .from("profile_public_stats")
          .select("id, username, display_name")
          .eq("username", username)
          .single()

        if (profErr) {
          if (profErr.code === "PGRST116") {
            setError("User not found")
            setLoading(false)
            return
          }
          throw profErr
        }

        setDisplayName(prof.display_name || prof.username)

        const targetUserId = prof.id

        // Fetch accepted friendships for the target user
        const { data: friendships, error: fErr } = await supabase
          .from("friendships")
          .select("requester_id, addressee_id")
          .or(`requester_id.eq.${targetUserId},addressee_id.eq.${targetUserId}`)
          .eq("status", "accepted")

        if (fErr) throw fErr

        if (!friendships || friendships.length === 0) {
          setFriends([])
          setLoading(false)
          return
        }

        // Get the friend IDs (the other side of each friendship)
        const friendIds = friendships.map((f) =>
          f.requester_id === targetUserId ? f.addressee_id : f.requester_id
        )

        // Fetch profiles for all friends
        const { data: profiles, error: pErr } = await supabase
          .from("profile_public_stats")
          .select("id, username, display_name, avatar_path, friend_count, drink_count")
          .in("id", friendIds)

        if (pErr) throw pErr

        // Get signed avatar URLs
        const avatarUrls = await Promise.all(
          (profiles ?? []).map((p: any) =>
            p.avatar_path
              ? supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60).then(r => r.data?.signedUrl ?? null)
              : Promise.resolve(null)
          )
        )

        // Fetch cheers counts for each friend
        const cheersCounts = await Promise.all(
          (profiles ?? []).map(async (p: any) => {
            const { data: logIds } = await supabase
              .from("drink_logs")
              .select("id")
              .eq("user_id", p.id)
            const ids = (logIds ?? []).map((r: any) => r.id)
            if (ids.length === 0) return 0
            const { count } = await supabase
              .from("drink_cheers")
              .select("*", { count: "exact", head: true })
              .in("drink_log_id", ids)
            return count ?? 0
          })
        )

        const friendProfiles: FriendProfile[] = (profiles ?? []).map((p: any, i: number) => ({
          id: p.id,
          username: p.username,
          displayName: p.display_name || p.username,
          avatarUrl: avatarUrls[i],
          friendCount: p.friend_count ?? 0,
          drinkCount: p.drink_count ?? 0,
          cheersCount: cheersCounts[i],
        }))

        // Sort alphabetically by display name
        friendProfiles.sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        )

        setFriends(friendProfiles)
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [username, supabase, router])

  return (
    <div className="container max-w-md mx-auto px-0 py-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm p-2 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-neutral-700 dark:text-white/70" />
        </button>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {displayName}&apos;s Friends
        </h2>
      </div>

      {error && (
        <div className="mb-6 rounded-[2rem] border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">
            Friends
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3.5 w-36 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                  <div className="h-3 w-24 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                  <div className="flex gap-4 pt-1">
                    <div className="h-3 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                    <div className="h-3 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                    <div className="h-3 w-16 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : friends.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
          <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">
            No friends yet
          </h3>
          <p className="max-w-sm text-sm text-neutral-500 dark:text-white/50">
            {displayName} hasn&apos;t added any friends yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-white/30">
            Friends{friends.length > 0 && ` (${friends.length})`}
          </div>
          {friends.map((friend) => (
            <PersonCard
              key={friend.id}
              avatarUrl={friend.avatarUrl}
              username={friend.username}
              displayName={friend.displayName}
              friendCount={friend.friendCount}
              drinkCount={friend.drinkCount}
              cheersCount={friend.cheersCount}
            />
          ))}
        </div>
      )}
    </div>
  )
}