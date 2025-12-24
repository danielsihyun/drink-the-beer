"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Plus, Edit2, Shield, ArrowUpDown, X, Camera } from "lucide-react"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"

type Granularity = "Drink" | "Day" | "Month" | "Year"

interface DrinkLog {
  id: string
  timestamp: string
  photoUrl: string
  drinkType: DrinkType
  caption?: string
}

const MOCK_PROFILE = {
  username: "you",
  displayName: "Your Name",
  joinDate: "January 2024",
  friendCount: 24,
  drinkCount: 87,
  avatarColor: "#4ECDC4",
  avatarUrl: null as string | null,
}

const MOCK_DRINK_LOGS: DrinkLog[] = [
  {
    id: "1",
    timestamp: "December 24, 25'",
    photoUrl: "/beer-glass-bar.jpg",
    drinkType: "Beer",
    caption: "Trying out the new IPA at the local brewery!",
  },
  {
    id: "2",
    timestamp: "December 23, 25'",
    photoUrl: "/wine-glass-restaurant.jpg",
    drinkType: "Wine",
  },
  {
    id: "3",
    timestamp: "December 22, 25'",
    photoUrl: "/cocktail-mojito.png",
    drinkType: "Cocktail",
    caption: "Friday night vibes 🍹",
  },
  {
    id: "4",
    timestamp: "December 21, 25'",
    photoUrl: "/seltzer-can.jpg",
    drinkType: "Seltzer",
  },
  {
    id: "5",
    timestamp: "December 20, 25'",
    photoUrl: "/whiskey-glass.jpg",
    drinkType: "Spirit",
    caption: "Celebrating the weekend!",
  },
  {
    id: "6",
    timestamp: "December 19, 25'",
    photoUrl: "/beer-pint.jpg",
    drinkType: "Beer",
  },
  {
    id: "7",
    timestamp: "December 18, 25'",
    photoUrl: "/wine-red-glass.jpg",
    drinkType: "Wine",
    caption: "Dinner with friends",
  },
  {
    id: "8",
    timestamp: "December 17, 25'",
    photoUrl: "/cocktail-martini.jpg",
    drinkType: "Cocktail",
  },
]

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Profile header skeleton */}
      <div className="animate-pulse rounded-2xl border bg-background/50 p-4">
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

      {/* Actions skeleton */}
      <div className="flex gap-2">
        <div className="h-10 flex-1 animate-pulse rounded-full bg-foreground/10" />
        <div className="h-10 flex-1 animate-pulse rounded-full bg-foreground/10" />
      </div>

      {/* Timeline skeleton */}
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
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed">
        <Plus className="h-8 w-8 opacity-50" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">No logs yet</h3>
      <p className="mb-6 max-w-sm text-sm opacity-70">Start logging drinks to build your timeline.</p>
      <Link
        href="/log"
        className="inline-flex items-center gap-2 rounded-full border bg-black px-4 py-2 text-sm font-medium text-white"
      >
        <Plus className="h-4 w-4" />
        Log Drink
      </Link>
    </div>
  )
}

