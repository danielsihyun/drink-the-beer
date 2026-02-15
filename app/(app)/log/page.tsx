"use client"

import * as React from "react"
import Image from "next/image"
import Cropper from "react-easy-crop"
import { Camera, Check, ChevronDown, Loader2, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAchievements } from "@/contexts/achievement-context"
import { cn } from "@/lib/utils"

/* ── Types ─────────────────────────────────────────────────────── */

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"
const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

type DrinkResult = {
  id: string
  name: string
  category: string
  image_url: string | null
  glass: string | null
  ingredients: { name: string; measure: string }[]
}

type Area = { width: number; height: number; x: number; y: number }

/* ── Category emoji helper ─────────────────────────────────────── */

const CATEGORY_EMOJI: Record<string, string> = {
  Beer: "🍺",
  Wine: "🍷",
  Cocktail: "🍸",
  Shot: "🥃",
  Seltzer: "🥤",
  Spirit: "🥃",
  Other: "🍹",
}

/* ── Image crop helpers ────────────────────────────────────────── */

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

/* ── Drink Search Picker ───────────────────────────────────────── */

function DrinkPicker({
  selectedDrink,
  selectedDrinkType,
  onSelect,
  onClear,
  disabled,
}: {
  selectedDrink: DrinkResult | null
  selectedDrinkType: DrinkType | null
  onSelect: (drink: DrinkResult, drinkType: DrinkType) => void
  onClear: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<DrinkResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [customName, setCustomName] = React.useState("")
  const [customCategory, setCustomCategory] = React.useState<DrinkType>("Other")
  const [showCustom, setShowCustom] = React.useState(false)
  const [creating, setCreating] = React.useState(false)

  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setShowCustom(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Search with debounce
  React.useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      setResults([])
      return
    }

    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/drinks/search?q=${encodeURIComponent(q)}&limit=8`)
        const json = await res.json()
        setResults(json?.items ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 200)

    return () => clearTimeout(t)
  }, [query])

  function handleSelect(drink: DrinkResult) {
    const drinkType = (DRINK_TYPES.includes(drink.category as DrinkType)
      ? drink.category
      : "Other") as DrinkType
    onSelect(drink, drinkType)
    setOpen(false)
    setQuery("")
    setResults([])
    setShowCustom(false)
  }

  async function handleCreateCustom() {
    if (!customName.trim()) return
    setCreating(true)
    try {
      const supabase = createClient()
      const { data: userRes } = await supabase.auth.getUser()
      const userId = userRes.user?.id

      const { data, error } = await supabase
        .from("drinks")
        .insert({
          name: customName.trim(),
          category: customCategory,
          source: "user",
          created_by: userId ?? null,
        })
        .select("id, name, category, image_url, glass, ingredients")
        .single()

      if (error) throw error

      handleSelect(data as DrinkResult)
      setCustomName("")
      setShowCustom(false)
    } catch (e) {
      console.error("Failed to create drink:", e)
    } finally {
      setCreating(false)
    }
  }

  // If a drink is selected, show it as a pill
  if (selectedDrink) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 dark:border-white/[0.1] bg-white/50 dark:bg-white/[0.06] backdrop-blur-sm px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100/80 dark:bg-white/[0.06] text-lg">
          {selectedDrink.image_url ? (
            <div className="relative h-10 w-10 overflow-hidden rounded-xl">
              <Image src={selectedDrink.image_url} alt="" fill className="object-cover" unoptimized />
            </div>
          ) : (
            CATEGORY_EMOJI[selectedDrink.category] ?? "🍹"
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-neutral-900 dark:text-white truncate">{selectedDrink.name}</div>
          <div className="text-[12px] text-neutral-500 dark:text-white/40">{selectedDrink.category}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!disabled) onClear()
          }}
          disabled={disabled}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] text-neutral-500 dark:text-white/40 transition-colors hover:bg-neutral-200 dark:hover:bg-white/[0.12]"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Search input */}
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setOpen(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }
        }}
        disabled={disabled}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border border-neutral-200 dark:border-white/[0.1] bg-white/50 dark:bg-white/[0.06] backdrop-blur-sm px-4 py-4 text-sm transition-all",
          "hover:border-black/30 dark:hover:border-white/20 focus:outline-none",
          open ? "border-black/30 dark:border-white/20 ring-2 ring-black/5 dark:ring-white/10 bg-white dark:bg-white/[0.08]" : "",
          disabled ? "opacity-50 cursor-not-allowed" : ""
        )}
      >
        <Search className="h-4 w-4 text-neutral-400 dark:text-white/30 shrink-0" />
        <span className="text-neutral-400 dark:text-white/30">Search for a drink…</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
          {/* Search field inside dropdown */}
          <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-white/[0.06] px-4 py-3">
            <Search className="h-4 w-4 text-neutral-400 dark:text-white/25 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowCustom(false)
              }}
              placeholder="Type a drink name…"
              className="w-full bg-transparent text-sm text-neutral-900 dark:text-white placeholder:text-neutral-300 dark:placeholder:text-white/20 outline-none"
              autoComplete="off"
            />
            {searching && <Loader2 className="h-4 w-4 animate-spin text-neutral-400 dark:text-white/30 shrink-0" />}
          </div>

          {/* Results */}
          <div className="max-h-[280px] overflow-y-auto">
            {query.trim().length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-neutral-400 dark:text-white/30">
                Start typing to search drinks
              </div>
            ) : showCustom ? (
              /* Custom drink creation form */
              <div className="p-3 space-y-3 py-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 dark:text-white/40 mb-1.5">Drink name</label>
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 dark:border-white/[0.1] bg-neutral-50 dark:bg-white/[0.04] px-3 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-black/20 dark:focus:border-white/20"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 dark:text-white/40 mb-1.5">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DRINK_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCustomCategory(t)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                          t === customCategory
                            ? "bg-black dark:bg-white text-white dark:text-black"
                            : "bg-neutral-100 dark:bg-white/[0.06] text-neutral-600 dark:text-white/50 hover:bg-neutral-200 dark:hover:bg-white/[0.1]"
                        )}
                      >
                        {CATEGORY_EMOJI[t]} {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustom(false)
                      setCustomName("")
                    }}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium bg-neutral-100 dark:bg-white/[0.06] text-neutral-600 dark:text-white/50 transition-all active:scale-[0.98]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCustom}
                    disabled={creating || !customName.trim()}
                    className={cn(
                      "flex-1 rounded-xl py-2.5 text-sm font-medium transition-all active:scale-[0.98]",
                      customName.trim()
                        ? "bg-black dark:bg-white text-white dark:text-black"
                        : "bg-neutral-100 dark:bg-white/[0.06] text-neutral-400 dark:text-white/30"
                    )}
                  >
                    {creating ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Adding…
                      </span>
                    ) : (
                      "Add drink"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Search results + add custom row at bottom */
              <div className="p-1.5">
                {searching && results.length === 0 ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-400 dark:text-white/30" />
                  </div>
                ) : (
                  <>
                    {results.length === 0 && (
                      <div className="px-3 py-3 text-center text-sm text-neutral-400 dark:text-white/30">
                        No matches for "{query}"
                      </div>
                    )}

                    {results.map((drink) => (
                      <button
                        key={drink.id}
                        type="button"
                        onClick={() => handleSelect(drink)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/[0.1]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100/80 dark:bg-white/[0.06] text-base overflow-hidden">
                          {drink.image_url ? (
                            <Image src={drink.image_url} alt="" width={36} height={36} className="object-cover rounded-lg" unoptimized />
                          ) : (
                            CATEGORY_EMOJI[drink.category] ?? "🍹"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">{drink.name}</div>
                          <div className="text-xs text-neutral-500 dark:text-white/35">{drink.category}</div>
                        </div>
                      </button>
                    ))}

                    {/* Single "add custom" option at the bottom */}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomName(query.trim())
                        setShowCustom(true)
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/[0.06]",
                        results.length > 0 ? "border-t border-neutral-100 dark:border-white/[0.04] mt-1 pt-3" : ""
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100/80 dark:bg-white/[0.06] text-neutral-400 dark:text-white/30">
                        <span className="text-lg">+</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-neutral-600 dark:text-white/60">Don't see it? Add "{query.trim()}"</div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────────── */

export default function LogDrinkPage() {
  const supabase = createClient()
  const router = useRouter()
  const { checkAchievements } = useAchievements()

  const [selectedDrink, setSelectedDrink] = React.useState<DrinkResult | null>(null)
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
  const [cropObjectFit, setCropObjectFit] = React.useState<"horizontal-cover" | "vertical-cover">("horizontal-cover")

  const canPost = Boolean(file && selectedDrink && drinkType && !submitting)

  React.useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function resetForm() {
    setSelectedDrink(null)
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
    if (!selectedDrink || !drinkType) return setError("Please select a drink.")

    setSubmitting(true)
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user
      if (!user) {
        router.replace("/login?redirectTo=%2Flog")
        return
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

      const { error: insErr } = await supabase.from("drink_logs").insert({
        user_id: user.id,
        photo_path: photoPath,
        drink_type: drinkType,
        drink_id: selectedDrink.id,
        caption: nextCaption.length ? nextCaption : null,
      })
      if (insErr) throw insErr

      await checkAchievements()
      resetForm()
      router.replace("/feed?posted=1")
    } catch (e: unknown) {
      console.error("Submit error:", e)
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

        {/* Photo */}
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

        {/* Drink Picker */}
        <div className="mt-4">
          <DrinkPicker
            selectedDrink={selectedDrink}
            selectedDrinkType={drinkType}
            onSelect={(drink, type) => {
              setSelectedDrink(drink)
              setDrinkType(type)
              setError(null)
            }}
            onClear={() => {
              setSelectedDrink(null)
              setDrinkType(null)
            }}
            disabled={submitting}
          />
        </div>

        {/* Caption */}
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

        {/* Submit */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canPost}
          className={cn(
            "mt-4 w-full rounded-2xl border p-3 text-sm font-medium transition-all active:scale-[0.99]",
            canPost ? "bg-black text-white" : "bg-black/20 text-white/70"
          )}
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

      {/* Crop Modal */}
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
                  onClick={() => { if (!cropping) onCancelCrop() }}
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