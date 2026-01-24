"use client"

import * as React from "react"
import { Loader2, MapPin, Clock, Users, Wine } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"

// Dynamically import the map components to avoid SSR issues with Leaflet
const DrinkMap = dynamic(() => import("@/components/drink-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-280px)] items-center justify-center rounded-2xl border bg-background/50">
      <Loader2 className="h-8 w-8 animate-spin opacity-50" />
    </div>
  ),
})

const FriendsMap = dynamic(() => import("@/components/friends-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-280px)] items-center justify-center rounded-2xl border bg-background/50">
      <Loader2 className="h-8 w-8 animate-spin opacity-50" />
    </div>
  ),
})

type Tab = "my-drinks" | "friends" | "happy-hour"

type DrinkLocation = {
  id: string
  latitude: number
  longitude: number
  drinkType: string
  createdAt: string
  photoUrl: string | null
}

type FriendDrinkLocation = {
  id: string
  latitude: number
  longitude: number
  drinkType: string
  createdAt: string
  photoUrl: string | null
  user: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    drinkCount: number
    friendCount: number
  }
}

export default function MapPage() {
  const supabase = createClient()
  const router = useRouter()

  const [tab, setTab] = React.useState<Tab>("my-drinks")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  
  // My drinks state
  const [myLocations, setMyLocations] = React.useState<DrinkLocation[]>([])
  
  // Friends state
  const [friendsLoading, setFriendsLoading] = React.useState(false)
  const [friendsLocations, setFriendsLocations] = React.useState<FriendDrinkLocation[]>([])
  const [friendsLoaded, setFriendsLoaded] = React.useState(false)
  
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)

  // Load my drinks
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

        setUserId(user.id)

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

        setMyLocations(locationsWithPhotos)

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

  // Load friends drinks when tab switches to friends
  React.useEffect(() => {
    if (tab !== "friends" || friendsLoaded || !userId) return

    async function loadFriends() {
      setFriendsLoading(true)
      try {
        // Get list of friends
        const { data: friendships, error: friendsErr } = await supabase
          .from("friendships")
          .select("requester_id, addressee_id")
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .eq("status", "accepted")

        if (friendsErr) throw friendsErr

        const friendIds = (friendships ?? []).map((f: any) =>
          f.requester_id === userId ? f.addressee_id : f.requester_id
        )

        if (friendIds.length === 0) {
          setFriendsLocations([])
          setFriendsLoaded(true)
          setFriendsLoading(false)
          return
        }

        // Fetch friends' drink logs with location
        const { data: logs, error: logsErr } = await supabase
          .from("drink_logs")
          .select("id, user_id, latitude, longitude, drink_type, created_at, photo_path")
          .in("user_id", friendIds)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("created_at", { ascending: false })

        if (logsErr) throw logsErr

        // Fetch friend profiles with stats (profile_public_stats has everything we need)
        const { data: profiles, error: profilesErr } = await supabase
          .from("profile_public_stats")
          .select("id, username, display_name, avatar_path, drink_count, friend_count")
          .in("id", friendIds)

        if (profilesErr) throw profilesErr

        // Create profile map
        const profileMap = new Map(
          (profiles ?? []).map((p: any) => [p.id, p])
        )

        // Get signed URLs for avatars
        const avatarUrls = new Map<string, string | null>()
        for (const profile of profiles ?? []) {
          if (profile.avatar_path) {
            const { data: signedData } = await supabase.storage
              .from("profile-photos")
              .createSignedUrl(profile.avatar_path, 60 * 60)
            avatarUrls.set(profile.id, signedData?.signedUrl ?? null)
          } else {
            avatarUrls.set(profile.id, null)
          }
        }

        // Build friend locations with user info
        const friendLocations: FriendDrinkLocation[] = await Promise.all(
          (logs ?? []).map(async (log: any) => {
            let photoUrl: string | null = null
            if (log.photo_path) {
              const { data: signedData } = await supabase.storage
                .from("drink-photos")
                .createSignedUrl(log.photo_path, 60 * 60)
              photoUrl = signedData?.signedUrl ?? null
            }

            const profile = profileMap.get(log.user_id)

            return {
              id: log.id,
              latitude: log.latitude,
              longitude: log.longitude,
              drinkType: log.drink_type,
              createdAt: log.created_at,
              photoUrl,
              user: {
                id: log.user_id,
                username: profile?.username ?? "Unknown",
                displayName: profile?.display_name ?? profile?.username ?? "Unknown",
                avatarUrl: avatarUrls.get(log.user_id) ?? null,
                drinkCount: profile?.drink_count ?? 0,
                friendCount: profile?.friend_count ?? 0,
              },
            }
          })
        )

        setFriendsLocations(friendLocations)
        setFriendsLoaded(true)
      } catch (e: any) {
        setError(e?.message ?? "Failed to load friends' drinks")
      } finally {
        setFriendsLoading(false)
      }
    }

    loadFriends()
  }, [tab, friendsLoaded, userId, supabase])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "my-drinks", label: "My Drinks", icon: <Wine className="h-4 w-4" /> },
    { key: "friends", label: "Friends", icon: <Users className="h-4 w-4" /> },
    { key: "happy-hour", label: "Deals", icon: <Clock className="h-4 w-4" /> },
  ]

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
        {tab === "my-drinks" && (
          <span className="text-sm opacity-60">
            {myLocations.length} {myLocations.length === 1 ? "drink" : "drinks"}
          </span>
        )}
        {tab === "friends" && (
          <span className="text-sm opacity-60">
            {friendsLocations.length} {friendsLocations.length === 1 ? "drink" : "drinks"}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-black bg-black text-white"
                : "bg-background/50 hover:bg-foreground/5"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {/* My Drinks Tab */}
      {tab === "my-drinks" && (
        <>
          {myLocations.length === 0 ? (
            <div className="flex h-[calc(100vh-280px)] flex-col items-center justify-center rounded-2xl border bg-background/50 text-center">
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
                locations={myLocations}
                center={userLocation ?? { lat: myLocations[0].latitude, lng: myLocations[0].longitude }}
              />
            </div>
          )}
        </>
      )}

      {/* Friends Tab */}
      {tab === "friends" && (
        <>
          {friendsLoading ? (
            <div className="flex h-[calc(100vh-280px)] items-center justify-center rounded-2xl border bg-background/50">
              <Loader2 className="h-8 w-8 animate-spin opacity-50" />
            </div>
          ) : friendsLocations.length === 0 ? (
            <div className="flex h-[calc(100vh-280px)] flex-col items-center justify-center rounded-2xl border bg-background/50 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed">
                <Users className="h-7 w-7 opacity-50" />
              </div>
              <h3 className="text-lg font-semibold">No friend locations yet</h3>
              <p className="mt-1 max-w-sm px-4 text-sm opacity-70">
                When your friends log drinks with location, they'll appear here!
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border">
              <FriendsMap
                locations={friendsLocations}
                center={userLocation ?? { lat: friendsLocations[0].latitude, lng: friendsLocations[0].longitude }}
              />
            </div>
          )}
        </>
      )}

      {/* Happy Hour Tab */}
      {tab === "happy-hour" && (
        <div className="flex h-[calc(100vh-280px)] flex-col items-center justify-center rounded-2xl border bg-background/50 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed">
            <Clock className="h-7 w-7 opacity-50" />
          </div>
          <h3 className="text-lg font-semibold">Coming Soon</h3>
          <p className="mt-1 max-w-sm px-4 text-sm opacity-70">
            We're working on bringing you happy hour deals near you. Stay tuned!
          </p>
        </div>
      )}
    </div>
  )
}