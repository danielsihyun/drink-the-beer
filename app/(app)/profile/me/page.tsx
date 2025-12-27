"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpDown, Camera, Edit2, FilePenLine, Loader2, LogOut, Plus, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"
type Granularity = "Drink" | "Day" | "Month" | "Year"

const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

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
  created_at: string | null
  avatar_path?: string | null
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

const DEFAULT_PROFILE: UiProfile = {
  username: "you",
  displayName: "Your Name",
  joinDate: "—",
  friendCount: 0,
  drinkCount: 0,
  avatarColor: "#4ECDC4",
  avatarUrl: null,
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

      <div className="flex gap-2">
        <div className="h-10 flex-1 animate-pulse rounded-full bg-foreground/10" />
        <div className="h-10 flex-1 animate-pulse rounded-full bg-foreground/10" />
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

function DrinkLogCard({
  log,
  profile,
  onEdit,
  onDelete,
}: {
  log: DrinkLog
  profile: UiProfile
  onEdit: (log: DrinkLog) => void
  onDelete: (log: DrinkLog) => void
}) {
  return (
    <article className="rounded-2xl border bg-background/50 p-3">
      <div className="flex items-center gap-2">
        {profile.avatarUrl ? (
          <div className="relative h-10 w-10 overflow-hidden rounded-full">
            <Image src={profile.avatarUrl || "/placeholder.svg"} alt="Profile" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {profile.username[0]?.toUpperCase() ?? "Y"}
          </div>
        )}

        <div className="flex-1">
          <p className="text-sm font-medium">{profile.username}</p>
          <p className="text-xs opacity-60">{log.timestampLabel}</p>
        </div>

        <span className="inline-flex shrink-0 rounded-full border bg-black/5 px-3 py-1 text-xs font-medium">
          {log.drinkType}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border">
        <div className="relative aspect-square w-full">
          <Image src={log.photoUrl || "/placeholder.svg"} alt={`${log.drinkType} drink`} fill className="object-cover" unoptimized />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="flex h-7.5 items-center pl-2">
          {log.caption ? (
            <p className="text-sm leading-relaxed">{log.caption}</p>
          ) : (
            <p className="text-sm leading-relaxed opacity-50">No caption</p>
          )}
        </div>

        <div className="flex items-end justify-end gap-1">
          <button
            type="button"
            onClick={() => onEdit(log)}
            className="inline-flex items-center justify-center text-foreground/70 hover:text-foreground active:scale-[0.99]"
            style={{ width: "30px", height: "30px" }}
            aria-label="Edit post"
            title="Edit"
          >
            <FilePenLine className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(log)}
            className="inline-flex items-center justify-center text-red-400 hover:text-red-300 active:scale-[0.99]"
            style={{ width: "30px", height: "30px" }}
            aria-label="Delete post"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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
            <Image src={drink.photoUrl || "/placeholder.svg"} alt={`${drink.drinkType} drink`} fill className="object-cover" unoptimized />
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

function OverlayPage({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60">
      <div className="fixed inset-x-0 bottom-0 top-0 mx-auto w-full max-w-2xl">
        <div className="flex h-full flex-col bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-base font-semibold">{title}</div>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 safe-area-inset">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const successTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [userId, setUserId] = React.useState<string | null>(null)
  const [profile, setProfile] = React.useState<UiProfile>(DEFAULT_PROFILE)
  const [logs, setLogs] = React.useState<DrinkLog[]>([])

  const [granularity, setGranularity] = React.useState<Granularity>("Drink")
  const [showSortMenu, setShowSortMenu] = React.useState(false)

  const [isEditingProfile, setIsEditingProfile] = React.useState(false)
  const [editedProfile, setEditedProfile] = React.useState<UiProfile>(DEFAULT_PROFILE)
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [savingProfile, setSavingProfile] = React.useState(false)

  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmNewPassword, setConfirmNewPassword] = React.useState("")

  const [editPostOpen, setEditPostOpen] = React.useState(false)
  const [deletePostOpen, setDeletePostOpen] = React.useState(false)
  const [activePost, setActivePost] = React.useState<DrinkLog | null>(null)

  const [postDrinkType, setPostDrinkType] = React.useState<DrinkType>("Beer")
  const [postCaption, setPostCaption] = React.useState("")
  const [postBusy, setPostBusy] = React.useState(false)
  const [postError, setPostError] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  function setErrorMsg(msg: string) {
    // Errors persist until replaced or cleared by success
    setSuccess(null)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    setError(msg)
  }

  function setSuccessMsg(msg: string) {
    // Success auto-dismisses after 4s
    setError(null)
    setSuccess(msg)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => {
      setSuccess(null)
    }, 3000)
  }

  const load = React.useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user
      if (!user) {
        router.replace("/login?redirectTo=%2Fprofile")
        return
      }

      setUserId(user.id)

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id,username,display_name,created_at,avatar_path")
        .eq("id", user.id)
        .single()
      if (profErr) throw profErr

      const p = prof as ProfileRow

      let avatarUrl: string | null = null
      if (p.avatar_path) {
        const { data } = await supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 60 * 60)
        avatarUrl = data?.signedUrl ?? null
      }

      const { data: rows, error: logsErr } = await supabase
        .from("drink_logs")
        .select("id,user_id,photo_path,drink_type,caption,created_at")
        .eq("user_id", user.id)
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

      setProfile((prev) => ({
        ...prev,
        username: p.username,
        displayName: p.display_name,
        joinDate: formatJoinDate(p.created_at),
        drinkCount: mapped.length,
        avatarUrl,
      }))
      setEditedProfile((prev) => ({
        ...prev,
        username: p.username,
        displayName: p.display_name,
        joinDate: formatJoinDate(p.created_at),
        drinkCount: mapped.length,
        avatarUrl,
      }))
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Something went wrong loading your profile.")
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  React.useEffect(() => {
    load()
  }, [load])

  const handleEditClick = () => {
    setEditedProfile(profile)
    setAvatarFile(null)
    setIsEditingProfile(true)
    setError(null)
    setSuccess(null)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmNewPassword("")
  }

  const handleCancelEdit = () => {
    setEditedProfile(profile)
    setAvatarFile(null)
    setIsEditingProfile(false)
    setError(null)
    setSuccess(null)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmNewPassword("")
  }

  const handleAvatarClick = () => {
    if (isEditingProfile) fileInputRef.current?.click()
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setAvatarFile(f)
      const url = URL.createObjectURL(f)
      setEditedProfile({ ...editedProfile, avatarUrl: url })
    }
  }

  async function handleSaveProfile() {
    // Don’t auto-clear errors here; only clear on success.
    setSavingProfile(true)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user
      if (!user) {
        router.replace("/login?redirectTo=%2Fprofile")
        return
      }

      const prevUsername = profile.username
      const nextUsername = editedProfile.username.trim().toLowerCase()
      const nextDisplayName = editedProfile.displayName.trim()

      if (nextUsername.length < 3) {
        setErrorMsg("Username must be at least 3 characters.")
        return
      }
      if (!/^[a-z0-9_]+$/.test(nextUsername)) {
        setErrorMsg("Username must be letters, numbers, underscores only.")
        return
      }

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ username: nextUsername, display_name: nextDisplayName })
        .eq("id", user.id)

      if (updErr) {
        if ((updErr as any).code === "23505") {
          setErrorMsg("Username must be unique. Try something else.")
          return
        }
        throw updErr
      }

      const wantsPasswordChange =
        currentPassword.trim().length > 0 || newPassword.trim().length > 0 || confirmNewPassword.trim().length > 0

      if (wantsPasswordChange) {
        const cp = currentPassword.trim()
        const np = newPassword.trim()
        const cnp = confirmNewPassword.trim()

        if (!cp) throw new Error("Enter your current password to change your password.")
        if (np.length < 8) throw new Error("New password must be at least 8 characters.")
        if (np !== cnp) throw new Error("New passwords do not match.")

        const email = user.email
        if (!email) throw new Error("No email found on this account; cannot verify current password.")

        const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: cp })
        if (reauthErr) throw new Error("Current password is incorrect.")

        const { error: pwErr } = await supabase.auth.updateUser({ password: np })
        if (pwErr) throw pwErr

        setCurrentPassword("")
        setNewPassword("")
        setConfirmNewPassword("")
      }

      let avatarUrl = profile.avatarUrl
      if (avatarFile) avatarUrl = URL.createObjectURL(avatarFile)

      const updated: UiProfile = {
        ...profile,
        username: nextUsername,
        displayName: nextDisplayName,
        avatarUrl,
      }

      setProfile(updated)
      setEditedProfile(updated)
      setIsEditingProfile(false)

      // Clear any prior error after successful save.
      setError(null)

      // Only show success popup if username changed
      if (nextUsername !== prevUsername) {
        setSuccessMsg("Username changed successfully.")
      } else {
        // if username didn’t change, don’t show a username success popup
        setSuccess(null)
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Could not save profile.")
    } finally {
      setSavingProfile(false)
    }
  }

  async function onLogout() {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.replace("/login")
    } finally {
      setLoggingOut(false)
    }
  }

  function openEditPost(log: DrinkLog) {
    setActivePost(log)
    setPostDrinkType(log.drinkType)
    setPostCaption(log.caption ?? "")
    setPostError(null)
    setEditPostOpen(true)
  }

  function openDeletePost(log: DrinkLog) {
    setActivePost(log)
    setPostError(null)
    setDeletePostOpen(true)
  }

  async function savePostEdits() {
    if (!activePost) return
    if (!userId) return setPostError("Not signed in.")

    setPostError(null)
    setPostBusy(true)

    try {
      const nextCaption = postCaption.trim()
      const { error: updErr } = await supabase
        .from("drink_logs")
        .update({
          drink_type: postDrinkType,
          caption: nextCaption.length ? nextCaption : null,
        })
        .eq("id", activePost.id)
        .eq("user_id", userId)

      if (updErr) throw updErr

      setLogs((prev) =>
        prev.map((l) =>
          l.id === activePost.id
            ? { ...l, drinkType: postDrinkType, caption: nextCaption.length ? nextCaption : undefined }
            : l
        )
      )

      setEditPostOpen(false)
      setActivePost(null)
    } catch (e: any) {
      setPostError(e?.message ?? "Could not update post.")
    } finally {
      setPostBusy(false)
    }
  }

  async function deletePostConfirmed() {
    if (!activePost) return
    if (!userId) return setPostError("Not signed in.")

    setPostError(null)
    setPostBusy(true)

    try {
      const { error: delErr } = await supabase.from("drink_logs").delete().eq("id", activePost.id).eq("user_id", userId)
      if (delErr) throw delErr

      if (activePost.photoPath) {
        await supabase.storage.from("drink-photos").remove([activePost.photoPath])
      }

      setLogs((prev) => prev.filter((l) => l.id !== activePost.id))
      setProfile((p) => ({ ...p, drinkCount: Math.max(0, p.drinkCount - 1) }))
      setEditedProfile((p) => ({ ...p, drinkCount: Math.max(0, p.drinkCount - 1) }))

      setDeletePostOpen(false)
      setActivePost(null)
    } catch (e: any) {
      setPostError(e?.message ?? "Could not delete post.")
    } finally {
      setPostBusy(false)
    }
  }

  const getGroupedDrinks = (): GroupedDrinks[] => {
    if (granularity === "Drink") return []
    const groups: Record<string, DrinkLog[]> = {}

    for (const log of logs) {
      const label = formatGroupLabel(log.createdAt, granularity)
      if (!groups[label]) groups[label] = []
      groups[label].push(log)
    }

    return Object.entries(groups).map(([label, drinks]) => ({
      label,
      drinks,
      count: drinks.length,
    }))
  }

  const groupedDrinks = getGroupedDrinks()
  const current = isEditingProfile ? editedProfile : profile

  return (
    <>
      <div className="container max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Profile</h2>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Log out
          </button>
        </div>

        {success ? (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-6 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
            <div className="rounded-2xl border bg-background/50 p-4">
              <div className="flex items-start gap-4">
                <div className="relative">
                  {current.avatarUrl ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-full">
                      <Image src={current.avatarUrl || "/placeholder.svg"} alt="Profile" fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                      style={{ backgroundColor: current.avatarColor }}
                    >
                      {current.username[0]?.toUpperCase() ?? "Y"}
                    </div>
                  )}

                  {isEditingProfile && (
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
                  {isEditingProfile ? (
                    <div className="space-y-3">
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
                            onChange={(e) =>
                              setEditedProfile({ ...editedProfile, username: e.target.value.toLowerCase() })
                            }
                            className="flex-1 rounded-lg border bg-background px-2 py-1 text-sm"
                            placeholder="username"
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border bg-background/50 p-3">
                        <div className="text-sm font-medium">Change password</div>
                        <p className="mt-1 text-xs opacity-60">Leave blank to keep your current password.</p>

                        <div className="mt-3 space-y-2">
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                            placeholder="Current password"
                            autoComplete="current-password"
                            disabled={savingProfile}
                          />
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                            placeholder="New password (min 8 characters)"
                            autoComplete="new-password"
                            disabled={savingProfile}
                          />
                          <input
                            type="password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                            placeholder="Confirm new password"
                            autoComplete="new-password"
                            disabled={savingProfile}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold">{profile.displayName}</h3>
                      <p className="text-sm opacity-60">@{profile.username}</p>
                    </>
                  )}

                  <p className="mt-2 text-xs opacity-50">Joined {profile.joinDate}</p>

                  <div className="mt-3 flex gap-4 text-sm">
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

            {isEditingProfile ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
                  disabled={savingProfile}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-black px-4 py-2.5 text-sm font-medium text-white"
                  disabled={savingProfile}
                >
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">My Timeline</h3>

                {!isEditingProfile && (
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
                    ? logs.map((log) => (
                        <DrinkLogCard key={log.id} log={log} profile={current} onEdit={openEditPost} onDelete={openDeletePost} />
                      ))
                    : groupedDrinks.map((group, index) => <GroupedDrinkCard key={`${group.label}-${index}`} group={group} />)}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={load}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
            >
              <Loader2 className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4 opacity-0"} />
              Refresh timeline
            </button>
          </div>
        )}
      </div>

      {editPostOpen && activePost ? (
        <OverlayPage
          title="Edit post"
          onClose={() => {
            if (postBusy) return
            setEditPostOpen(false)
            setActivePost(null)
            setPostError(null)
          }}
        >
          {postError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {postError}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border bg-background/50">
            <div className="relative aspect-square w-full">
              <Image src={activePost.photoUrl || "/placeholder.svg"} alt="Post photo" fill className="object-cover" unoptimized />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border bg-background/50 p-3">
            <div className="text-sm font-medium">Drink type</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DRINK_TYPES.map((t) => {
                const selected = t === postDrinkType
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPostDrinkType(t)}
                    className={[
                      "rounded-full border px-4 py-2 text-sm",
                      "active:scale-[0.99]",
                      selected ? "border-black bg-black text-white" : "bg-transparent hover:bg-foreground/5",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-background/50 p-3">
            <div className="text-sm font-medium">Caption</div>
            <textarea
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              placeholder="Update your caption…"
              className="mt-3 h-28 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
              maxLength={200}
              disabled={postBusy}
            />
            <div className="mt-2 text-right text-xs opacity-60">{postCaption.length}/200</div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (postBusy) return
                setEditPostOpen(false)
                setActivePost(null)
                setPostError(null)
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              disabled={postBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={savePostEdits}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-black px-4 py-2.5 text-sm font-medium text-white"
              disabled={postBusy}
            >
              {postBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </OverlayPage>
      ) : null}

      {deletePostOpen && activePost ? (
        <OverlayPage
          title="Delete post"
          onClose={() => {
            if (postBusy) return
            setDeletePostOpen(false)
            setActivePost(null)
            setPostError(null)
          }}
        >
          {postError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {postError}
            </div>
          ) : null}

          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold">Are you sure?</div>
                <p className="mt-1 text-sm opacity-70">
                  This will permanently delete this post (and its photo) from your account.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border bg-background/50">
            <div className="relative aspect-square w-full">
              <Image src={activePost.photoUrl || "/placeholder.svg"} alt="Post photo" fill className="object-cover" unoptimized />
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (postBusy) return
                setDeletePostOpen(false)
                setActivePost(null)
                setPostError(null)
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
              disabled={postBusy}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={deletePostConfirmed}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-200"
              disabled={postBusy}
            >
              {postBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </button>
          </div>
        </OverlayPage>
      ) : null}
    </>
  )
}
