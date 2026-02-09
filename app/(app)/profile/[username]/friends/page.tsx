"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface FriendProfile {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
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
          .select("id, username, display_name, avatar_path")
          .in("id", friendIds)

        if (pErr) throw pErr

        // Get signed avatar URLs
        const friendProfiles: FriendProfile[] = await Promise.all(
          (profiles ?? []).map(async (p: any) => {
            let avatarUrl: string | null = null
            if (p.avatar_path) {
              const { data } = await supabase.storage
                .from("profile-photos")
                .createSignedUrl(p.avatar_path, 60 * 60)
              avatarUrl = data?.signedUrl ?? null
            }
            return {
              id: p.id,
              username: p.username,
              displayName: p.display_name || p.username,
              avatarUrl,
            }
          })
        )

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
    <div className="container max-w-2xl px-0 sm:px-4 py-1.5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm p-2 transition-all hover:bg-white dark:hover:bg-white/[0.1]"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-neutral-700 dark:text-white/70" />
        </button>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
          {displayName}&apos;s Friends
        </h2>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200/60 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-4"
            >
              <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 rounded bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
                <div className="h-3 w-20 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
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
        <div className="space-y-2 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
          {friends.map((friend) => (
            <Link
              key={friend.id}
              href={`/profile/${friend.username}`}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200/60 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-4 transition-all hover:bg-white dark:hover:bg-white/[0.06]"
            >
              {friend.avatarUrl ? (
                <div className="relative h-12 w-12 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
                  <Image
                    src={friend.avatarUrl}
                    alt={friend.username}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-1 ring-black/5 dark:ring-white/10">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6 text-neutral-400 dark:text-white/30"
                  >
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path
                      d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-neutral-900 dark:text-white truncate">
                  {friend.displayName}
                </p>
                <p className="text-sm text-neutral-500 dark:text-white/40 truncate">
                  @{friend.username}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}