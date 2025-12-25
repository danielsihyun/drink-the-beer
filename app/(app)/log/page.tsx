"use client"

import * as React from "react"
import Image from "next/image"
import { Camera, Loader2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"

const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

function LogDrinkPage() {
  const supabase = createClient()

  const [drinkType, setDrinkType] = React.useState<DrinkType | null>(null)
  const [caption, setCaption] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

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
  }

  function getFileExt(f: File) {
    const fromName = f.name?.split(".").pop()?.toLowerCase()
    if (fromName && fromName.length <= 6) return fromName
    if (f.type === "image/png") return "png"
    if (f.type === "image/webp") return "webp"
    return "jpg"
  }

  async function onSubmit() {
    setError(null)
    setSuccess(null)

    if (!file) return setError("Please take or upload a photo.")
    if (!drinkType) return setError("Please select a drink type.")

    setSubmitting(true)
    try {
      // 1) Ensure user is authenticated
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user
      if (!user) {
        setError("You’re not logged in. Please log in and try again.")
        return
      }

      // 2) Upload photo to Supabase Storage (private bucket)
      const ext = getFileExt(file)
      const objectName = `${user.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage.from("drink-photos").upload(objectName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      })
      if (uploadErr) throw uploadErr

      // 3) Insert the log row into DB
      const { error: insertErr } = await supabase.from("drink_logs").insert({
        user_id: user.id,
        photo_path: objectName,
        drink_type: drinkType,
        caption: caption.trim() ? caption.trim() : null,
      })
      if (insertErr) throw insertErr

      setSuccess("Posted!")
      resetForm()
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container max-w-2xl px-4 py-6">
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
            <label className="flex h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border">
                <Camera className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium">Take a photo</p>
                <p className="mt-1 text-xs opacity-70">Or upload from your camera roll</p>
              </div>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  setError(null)
                  setSuccess(null)
                }}
              />
            </label>
          )}
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

export default LogDrinkPage
