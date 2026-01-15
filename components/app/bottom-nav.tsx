"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, Plus, BarChart3, User } from "lucide-react"
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
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
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

  const [pendingRequestCount, setPendingRequestCount] = React.useState(0)

  // Load pending friend requests count
  const loadPendingRequests = React.useCallback(async () => {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userRes.user) return

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

  // Load on mount
  React.useEffect(() => {
    loadPendingRequests()
  }, [loadPendingRequests])

  // Reload when pathname changes (e.g., after accepting/declining a request)
  React.useEffect(() => {
    loadPendingRequests()
  }, [pathname, loadPendingRequests])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
      <div className="mx-auto max-w-md">
        <ul className="flex items-center justify-around px-2 pb-safe">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            const showBadge = item.href === "/friends" && pendingRequestCount > 0

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
                    {showBadge && (
                      <span className="absolute -right-3.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
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