"use client"

import * as React from "react"
import { Loader2, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import dynamic from "next/dynamic"

// Dynamically import the map component to avoid SSR issues with Leaflet
const DrinkMap = dynamic(() => import("@/components/drink-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-200px)] items-center justify-center rounded-2xl border bg-background/50">
      <Loader2 className="h-8 w-8 animate-spin opacity-50" />
    </div>
  ),
})

type DrinkLocation = {
  id: string
  latitude: number
  longitude: number
  drinkType: string
  createdAt: string
  photoUrl: string | null
}

export default function MapPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [locations, setLocations] = React.useState<DrinkLocation[]>([])
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null)

  React.useEffect(() => {
    async function load() {
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        const user = userRes.user

        if (!user) {
          router.replace("/login?redirectTo=%2Fmap")
          return
        }

        // Fetch drink logs with location data
        const { data: logs, error: logsErr } = await supabase
          .from("drink_logs")
          .select("id, latitude, longitude, drink_type, created_at, photo_path")
          .eq("user_id", user.id)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("created_at", { ascending: false })

        if (logsErr) throw logsErr

        // Get signed URLs for photos
        const locationsWithPhotos: DrinkLocation[] = await Promise.all(
          (logs ?? []).map(async (log: any) => {
            let photoUrl: string | null = null
            if (log.photo_path) {
              const { data: signedData } = await supabase.storage
                .from("drink-photos")
                .createSignedUrl(log.photo_path, 60 * 60)
              photoUrl = signedData?.signedUrl ?? null
            }

            return {
              id: log.id,
              latitude: log.latitude,
              longitude: log.longitude,
              drinkType: log.drink_type,
              createdAt: log.created_at,
              photoUrl,
            }
          })
        )

        setLocations(locationsWithPhotos)

        // Try to get user's current location for initial map center
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setUserLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              })
            },
            () => {
              // If geolocation fails, center on first drink or default
              if (locationsWithPhotos.length > 0) {
                setUserLocation({
                  lat: locationsWithPhotos[0].latitude,
                  lng: locationsWithPhotos[0].longitude,
                })
              }
            }
          )
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load map data")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="container max-w-2xl px-3 py-1.5">
        <h2 className="mb-4 text-2xl font-bold">Map</h2>
        <div className="flex h-[calc(100vh-200px)] items-center justify-center rounded-2xl border bg-background/50">
          <Loader2 className="h-8 w-8 animate-spin opacity-50" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl px-3 py-1.5 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Map</h2>
        <span className="text-sm opacity-60">
          {locations.length} {locations.length === 1 ? "drink" : "drinks"} logged
        </span>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {locations.length === 0 ? (
        <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center rounded-2xl border bg-background/50 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed">
            <MapPin className="h-7 w-7 opacity-50" />
          </div>
          <h3 className="text-lg font-semibold">No locations yet</h3>
          <p className="mt-1 max-w-sm px-4 text-sm opacity-70">
            When you log drinks, we'll save the location so you can see where you've been!
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          <DrinkMap
            locations={locations}
            center={userLocation ?? { lat: locations[0].latitude, lng: locations[0].longitude }}
          />
        </div>
      )}
    </div>
  )
}