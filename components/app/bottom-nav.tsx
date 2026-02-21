"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Trophy, Plus, Search, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  {
    href: "/feed",
    label: "Feed",
    icon: Home,
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
  },
  {
    href: "/log",
    label: "Log",
    icon: Plus,
  },
  {
    href: "/discover",
    label: "Discover",
    icon: Search,
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
  const prevPathnameRef = React.useRef(pathname)

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

  // Load counts on mount
  React.useEffect(() => {
    loadPendingRequests()
    loadUnseenCheers()
  }, [loadPendingRequests, loadUnseenCheers])

  // Handle pathname changes — mark as seen when LEAVING profile, then refresh
  React.useEffect(() => {
    const wasOnProfile = prevPathnameRef.current === "/profile/me"
    const isOnProfile = pathname === "/profile/me"
    prevPathnameRef.current = pathname

    if (wasOnProfile && !isOnProfile && userId) {
      // Just left profile — mark as seen, then refresh counts
      supabase
        .from("user_last_seen")
        .upsert(
          { user_id: userId, profile_last_seen: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .then(() => {
          loadUnseenCheers()
        })
    }

    loadPendingRequests()

    // Only refresh cheers if NOT arriving at profile (preserve the count for display)
    if (!isOnProfile && !wasOnProfile) {
      loadUnseenCheers()
    }
  }, [pathname, userId, supabase, loadPendingRequests, loadUnseenCheers])

  // Expose a way for other components to trigger a refresh
  React.useEffect(() => {
    const handleRefreshNav = () => {
      loadPendingRequests()
      loadUnseenCheers()
    }

    window.addEventListener("refresh-nav-badges", handleRefreshNav)
    return () => window.removeEventListener("refresh-nav-badges", handleRefreshNav)
  }, [loadPendingRequests, loadUnseenCheers])

  // Realtime subscription for friend requests
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

  // Realtime subscription for cheers (only when NOT on profile)
  React.useEffect(() => {
    if (!userId) return
    if (pathname === "/profile/me") return

    const cheersChannel = supabase
      .channel("cheers-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drink_cheers",
        },
        () => {
          loadUnseenCheers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(cheersChannel)
    }
  }, [userId, supabase, loadUnseenCheers, pathname])

  // Profile badge = pending friends + unseen cheers
  const profileBadgeCount = pendingRequestCount + unseenCheersCount

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
      <div className="mx-auto max-w-md">
        <ul className="flex items-center justify-around px-2 pb-safe">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            const showProfileBadge = item.href === "/profile/me" && profileBadgeCount > 0

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
                    {showProfileBadge && (
                      <span className="absolute -right-3.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#3478F6] text-[10px] font-bold text-white">
                        {profileBadgeCount > 9 ? "9+" : profileBadgeCount}
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