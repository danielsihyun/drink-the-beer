"use client"

import * as React from "react"
import Image from "next/image"
import Cropper from "react-easy-crop"
import { Camera, Check, ChevronDown, Loader2, X } from "lucide-react"
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
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const [caption, setCaption] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Crop UI state
  const [cropOpen, setCropOpen] = React.useState(false)
  const [rawFile, setRawFile] = React.useState<File | null>(null)
  const [rawUrl, setRawUrl] = React.useState<string | null>(null)
  const [crop, setCrop] = React.useState({ x: 0, y: 0 })
  const [zoom, setZoom] = React.useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null)
  const [cropping, setCropping] = React.useState(false)
  const [cropObjectFit, setCropObjectFit] = React.useState<"horizontal-cover" | "vertical-cover">("horizontal-cover")

  // Geolocation state
  const [location, setLocation] = React.useState<{ latitude: number; longitude: number } | null>(null)
  const [locationStatus, setLocationStatus] = React.useState<LocationStatus>("idle")

  const canPost = Boolean(file && drinkType && !submitting)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // ==========================================================================
  // GEOLOCATION HANDLING
  // ==========================================================================

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
          console.log("Geolocation error:", err.code, err.message)
          if (err.code === 1) {
            setLocationStatus("denied")
          } else {
            setLocationStatus("granted")
          }
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        }
      )
    })
  }, [])

  React.useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable")
      return
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((permissionStatus) => {
          if (permissionStatus.state === "granted") {
            getLocation()
          } else if (permissionStatus.state === "denied") {
            setLocationStatus("denied")
          } else {
            setLocationStatus("idle")
          }

          permissionStatus.addEventListener("change", () => {
            if (permissionStatus.state === "granted") {
              getLocation()
            } else if (permissionStatus.state === "denied") {
              setLocationStatus("denied")
              setLocation(null)
            }
          })
        })
        .catch(() => {
          setLocationStatus("idle")
        })
    } else {
      setLocationStatus("idle")
    }
  }, [getLocation])

  React.useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

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

      let finalLocation = location
      if (!finalLocation && locationStatus === "idle") {
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

    const url = URL.createObjectURL(f)
    const img = new window.Image()
    img.onload = () => {
      const aspect = img.width / img.height
      setCropObjectFit(aspect < 1 ? "vertical-cover" : "horizontal-cover")
      setRawFile(f)
      setRawUrl(url)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setCropOpen(true)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError("Could not load image.")
    }
    img.src = url
  }

  async function onConfirmCrop() {
    if (!rawUrl || !croppedAreaPixels) return

    setCropping(true)
    try {
      const outputMime = rawFile?.type === "image/png" ? "image/png" : "image/jpeg"
      const cropped = await getCroppedFile(rawUrl, croppedAreaPixels, outputMime)
      setFile(cropped)
      URL.revokeObjectURL(rawUrl)
      setRawUrl(null)
      setRawFile(null)
      setCropOpen(false)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not crop image."
      setError(message)
      if (rawUrl) URL.revokeObjectURL(rawUrl)
      setCropOpen(false)
      setRawFile(null)
      setRawUrl(null)
    } finally {
      setCropping(false)
    }
  }

  function onCancelCrop() {
    if (rawUrl) URL.revokeObjectURL(rawUrl)
    setCropOpen(false)
    setRawFile(null)
    setRawUrl(null)
    setCroppedAreaPixels(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    if (fileInputRef.current) fileInputRef.current.value = ""
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

        <div className="relative">
          {previewUrl ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-background/50">
              <Image
                src={previewUrl}
                alt="Drink preview"
                fill
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setPreviewUrl(null)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
                aria-label="Clear photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-background/50 text-center transition-colors hover:border-black/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border">
                <Camera className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium">Add a photo</p>
                <p className="mt-1 text-xs opacity-70">Tap to take or choose a photo</p>
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

        <div className="relative mt-4" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(!dropdownOpen)
              setError(null)
              setSuccess(null)
            }}
            className={[
              "flex w-full items-center justify-between rounded-2xl border bg-background/50 px-4 py-4 text-sm transition-all",
              "hover:border-black/30 focus:outline-none focus:ring-2 focus:ring-black/20",
              dropdownOpen ? "border-black/30 ring-2 ring-black/20" : "",
              drinkType ? "text-foreground" : "text-muted-foreground",
            ].join(" ")}
          >
            <span>{drinkType || "Select drink type"}</span>
            <ChevronDown
              className={[
                "h-4 w-4 transition-transform duration-200",
                dropdownOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-background shadow-lg">
              {DRINK_TYPES.map((t, index) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDrinkType(t)
                    setDropdownOpen(false)
                    setError(null)
                    setSuccess(null)
                  }}
                  className={[
                    "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors",
                    "hover:bg-black/5 active:bg-black/10",
                    t === drinkType ? "bg-black/5 font-medium" : "",
                    index !== DRINK_TYPES.length - 1 ? "border-b border-black/5" : "",
                  ].join(" ")}
                >
                  <span>{t}</span>
                  {t === drinkType && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative mt-4">
          <textarea
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value)
              setError(null)
              setSuccess(null)
            }}
            placeholder="Add a caption (optional)"
            className="h-28 w-full resize-none rounded-2xl border bg-background/50 px-4 py-4 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/20"
            maxLength={200}
          />
          <div className="absolute bottom-4 right-4 text-xs opacity-60">{caption.length}/200</div>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canPost}
          className={[
            "mt-4 w-full rounded-2xl border p-3 text-sm font-medium",
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

      {/* Crop Modal - Instagram-style: pan + zoom with dynamic sizing */}
      {cropOpen && rawUrl ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-[344px] overflow-hidden rounded-2xl bg-background shadow-2xl">
            <div className="relative overflow-hidden">
              <div
                className="relative w-[143%] -ml-[21.5%] -mt-[21.5%] -mb-[21.5%] [&_.reactEasyCrop_CropArea]:!border-0"
                style={{ aspectRatio: "1 / 1" }}
              >
                <Cropper
                  key={`${rawUrl}-${cropObjectFit}`}
                  image={rawUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  objectFit={cropObjectFit}
                  showGrid={true}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels as Area)}
                />
                <div className="pointer-events-none absolute left-0 right-0 top-0 h-[15%] bg-background" />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[15%] bg-background" />
                <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-[15%] bg-background" />
                <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[15%] bg-background" />
              </div>

              <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    if (cropping) return
                    onCancelCrop()
                  }}
                  disabled={cropping}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                  aria-label="Cancel"
                  title="Cancel"
                >
                  <X className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onConfirmCrop}
                  disabled={cropping}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                  aria-label="Done"
                  title="Done"
                >
                  {cropping ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Check className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}