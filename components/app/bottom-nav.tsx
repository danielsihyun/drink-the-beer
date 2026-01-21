"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, Plus, MapPin, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  {
    href: "/feed",
    label: "Feed",
    icon: Home,
  },
  {
    href: "/friends",
    label: "Friends",
    icon: Users,
  },
  {
    href: "/log",
    label: "Log",
    icon: Plus,
  },
  {
    href: "/map",
    label: "Map",
    icon: MapPin,
  },
  {
    href: "/profile/me",
    label: "Profile",
    icon: User,
  },
]

export function BottomNav() {
  const pathname = usePathname()
  const supabase = createClient()

  const [userId, setUserId] = React.useState<string | null>(null)
  const [pendingRequestCount, setPendingRequestCount] = React.useState(0)
  const [unseenCheersCount, setUnseenCheersCount] = React.useState(0)

  // Load pending friend requests count
  const loadPendingRequests = React.useCallback(async () => {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userRes.user) return

      setUserId(userRes.user.id)

      const { count, error: countErr } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("addressee_id", userRes.user.id)
        .eq("status", "pending")

      if (countErr) throw countErr

      setPendingRequestCount(count ?? 0)
    } catch (e) {
      console.error("Failed to load pending requests:", e)
    }
  }, [supabase])

  // Load unseen cheers count
  const loadUnseenCheers = React.useCallback(async () => {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userRes.user) return

      const { data, error: rpcErr } = await supabase.rpc("get_unseen_cheers_count", {
        p_user_id: userRes.user.id,
      })

      if (rpcErr) throw rpcErr

      setUnseenCheersCount(data ?? 0)
    } catch (e) {
      console.error("Failed to load unseen cheers:", e)
    }
  }, [supabase])

  // Mark profile as seen (update last_seen timestamp)
  const markProfileSeen = React.useCallback(async () => {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userRes.user) return

      // Upsert the last seen timestamp
      const { error: upsertErr } = await supabase
        .from("user_last_seen")
        .upsert(
          {
            user_id: userRes.user.id,
            profile_last_seen: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )

      if (upsertErr) throw upsertErr

      // Clear the badge immediately
      setUnseenCheersCount(0)
    } catch (e) {
      console.error("Failed to mark profile seen:", e)
    }
  }, [supabase])

  // Load counts on mount
  React.useEffect(() => {
    loadPendingRequests()
    loadUnseenCheers()
  }, [loadPendingRequests, loadUnseenCheers])

  // Handle pathname changes
  React.useEffect(() => {
    // Refresh friends count when navigating (handles accept/reject)
    loadPendingRequests()

    // When user visits profile, mark as seen
    if (pathname === "/profile/me") {
      markProfileSeen()
    } else {
      // Refresh unseen cheers when not on profile
      loadUnseenCheers()
    }
  }, [pathname, loadPendingRequests, loadUnseenCheers, markProfileSeen])

  // Expose a way for other components to trigger a refresh
  React.useEffect(() => {
    const handleRefreshNav = () => {
      loadPendingRequests()
      loadUnseenCheers()
    }

    window.addEventListener("refresh-nav-badges", handleRefreshNav)
    return () => window.removeEventListener("refresh-nav-badges", handleRefreshNav)
  }, [loadPendingRequests, loadUnseenCheers])

  // ✅ Realtime subscription for friend requests
  React.useEffect(() => {
    if (!userId) return

    const friendshipsChannel = supabase
      .channel("friendships-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${userId}`,
        },
        () => {
          loadPendingRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(friendshipsChannel)
    }
  }, [userId, supabase, loadPendingRequests])

  // ✅ Realtime subscription for cheers - simplified to always refresh on any change
  React.useEffect(() => {
    if (!userId) return
    if (pathname === "/profile/me") return

    const cheersChannel = supabase
      .channel("cheers-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, and DELETE
          schema: "public",
          table: "drink_cheers",
        },
        () => {
          // Simply refresh the count on any change to drink_cheers
          // The RPC function will calculate the correct count
          loadUnseenCheers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(cheersChannel)
    }
  }, [userId, supabase, loadUnseenCheers, pathname])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
      <div className="mx-auto max-w-md">
        <ul className="flex items-center justify-around px-2 pb-safe">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            // Determine which badge to show
            const showFriendsBadge = item.href === "/friends" && pendingRequestCount > 0
            const showProfileBadge = item.href === "/profile/me" && unseenCheersCount > 0

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-[3rem] flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div className="relative">
                    <Icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
                    {showFriendsBadge && (
                      <span className="absolute -right-3.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
                      </span>
                    )}
                    {showProfileBadge && (
                      <span className="absolute -right-3.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unseenCheersCount > 9 ? "9+" : unseenCheersCount}
                      </span>
                    )}
                  </div>
                  <span className="leading-none">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}