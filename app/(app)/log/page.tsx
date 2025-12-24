"use client"

import * as React from "react"
import Image from "next/image"
import { Camera, Loader2, X } from "lucide-react"

type DrinkType = "Beer" | "Seltzer" | "Wine" | "Cocktail" | "Shot" | "Spirit" | "Other"

const DRINK_TYPES: DrinkType[] = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

function LogDrinkPage() {
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

  async function onSubmit() {
    setError(null)
    setSuccess(null)

    if (!file) return setError("Please take or upload a photo.")
    if (!drinkType) return setError("Please select a drink type.")

    setSubmitting(true)
    try {
      await new Promise((r) => setTimeout(r, 900))
      setSuccess("Posted! (mock)")
      resetForm()
    } catch {
      setError("Something went wrong. Please try again.")
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

      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-50">
        <div className="container mx-auto max-w-2xl px-36">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canPost}
            className={[
              "w-full rounded-2xl px-2 py-3 text-sm font-medium shadow-sm",
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
          <p className="mt-2 text-center text-xs opacity-60">
            Photos are private by default; friends can see them once connected.
          </p>
        </div>
      </div>
    </div>
  )
}

export default LogDrinkPage
