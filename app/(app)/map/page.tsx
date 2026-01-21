"use client"

import * as React from "react"
import { MapPin } from "lucide-react"

export default function MapPage() {
  return (
    <div className="container max-w-2xl px-3 py-1.5 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Map</h2>
      </div>

      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed">
          <MapPin className="h-10 w-10 opacity-50" />
        </div>

        <h3 className="mb-2 text-lg font-semibold">Coming Soon</h3>
        <p className="max-w-sm text-sm opacity-70">
          See where you and your friends have been drinking on an interactive map.
        </p>
      </div>
    </div>
  )
}