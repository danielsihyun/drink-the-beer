"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowLeft, ArrowUpDown, Loader2 } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"
type Granularity = "Drink" | "Day" | "Month" | "Year"

type DrinkLogRow = {
  id: string
  user_id: string
  photo_path: string
  drink_type: DrinkType
  caption: string | null
  created_at: string
}

type ProfileRow = {
  id: string
  username: string
  display_name: string
  avatar_path: string | null
  friend_count: number | null
  drink_count: number | null
}

type ProfileMetaRow = {
  created_at: string | null
}

type UiProfile = {
  username: string
  displayName: string
  joinDate: string
  friendCount: number
  drinkCount: number
  avatarColor: string
  avatarUrl: string | null
}

interface DrinkLog {
  id: string
  userId: string
  photoPath: string
  createdAt: string
  timestampLabel: string
  photoUrl: string
  drinkType: DrinkType
  caption?: string
}

interface GroupedDrinks {
  label: string
  drinks: DrinkLog[]
  count: number
}

function formatCardTimestamp(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  const month = d.toLocaleString("en-US", { month: "short" })
  const day = d.getDate()
  const year2 = String(d.getFullYear()).slice(-2)

  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  if (hours === 0) hours = 12

  return `${month} ${day}, ${year2}' at ${hours}:${minutes}${ampm}`
}

function formatJoinDate(isoOrNull: string | null) {
  if (!isoOrNull) return "—"
  const d = new Date(isoOrNull)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d)
}

function formatGroupLabel(iso: string, granularity: Exclude<Granularity, "Drink">) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  if (granularity === "Day") {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(d)
  }

  if (granularity === "Month") {
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d)
  }

  return new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(d)
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse rounded-2xl border bg-background/50 p-3">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 rounded-full bg-foreground/10" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-32 rounded bg-foreground/10" />
            <div className="h-3 w-24 rounded bg-foreground/10" />
            <div className="flex gap-4">
              <div className="h-3 w-20 rounded bg-foreground/10" />
              <div className="h-3 w-20 rounded bg-foreground/10" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border bg-background/50 p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-foreground/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-foreground/10" />
                <div className="h-2 w-16 rounded bg-foreground/10" />
              </div>
            </div>
            <div className="mt-3 h-64 rounded-xl bg-foreground/10" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <h3 className="mb-2 text-lg font-semibold">No logs yet</h3>
      <p className="max-w-sm text-sm opacity-70">This user hasn't logged any drinks.</p>
    </div>
  )
}

