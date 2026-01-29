"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Camera,
  User,
  Lock,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
} from "lucide-react"

type ProfileData = {
  username: string
  display_name: string
  avatar_path: string | null
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {/* Avatar Section Skeleton */}
      <div className="flex flex-col items-center">
        <div className="h-24 w-24 animate-pulse rounded-full bg-foreground/10" />
      </div>

      {/* Profile Fields Skeleton */}
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-24 animate-pulse rounded bg-foreground/10" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-foreground/10" />
          </div>
        ))}
      </div>

      {/* Password Fields Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-28 animate-pulse rounded bg-foreground/10" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-foreground/10" />
          </div>
        ))}
      </div>
    </div>
  )
}

function InputField({
  label,
  name,
  value,
  onChange,
  placeholder,
  icon: Icon,
  maxLength,
  error,
  prefix,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  icon?: React.ComponentType<{ className?: string }>
  maxLength?: number
  error?: string
  prefix?: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground/70">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center">
            <Icon className="h-5 w-5 text-foreground/40" />
          </div>
        )}
        {prefix && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center">
            <span className="text-sm text-foreground/40">{prefix}</span>
          </div>
        )}
        <input
          id={name}
          name={name}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            "w-full rounded-lg border bg-foreground/5 px-4 py-2.5 text-sm transition-colors",
            "placeholder:text-foreground/40",
            "focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30",
            (Icon || prefix) && "pl-10",
            error && "border-red-500/50 focus:ring-red-500/20"
          )}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function PasswordField({
  label,
  name,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  error?: string
}) {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground/70">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center">
          <Lock className="h-5 w-5 text-foreground/40" />
        </div>
        <input
          id={name}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border bg-foreground/5 pl-10 pr-10 py-2.5 text-sm transition-colors",
            "placeholder:text-foreground/40",
            "focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30",
            error && "border-red-500/50 focus:ring-red-500/20"
          )}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60"
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)

  // Profile fields
  const [username, setUsername] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null)
  const [avatarPath, setAvatarPath] = React.useState<string | null>(null)
  const [newAvatarFile, setNewAvatarFile] = React.useState<File | null>(null)
  const [newAvatarPreview, setNewAvatarPreview] = React.useState<string | null>(null)

  // Original data for change detection
  const [originalData, setOriginalData] = React.useState<ProfileData | null>(null)

  // Validation
  const [usernameError, setUsernameError] = React.useState<string | null>(null)

  // Password fields
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [currentPasswordError, setCurrentPasswordError] = React.useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = React.useState<string | null>(null)

  // Load profile data
  React.useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError(null)

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace("/login?redirectTo=%2Fprofile%2Fedit")
          return
        }
        setUserId(user.id)

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_path")
          .eq("id", user.id)
          .single()

        if (profileErr && profileErr.code !== "PGRST116") throw profileErr

        if (profile) {
          setDisplayName(profile.display_name || "")
          setUsername(profile.username || "")
          setAvatarPath(profile.avatar_path)
          setOriginalData({
            username: profile.username || "",
            display_name: profile.display_name || "",
            avatar_path: profile.avatar_path,
          })

          // Get signed URL for avatar (same as profile page)
          if (profile.avatar_path) {
            const { data: signedUrlData } = await supabase.storage
              .from("profile-photos")
              .createSignedUrl(profile.avatar_path, 60 * 60)
            if (signedUrlData?.signedUrl) {
              setAvatarUrl(signedUrlData.signedUrl)
            }
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "Could not load profile.")
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [supabase, router])

  // Cleanup preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (newAvatarPreview) {
        URL.revokeObjectURL(newAvatarPreview)
      }
    }
  }, [newAvatarPreview])

  // Validate username
  const validateUsername = (value: string) => {
    if (!value.trim()) {
      return "Username is required"
    }
    if (value.length < 3) {
      return "Username must be at least 3 characters"
    }
    if (value.length > 30) {
      return "Username must be 30 characters or less"
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return "Username can only contain letters, numbers, and underscores"
    }
    return null
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
    setUsername(value)
    setUsernameError(validateUsername(value))
  }

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value)
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB")
      return
    }

    setNewAvatarFile(file)
    setError(null)

    // Create preview URL
    if (newAvatarPreview) {
      URL.revokeObjectURL(newAvatarPreview)
    }
    const previewUrl = URL.createObjectURL(file)
    setNewAvatarPreview(previewUrl)
  }

  // Check if there are changes to save
  const hasChanges = React.useMemo(() => {
    if (!originalData) return false
    return (
      displayName !== originalData.display_name ||
      username !== originalData.username ||
      newAvatarFile !== null
    )
  }, [displayName, username, newAvatarFile, originalData])

  const hasPasswordChanges = currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0

  // Validate password - returns { field: 'current' | 'confirm', message: string } or null
  const validatePassword = (): { field: 'current' | 'confirm', message: string } | null => {
    if (!currentPassword && !newPassword && !confirmPassword) return null
    if (!currentPassword) {
      return { field: 'current', message: "Current password is required" }
    }
    if (!newPassword) {
      return { field: 'confirm', message: "New password is required" }
    }
    if (newPassword.length < 8) {
      return { field: 'confirm', message: "New password must be at least 8 characters" }
    }
    if (newPassword !== confirmPassword) {
      return { field: 'confirm', message: "Passwords do not match" }
    }
    if (newPassword === currentPassword) {
      return { field: 'confirm', message: "New password must be different from current password" }
    }
    return null
  }

  const currentAvatarUrl = newAvatarPreview || avatarUrl
  const avatarInitial = displayName?.[0]?.toUpperCase() || username?.[0]?.toUpperCase() || "U"
  const avatarColor = "#4ECDC4"

  const handleBack = () => {
    router.back()
  }

  const handleSave = async () => {
    // Validate password if changed
    if (hasPasswordChanges) {
      const pwError = validatePassword()
      if (pwError) {
        if (pwError.field === 'current') {
          setCurrentPasswordError(pwError.message)
        } else {
          setConfirmPasswordError(pwError.message)
        }
        return
      }
    }

    // Validate username
    if (usernameError) return

    if (!userId) return

    setSaving(true)

    try {
      let newAvatarPath = avatarPath

      // Upload new avatar if selected
      if (newAvatarFile) {
        const fileExt = newAvatarFile.name.split(".").pop()
        const fileName = `${userId}-${Date.now()}.${fileExt}`

        // Delete old avatar if exists
        if (avatarPath) {
          await supabase.storage.from("profile-photos").remove([avatarPath])
        }

        // Upload new avatar
        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(fileName, newAvatarFile)

        if (uploadError) throw uploadError
        newAvatarPath = fileName
      }

      // Check if username is taken (if changed)
      if (username !== originalData?.username) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .neq("id", userId)
          .single()

        if (existingUser) {
          setUsernameError("This username is already taken")
          setSaving(false)
          return
        }
      }

      // Update profile
      if (hasChanges) {
        await supabase
          .from("profiles")
          .update({
            display_name: displayName.trim(),
            username: username.trim(),
            avatar_path: newAvatarPath,
          })
          .eq("id", userId)
      }

      // Update password
      if (hasPasswordChanges && newPassword && currentPassword) {
        // Get user email for verification
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) throw new Error("Could not get user email")

        // Verify current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        })
        
        if (signInError) {
          setCurrentPasswordError("Current password is incorrect")
          setSaving(false)
          return
        }

        // Update to new password
        const { error: pwUpdateError } = await supabase.auth.updateUser({
          password: newPassword,
        })
        if (pwUpdateError) throw pwUpdateError
      }

      // Navigate back after successful save
      router.back()

    } catch (e: any) {
      setError(e?.message ?? "Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-3 py-1.5 pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center rounded-full border p-2"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-bold">Edit Profile</h2>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (!hasChanges && !hasPasswordChanges)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-3">
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <button
                type="button"
                onClick={handleAvatarClick}
                className="group relative"
              >
                {currentAvatarUrl ? (
                  <div className="relative h-24 w-24 overflow-hidden rounded-full">
                    <Image
                      src={currentAvatarUrl}
                      alt="Profile"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold text-white"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {avatarInitial}
                  </div>
                )}
                {/* Overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Profile Information */}
          <div className="space-y-3">
            <InputField
              label="Display Name"
              name="displayName"
              value={displayName}
              onChange={handleDisplayNameChange}
              placeholder="Your Name"
              icon={User}
              maxLength={50}
            />
            <InputField
              label="Username"
              name="username"
              value={username}
              onChange={handleUsernameChange}
              placeholder="username"
              prefix="@"
              maxLength={30}
              error={usernameError ?? undefined}
            />
          </div>

          {/* Password Section */}
          <div className="space-y-3">
            <PasswordField
              label="Current Password"
              name="currentPassword"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value)
                setCurrentPasswordError(null)
              }}
              placeholder="Enter current password"
              error={currentPasswordError ?? undefined}
            />
            <PasswordField
              label="New Password"
              name="newPassword"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setConfirmPasswordError(null)
              }}
              placeholder="Enter new password"
            />
            <PasswordField
              label="Confirm Password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setConfirmPasswordError(null)
              }}
              placeholder="Confirm new password"
              error={confirmPasswordError ?? undefined}
            />
          </div>
        </div>
      )}
    </div>
  )
}