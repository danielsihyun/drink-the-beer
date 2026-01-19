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
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <h1 className="text-lg font-bold">Drink The Beer</h1>
          {/* Optional action slot for future use */}
          <div className="flex items-center gap-2">{/* Placeholder for notifications, settings, etc. */}</div>
        </div>
      </header>

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