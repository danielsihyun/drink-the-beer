import type React from "react"
import { BottomNav } from "@/components/bottom-nav"
import { TopBar } from "@/components/top-bar"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area - with padding for fixed top and bottom bars */}
      <main className="flex-1 overflow-y-auto pb-20 pt-16">{children}</main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
