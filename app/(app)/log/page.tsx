"use client"

import * as React from "react"
import Image from "next/image"
import Cropper from "react-easy-crop"
import { Camera, Loader2, X, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAchievements } from "@/contexts/achievement-context"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"

const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

type Area = { width: number; height: number; x: number; y: number }

type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable"

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.addEventListener("load", () => resolve(img))
    img.addEventListener("error", (e) => reject(e))
    img.src = url
  })
}

async function getCroppedFile(imageSrc: string, crop: Area, outputMime: string) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not prepare image crop.")

  canvas.width = crop.width
  canvas.height = crop.height

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) return reject(new Error("Could not crop image."))
        resolve(b)
      },
      outputMime,
      outputMime === "image/jpeg" ? 0.92 : undefined
    )
  })

  const ext = outputMime === "image/png" ? "png" : "jpg"

  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`

  const file = new File([blob], `${uuid}.${ext}`, { type: outputMime })
  return file
}

export default function LogDrinkPage() {
  const supabase = createClient()
  const router = useRouter()
  const { checkAchievements } = useAchievements()

  const [drinkType, setDrinkType] = React.useState<DrinkType | null>(null)
  const [caption, setCaption] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Crop UI state
  const [cropOpen, setCropOpen] = React.useState(false)
  const [rawFile, setRawFile] = React.useState<File | null>(null)
  const [rawUrl, setRawUrl] = React.useState<string | null>(null)
  const [crop, setCrop] = React.useState({ x: 0, y: 0 })
  const [zoom, setZoom] = React.useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null)
  const [cropping, setCropping] = React.useState(false)

  // Geolocation state
  const [location, setLocation] = React.useState<{ latitude: number; longitude: number } | null>(null)
  const [locationStatus, setLocationStatus] = React.useState<LocationStatus>("idle")

  // crop area should max out the square
  const cropWrapRef = React.useRef<HTMLDivElement | null>(null)
  const [cropSize, setCropSize] = React.useState<{ width: number; height: number } | null>(null)

  const canPost = Boolean(file && drinkType && !submitting)

  // ==========================================================================
  // GEOLOCATION HANDLING
  // - On page load: check permission state (without prompting)
  // - If already granted: get location silently
  // - If denied: skip, don't bother user
  // - If prompt needed: wait until user taps "Post" (user gesture required)
  // - Browser remembers the choice permanently for this domain
  // ==========================================================================

  // Get location helper - used both on load (if granted) and on submit (if prompt)
  const getLocation = React.useCallback((): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationStatus("unavailable")
        resolve(null)
        return
      }

      setLocationStatus("requesting")

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
          setLocation(loc)
          setLocationStatus("granted")
          resolve(loc)
        },
        (err) => {
          // User denied or error occurred
          console.log("Geolocation error:", err.code, err.message)
          if (err.code === 1) {
            // PERMISSION_DENIED
            setLocationStatus("denied")
          } else {
            // POSITION_UNAVAILABLE or TIMEOUT - permission may still be granted
            setLocationStatus("granted")
          }
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000, // Cache for 1 minute
        }
      )
    })
  }, [])

  // Check permission state on mount
  React.useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable")
      return
    }

    // Use Permissions API to check state without triggering a prompt
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((permissionStatus) => {
          if (permissionStatus.state === "granted") {
            // Already have permission - get location silently in background
            getLocation()
          } else if (permissionStatus.state === "denied") {
            // User previously denied - don't ask again
            setLocationStatus("denied")
          } else {
            // "prompt" - will need to ask, but wait for user gesture
            setLocationStatus("idle")
          }

          // Listen for permission changes (e.g., user changes in browser settings)
          permissionStatus.addEventListener("change", () => {
            if (permissionStatus.state === "granted") {
              // Permission was just granted - get location
              getLocation()
            } else if (permissionStatus.state === "denied") {
              setLocationStatus("denied")
              setLocation(null)
            }
          })
        })
        .catch(() => {
          // Permissions API not supported (e.g., older Safari)
          // We'll request on submit with user gesture
          setLocationStatus("idle")
        })
    } else {
      // No Permissions API - will request on submit
      setLocationStatus("idle")
    }
  }, [getLocation])

  React.useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  React.useEffect(() => {
    if (!rawFile) return
    const url = URL.createObjectURL(rawFile)
    setRawUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [rawFile])

  // keep crop target full-bleed inside the square container
  React.useEffect(() => {
    if (!cropOpen) return
    if (!cropWrapRef.current) return
    const el = cropWrapRef.current

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      const s = Math.floor(Math.min(r.width, r.height))
      setCropSize({ width: s, height: s })
    })

    ro.observe(el)

    // set initial size immediately
    const r0 = el.getBoundingClientRect()
    const s0 = Math.floor(Math.min(r0.width, r0.height))
    setCropSize({ width: s0, height: s0 })

    return () => ro.disconnect()
  }, [cropOpen])

  function resetForm() {
    setDrinkType(null)
    setCaption("")
    setFile(null)
    setPreviewUrl(null)
    setRawFile(null)
    setRawUrl(null)
    setCropOpen(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    // Note: We don't reset location/locationStatus - those persist across posts
  }

  async function onSubmit() {
    setError(null)
    setSuccess(null)

    if (!file) return setError("Please take or upload a photo.")
    if (!drinkType) return setError("Please select a drink type.")

    setSubmitting(true)
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user
      if (!user) {
        router.replace("/login?redirectTo=%2Flog")
        return
      }

      // ==========================================================================
      // LOCATION: Request if we don't have it yet and haven't been denied
      // This is triggered by user action (tapping Post), so the browser allows the prompt
      // The browser will remember the user's choice for future visits
      // ==========================================================================
      let finalLocation = location
      if (!finalLocation && locationStatus === "idle") {
        // First time posting - this will show the permission prompt
        finalLocation = await getLocation()
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"

      const uuid =
        typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`

      const filename = `${uuid}.${ext}`
      const photoPath = `${user.id}/${filename}`

      const { error: uploadErr } = await supabase.storage.from("drink-photos").upload(photoPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      })
      if (uploadErr) throw uploadErr

      const nextCaption = caption.trim()

      // Build insert data
      const insertData: {
        user_id: string
        photo_path: string
        drink_type: DrinkType
        caption: string | null
        latitude?: number
        longitude?: number
      } = {
        user_id: user.id,
        photo_path: photoPath,
        drink_type: drinkType,
        caption: nextCaption.length ? nextCaption : null,
      }

      // Include location if available
      if (finalLocation) {
        insertData.latitude = finalLocation.latitude
        insertData.longitude = finalLocation.longitude
      }

      const { error: insErr } = await supabase.from("drink_logs").insert(insertData)
      if (insErr) throw insErr

      await checkAchievements()

      resetForm()
      router.replace("/feed?posted=1")
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again."
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  function onPickFile(f: File | null) {
    if (!f) return
    setError(null)
    setSuccess(null)

    // Open cropper for the newly selected image
    setRawFile(f)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setCropOpen(true)
  }

  async function onConfirmCrop() {
    if (!rawUrl || !croppedAreaPixels) return

    setCropping(true)
    try {
      // Prefer PNG if user picked PNG, otherwise JPEG
      const outputMime = rawFile?.type === "image/png" ? "image/png" : "image/jpeg"
      const cropped = await getCroppedFile(rawUrl, croppedAreaPixels, outputMime)
      setFile(cropped)
      setCropOpen(false)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not crop image."
      setError(message)
      setCropOpen(false)
      setRawFile(null)
      setRawUrl(null)
    } finally {
      setCropping(false)
    }
  }

  function onCancelCrop() {
    setCropOpen(false)
    setRawFile(null)
    setRawUrl(null)
    setCroppedAreaPixels(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Helper to render location status indicator
  function renderLocationStatus() {
    switch (locationStatus) {
      case "granted":
        return location ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-500">
            <MapPin className="h-3.5 w-3.5" />
            <span>Location enabled</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-500">
            <MapPin className="h-3.5 w-3.5" />
            <span>Location unavailable</span>
          </div>
        )
      case "denied":
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>Location disabled</span>
          </div>
        )
      case "requesting":
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Getting location…</span>
          </div>
        )
      case "unavailable":
        return null
      default:
        // idle - will prompt on first post
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>Location will be requested</span>
          </div>
        )
    }
  }

  return (
    <>
      <div className="container max-w-2xl px-3 py-1.5">
        <h2 className="mb-4 text-2xl font-bold">Log a drink</h2>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}

        <section className="rounded-2xl border bg-background/50 p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Photo</h2>
            {file ? (
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setPreviewUrl(null)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            ) : null}
          </div>

          <div className="mt-3">
            {previewUrl ? (
              <div className="relative overflow-hidden rounded-xl border">
                <Image
                  src={previewUrl || "/placeholder.svg"}
                  alt="Drink preview"
                  width={900}
                  height={1200}
                  className="h-72 w-full object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-4 text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium">Add a photo</p>
                  <p className="mt-1 text-xs opacity-70">Choose from library, take a photo, or pick a file</p>
                </div>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </section>

        <section className="mt-4 rounded-2xl border bg-background/50 p-3">
          <h2 className="text-sm font-medium">Drink type</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {DRINK_TYPES.map((t) => {
              const selected = t === drinkType
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDrinkType(t)
                    setError(null)
                    setSuccess(null)
                  }}
                  className={[
                    "rounded-full border px-4 py-2 text-sm",
                    "active:scale-[0.99]",
                    selected ? "border-black bg-black text-white" : "bg-transparent hover:bg-bg/5",
                  ].join(" ")}
                  aria-pressed={selected}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border bg-background/50 p-3">
          <h2 className="text-sm font-medium">Caption (optional)</h2>
          <textarea
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value)
              setError(null)
              setSuccess(null)
            }}
            placeholder="Who are you with? What are you doing?"
            className="mt-3 h-24 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
            maxLength={200}
          />
          <div className="mt-2 text-right text-xs opacity-60">{caption.length}/200</div>
        </section>

        {/* Location status indicator */}
        <div className="mt-4 flex justify-end">{renderLocationStatus()}</div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canPost}
          className={[
            "mt-2 w-full rounded-2xl border p-3 text-sm font-medium",
            canPost ? "bg-black text-white" : "bg-black/20 text-white/70",
          ].join(" ")}
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Posting…
            </span>
          ) : (
            "Post"
          )}
        </button>
      </div>

      {/* Crop Modal (Instagram-ish: pan + zoom in a square frame) */}
      {cropOpen && rawUrl ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-base font-semibold">Crop</div>
              <button
                type="button"
                onClick={() => {
                  if (cropping) return
                  onCancelCrop()
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                aria-label="Close"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div
                ref={cropWrapRef}
                className="relative w-full overflow-hidden rounded-xl border"
                style={{ aspectRatio: "1 / 1" }}
              >
                <Cropper
                  image={rawUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropSize={cropSize ?? undefined}
                  objectFit="cover"
                  showGrid={true}
                  zoomWithScroll={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels as Area)}
                />
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (cropping) return
                    onCancelCrop()
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
                  disabled={cropping}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onConfirmCrop}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-black px-4 py-2.5 text-sm font-medium text-white"
                  disabled={cropping}
                >
                  {cropping ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}