function DrinkLogCard({ log, profile }: { log: DrinkLog; profile: typeof MOCK_PROFILE }) {
  return (
    <article className="rounded-2xl border bg-background/50 p-3">
      <div className="flex items-center gap-3">
        {profile.avatarUrl ? (
          <div className="relative h-10 w-10 overflow-hidden rounded-full">
            <Image
              src={profile.avatarUrl || "/placeholder.svg"}
              alt="Profile"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {profile.username[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-medium">{profile.username}</p>
          <p className="text-xs opacity-60">{log.timestamp}</p>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border">
        <Image
          src={log.photoUrl || "/placeholder.svg"}
          alt={`${log.drinkType} drink`}
          width={400}
          height={400}
          className="h-64 w-full object-cover"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
          {log.drinkType}
        </span>
      </div>

      {log.caption && <p className="mt-3 text-sm leading-relaxed">{log.caption}</p>}
    </article>
  )
}

interface GroupedDrinks {
  label: string
  drinks: DrinkLog[]
  count: number
}

function GroupedDrinkCard({ group }: { group: GroupedDrinks }) {
  const maxStack = 3 // Show up to 3 stacked photos
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
            <Image
              src={drink.photoUrl || "/placeholder.svg"}
              alt={`${drink.drinkType} drink`}
              fill
              className="object-cover"
            />
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

export default function ProfilePage() {
  const [loading, setLoading] = React.useState(true)
  const [logs, setLogs] = React.useState<DrinkLog[]>([])
  const [granularity, setGranularity] = React.useState<Granularity>("Drink")
  const [showSortMenu, setShowSortMenu] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [editedProfile, setEditedProfile] = React.useState(MOCK_PROFILE)
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setLogs(MOCK_DRINK_LOGS)
      setLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const handleEditClick = () => {
    setEditedProfile(MOCK_PROFILE)
    setAvatarFile(null)
    setIsEditing(true)
  }

  const handleSaveProfile = () => {
    if (avatarFile) {
      const url = URL.createObjectURL(avatarFile)
      MOCK_PROFILE.avatarUrl = url
    }
    MOCK_PROFILE.username = editedProfile.username
    MOCK_PROFILE.displayName = editedProfile.displayName
    MOCK_PROFILE.avatarColor = editedProfile.avatarColor
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditedProfile(MOCK_PROFILE)
    setAvatarFile(null)
    setIsEditing(false)
  }

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click()
    }
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const url = URL.createObjectURL(file)
      setEditedProfile({ ...editedProfile, avatarUrl: url })
    }
  }

  const getGroupedDrinks = (): GroupedDrinks[] => {
    if (granularity === "Drink") {
      return [] // Return empty to show individual cards
    }

    const groups: { [key: string]: DrinkLog[] } = {}

    logs.forEach((log) => {
      let key: string
      if (granularity === "Day") {
        key = log.timestamp
      } else if (granularity === "Month") {
        const parts = log.timestamp.split(", ")
        const monthYear = parts[0] + ", " + parts[1]
        key = monthYear
      } else {
        const parts = log.timestamp.split(", ")
        key = parts[1]
      }

      if (!groups[key]) groups[key] = []
      groups[key].push(log)
    })

    return Object.entries(groups).map(([label, drinks]) => ({
      label,
      drinks,
      count: drinks.length,
    }))
  }

  const groupedDrinks = getGroupedDrinks()

  const currentAvatarUrl = isEditing ? editedProfile.avatarUrl : MOCK_PROFILE.avatarUrl
  const currentAvatarColor = isEditing ? editedProfile.avatarColor : MOCK_PROFILE.avatarColor
  const currentUsername = isEditing ? editedProfile.username : MOCK_PROFILE.username

  return (
    <div className="container max-w-2xl px-4 py-6">
      <h2 className="mb-4 text-2xl font-bold">Profile</h2>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
          {/* Profile Header */}
          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="flex items-start gap-4">
              <div className="relative">
                {currentAvatarUrl ? (
                  <div className="relative h-20 w-20 overflow-hidden rounded-full">
                    <Image
                      src={currentAvatarUrl || "/placeholder.svg"}
                      alt="Profile"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                    style={{ backgroundColor: currentAvatarColor }}
                  >
                    {currentUsername[0].toUpperCase()}
                  </div>
                )}
                {isEditing && (
                  <>
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-black text-white"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleAvatarFileChange}
                    />
                  </>
                )}
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editedProfile.displayName}
                      onChange={(e) => setEditedProfile({ ...editedProfile, displayName: e.target.value })}
                      className="w-full rounded-lg border bg-background px-3 py-1.5 text-base font-bold"
                      placeholder="Display Name"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-sm opacity-60">@</span>
                      <input
                        type="text"
                        value={editedProfile.username}
                        onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value.toLowerCase() })}
                        className="flex-1 rounded-lg border bg-background px-2 py-1 text-sm"
                        placeholder="username"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-bold">{MOCK_PROFILE.displayName}</h3>
                    <p className="text-sm opacity-60">@{MOCK_PROFILE.username}</p>
                  </>
                )}
                <p className="mt-2 text-xs opacity-50">Joined {MOCK_PROFILE.joinDate}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <div>
                    <span className="font-bold">{MOCK_PROFILE.friendCount}</span>{" "}
                    <span className="opacity-60">Friends</span>
                  </div>
                  <div>
                    <span className="font-bold">{MOCK_PROFILE.drinkCount}</span>{" "}
                    <span className="opacity-60">Drinks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Actions */}
          {isEditing ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-black px-4 py-2.5 text-sm font-medium text-white"
              >
                Save Changes
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleEditClick}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border bg-black px-4 py-2.5 text-sm font-medium text-white"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </button>
          )}

          {/* Privacy Section */}
          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 opacity-60" />
              <div>
                <h4 className="text-sm font-semibold">Privacy</h4>
                <p className="mt-1 text-xs leading-relaxed opacity-70">
                  Your photos are private by default and only visible to friends you've connected with.
                </p>
              </div>
            </div>
          </div>

          {/* My Drink Timeline */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">My Timeline</h3>
              {!isEditing && (
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
              )}
            </div>
            {logs.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                {granularity === "Drink"
                  ? logs.map((log) => <DrinkLogCard key={log.id} log={log} profile={editedProfile} />)
                  : groupedDrinks.map((group, index) => (
                      <GroupedDrinkCard key={`${group.label}-${index}`} group={group} />
                    ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