function DrinkLogCard({ log, profile }: { log: DrinkLog; profile: UiProfile }) {
  return (
    <article className="rounded-2xl border bg-background/50 p-3">
      <div className="flex items-center gap-2">
        {profile.avatarUrl ? (
          <div className="relative h-10 w-10 overflow-hidden rounded-full">
            <Image src={profile.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {profile.username[0]?.toUpperCase() ?? "U"}
          </div>
        )}

        <div className="flex-1 pl-[2px]">
          <p className="text-sm font-medium">{profile.username}</p>
          <p className="text-xs opacity-60">{log.timestampLabel}</p>
        </div>

        <span className="inline-flex shrink-0 rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
          {log.drinkType}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border">
        <div className="relative aspect-square w-full">
          <Image src={log.photoUrl} alt={`${log.drinkType} drink`} fill className="object-cover" unoptimized />
        </div>
      </div>

      <div className="mt-3 flex h-7.5 items-center pl-2">
        {log.caption ? (
          <p className="text-sm leading-relaxed">{log.caption}</p>
        ) : (
          <p className="text-sm leading-relaxed opacity-50">No caption</p>
        )}
      </div>
    </article>
  )
}

function GroupedDrinkCard({ group }: { group: GroupedDrinks }) {
  const maxStack = 3
  const displayDrinks = group.drinks.slice(0, maxStack)

  return (
    <article className="rounded-2xl border bg-background/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{group.label}</h4>
          <p className="text-sm opacity-60">
            {group.count} {group.count === 1 ? "drink" : "drinks"}
          </p>
        </div>
      </div>

      <div className="relative h-64">
        {displayDrinks.map((drink, index) => (
          <div
            key={drink.id}
            className="absolute overflow-hidden rounded-xl border-4 border-background shadow-lg transition-transform hover:z-10 hover:scale-105"
            style={{
              left: `${index * 16}px`,
              top: `${index * 16}px`,
              right: `${(displayDrinks.length - 1 - index) * 16}px`,
              bottom: `${(displayDrinks.length - 1 - index) * 16}px`,
              zIndex: displayDrinks.length - index,
            }}
          >
            <Image src={drink.photoUrl} alt={`${drink.drinkType} drink`} fill className="object-cover" unoptimized />
          </div>
        ))}

        {group.count > maxStack && (
          <div
            className="absolute flex items-center justify-center rounded-xl border-4 border-background bg-black/80 text-white shadow-lg"
            style={{
              left: `${maxStack * 16}px`,
              top: `${maxStack * 16}px`,
              right: 0,
              bottom: 0,
              zIndex: 0,
            }}
          >
            <span className="text-2xl font-bold">+{group.count - maxStack}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from(new Set(group.drinks.map((d) => d.drinkType))).map((type) => (
          <span key={type} className="inline-flex rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
            {type}
          </span>
        ))}
      </div>
    </article>
  )
}

export default function UserProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const username = params.username as string

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [profile, setProfile] = React.useState<UiProfile | null>(null)
  const [logs, setLogs] = React.useState<DrinkLog[]>([])

  const [granularity, setGranularity] = React.useState<Granularity>("Drink")
  const [showSortMenu, setShowSortMenu] = React.useState(false)

  const load = React.useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      if (!userRes.user) {
        router.replace("/login?redirectTo=%2Ffeed")
        return
      }

      const { data: prof, error: profErr } = await supabase
        .from("profile_public_stats")
        .select("id,username,display_name,avatar_path,friend_count,drink_count")
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

      const p = prof as ProfileRow

      const { data: meta, error: metaErr } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("id", p.id)
        .single()
      if (metaErr) throw metaErr

      const m = meta as ProfileMetaRow

      let avatarSignedUrl: string | null = null
      if (p.avatar_path) {
        const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60)
        avatarSignedUrl = data?.signedUrl ?? null
      }

      const { data: rows, error: logsErr } = await supabase
        .from("drink_logs")
        .select("id,user_id,photo_path,drink_type,caption,created_at")
        .eq("user_id", p.id)
        .order("created_at", { ascending: false })
        .limit(200)
      if (logsErr) throw logsErr

      const base = (rows ?? []) as DrinkLogRow[]
      const mapped: DrinkLog[] = await Promise.all(
        base.map(async (r) => {
          const { data } = await supabase.storage.from("drink-photos").createSignedUrl(r.photo_path, 60 * 60)
          return {
            id: r.id,
            userId: r.user_id,
            photoPath: r.photo_path,
            createdAt: r.created_at,
            timestampLabel: formatCardTimestamp(r.created_at),
            photoUrl: data?.signedUrl ?? "",
            drinkType: r.drink_type,
            caption: r.caption ?? undefined,
          }
        })
      )

      setLogs(mapped)

      const ui: UiProfile = {
        username: p.username,
        displayName: p.display_name,
        joinDate: formatJoinDate(m.created_at),
        friendCount: p.friend_count ?? 0,
        drinkCount: p.drink_count ?? 0,
        avatarColor: "#4ECDC4",
        avatarUrl: avatarSignedUrl,
      }

      setProfile(ui)
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong loading this profile.")
    } finally {
      setLoading(false)
    }
  }, [router, supabase, username])

  React.useEffect(() => {
    load()
  }, [load])

  const getGroupedDrinks = (): GroupedDrinks[] => {
    if (granularity === "Drink") return []
    const groups: Record<string, DrinkLog[]> = {}

    for (const log of logs) {
      const label = formatGroupLabel(log.createdAt, granularity)
      if (!groups[label]) groups[label] = []
      groups[label].push(log)
    }

    return Object.entries(groups).map(([label, drinks]) => ({ label, drinks, count: drinks.length }))
  }

  const groupedDrinks = getGroupedDrinks()

  return (
    <div className="container max-w-2xl px-3 py-1.5">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold">Profile</h2>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingSkeleton />
      ) : profile ? (
        <div className="space-y-6 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
          {/* PROFILE CARD - matches personal profile exactly */}
          <div className="rounded-2xl border bg-background/50 p-3">
            <div className="flex items-start gap-4">
              {profile.avatarUrl ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-full">
                  <Image src={profile.avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                  style={{ backgroundColor: profile.avatarColor }}
                >
                  {profile.username[0]?.toUpperCase() ?? "U"}
                </div>
              )}

              <div className="flex-1">
                <h3 className="text-lg font-bold">{profile.displayName}</h3>
                <p className="text-sm opacity-60">@{profile.username}</p>
                <p className="mt-2 text-xs opacity-50">Joined {profile.joinDate}</p>

                <div className="mt-1 flex gap-4 text-sm">
                  <div>
                    <span className="font-bold">{profile.friendCount}</span>{" "}
                    <span className="opacity-60">Friends</span>
                  </div>
                  <div>
                    <span className="font-bold">{profile.drinkCount}</span>{" "}
                    <span className="opacity-60">Drinks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{profile.username}'s Timeline</h3>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {granularity}
                </button>

                {showSortMenu && (
                  <div className="absolute right-0 top-full z-10 mt-2 w-32 rounded-xl border bg-background shadow-lg">
                    {(["Drink", "Day", "Month", "Year"] as Granularity[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setGranularity(option)
                          setShowSortMenu(false)
                        }}
                        className={`w-full px-4 py-3 text-left text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-foreground/5 ${
                          granularity === option ? "font-semibold" : ""
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {logs.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                {granularity === "Drink"
                  ? logs.map((log) => <DrinkLogCard key={log.id} log={log} profile={profile} />)
                  : groupedDrinks.map((group, index) => (
                      <GroupedDrinkCard key={`${group.label}-${index}`} group={group} />
                    ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}