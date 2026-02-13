import type React from "react"
import { BottomNav } from "@/components/app/bottom-nav"
import { AchievementProvider } from "@/contexts/achievement-context"
import { AchievementUnlockPopup } from "@/components/achievement-unlock-popup"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* Main content area */}
      <main className="mx-auto w-full max-w-md flex-1 pb-20">
        <div className="px-4 py-4 safe-area-inset-bottom">
          <AchievementProvider>
            {children}
            <AchievementUnlockPopup />
          </AchievementProvider>
        </div>
      </main>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  )
}