"use client"

import * as React from "react"
import Image from "next/image"
import { Camera, Loader2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"

const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

export default function LogDrinkPage() {
  const supabase = createClient()
  const router = useRouter()

  const [drinkType, setDrinkType] = React.useState<DrinkType | null>(null)
  const [caption, setCaption] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canPost = Boolean(file && drinkType && !submitting)

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
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function onSubmit() {
    setError(null)
    setSuccess(null)

    if (!file) return setError("Please take or upload a photo.")
    if (!drinkType) return setError("Please select a drink type.")

    setSubmitting(true)
    try {
      // 1) Ensure signed in
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user
      if (!user) {
        router.replace("/login?redirectTo=%2Flog")
        return
      }

      // 2) Upload image to storage (private bucket: drink-photos)
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

      // 3) Insert row
      const nextCaption = caption.trim()
      const { error: insErr } = await supabase.from("drink_logs").insert({
        user_id: user.id,
        photo_path: photoPath,
        drink_type: drinkType,
        caption: nextCaption.length ? nextCaption : null,
      })
      if (insErr) throw insErr

      resetForm()

      // 4) Redirect to feed with a success flag
      router.replace("/feed?posted=1")
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
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

          {/* Single input -> iOS shows the native "Photo Library / Take Photo / Choose File" sheet */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              setError(null)
              setSuccess(null)
            }}
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
  )
}
