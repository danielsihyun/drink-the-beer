"use client"

import * as React from "react"
import { X, Loader2 } from "lucide-react"

/* ── Types ─────────────────────────────────────────────────────── */
type Phase = "back" | "switching" | "front" | "compositing"

type BeRealCaptureProps = {
  open: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

/* ── Canvas rounded-rect helper ────────────────────────────────── */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/* ── Component ─────────────────────────────────────────────────── */
export function BeRealCapture({ open, onClose, onCapture }: BeRealCaptureProps) {
  const [phase, setPhase] = React.useState<Phase>("back")
  const [backDataUrl, setBackDataUrl] = React.useState<string | null>(null)
  const [flash, setFlash] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const backCanvasRef = React.useRef<HTMLCanvasElement | null>(null)

  /* ── Camera helpers ──────────────────────────────────────────── */
  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  async function startCamera(facing: "environment" | "user") {
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1080 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      // If back camera fails, fall back to any available camera
      if (facing === "environment") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1080 }, height: { ideal: 1080 } },
            audio: false,
          })
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
          }
        } catch {
          setError("Could not access camera. Check permissions.")
        }
      } else {
        setError("Could not access front camera.")
      }
    }
  }

  /** Grab a square center-crop from the live video feed */
  function captureSquareFrame(mirror = false): HTMLCanvasElement | null {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null

    const vw = video.videoWidth
    const vh = video.videoHeight
    const size = Math.min(vw, vh)

    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    if (mirror) {
      ctx.translate(size, 0)
      ctx.scale(-1, 1)
    }

    const sx = (vw - size) / 2
    const sy = (vh - size) / 2
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size)
    return canvas
  }

  /* ── Lifecycle ───────────────────────────────────────────────── */
  React.useEffect(() => {
    if (open) {
      setPhase("back")
      setBackDataUrl(null)
      setFlash(false)
      setError(null)
      startCamera("environment")
    }
    return () => stopStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* ── Capture handlers ────────────────────────────────────────── */
  async function onCaptureBack() {
    const canvas = captureSquareFrame(false)
    if (!canvas) return

    backCanvasRef.current = canvas
    setBackDataUrl(canvas.toDataURL("image/jpeg", 0.85))

    // White flash
    setFlash(true)
    setTimeout(() => setFlash(false), 120)

    // Switch to front camera
    setPhase("switching")
    await startCamera("user")
    setPhase("front")
  }

  async function onCaptureFront() {
    const backCanvas = backCanvasRef.current
    if (!backCanvas) return

    // Flash
    setFlash(true)
    setTimeout(() => setFlash(false), 120)

    const frontCanvas = captureSquareFrame(true) // mirror for selfie
    if (!frontCanvas) return

    setPhase("compositing")
    stopStream()

    // ── Composite both frames ──────────────────────────────────
    const outputSize = 1080
    const output = document.createElement("canvas")
    output.width = outputSize
    output.height = outputSize
    const ctx = output.getContext("2d")!

    // Back frame — full bleed
    ctx.drawImage(backCanvas, 0, 0, outputSize, outputSize)

    // Front frame — rounded inset (top-left, BeReal style)
    const insetSize = Math.round(outputSize * 0.3)
    const margin = Math.round(outputSize * 0.035)
    const border = Math.round(outputSize * 0.005)
    const radius = Math.round(insetSize * 0.17)
    const ix = margin
    const iy = margin

    // Shadow behind inset
    ctx.shadowColor = "rgba(0,0,0,0.45)"
    ctx.shadowBlur = 16
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 4
    roundRectPath(ctx, ix, iy, insetSize, insetSize, radius)
    ctx.fill()
    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Dark border ring
    ctx.fillStyle = "rgba(0,0,0,0.55)"
    roundRectPath(
      ctx,
      ix - border,
      iy - border,
      insetSize + border * 2,
      insetSize + border * 2,
      radius + border
    )
    ctx.fill()

    // Clipped front frame
    ctx.save()
    roundRectPath(ctx, ix, iy, insetSize, insetSize, radius)
    ctx.clip()
    ctx.drawImage(frontCanvas, 0, 0, insetSize, insetSize)
    ctx.restore()

    // Export as file
    output.toBlob(
      (blob) => {
        if (!blob) {
          setError("Failed to create image.")
          setPhase("front")
          return
        }
        const file = new File([blob], `bereal-${Date.now()}.jpg`, {
          type: "image/jpeg",
        })
        onCapture(file)
      },
      "image/jpeg",
      0.92
    )
  }

  function handleClose() {
    stopStream()
    onClose()
  }

  /* ── Render ──────────────────────────────────────────────────── */
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black">
      {/* Flash overlay */}
      {flash && (
        <div className="pointer-events-none absolute inset-0 z-50 bg-white/90 transition-opacity duration-100" />
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={handleClose}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-white/10"
          aria-label="Close"
        >
          <X className="h-6 w-6 text-white" />
        </button>

        <span className="text-sm font-semibold text-white">
          {phase === "back" && "Back camera"}
          {phase === "switching" && "Switching…"}
          {phase === "front" && "Now you!"}
          {phase === "compositing" && "Saving…"}
        </span>

        <div className="w-10" />
      </div>

      {error && (
        <div className="px-6 pb-2 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Viewfinder ──────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div
          className="relative w-full max-w-[400px] overflow-hidden rounded-3xl bg-neutral-900"
          style={{ aspectRatio: "1" }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={[
              "absolute inset-0 h-full w-full object-cover",
              phase === "front" ? "-scale-x-100" : "",
            ].join(" ")}
          />

          {/* PiP preview of back frame while taking selfie */}
          {(phase === "front" || phase === "compositing") && backDataUrl && (
            <div
              className="absolute left-3 top-3 overflow-hidden rounded-2xl shadow-lg"
              style={{
                width: "28%",
                aspectRatio: "1",
                border: "2.5px solid rgba(0,0,0,0.55)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={backDataUrl}
                alt="Back camera"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Loading overlays */}
          {(phase === "switching" || phase === "compositing") && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
      </div>

      {/* ── Capture button ──────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center gap-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
        {(phase === "back" || phase === "front") && (
          <>
            <button
              type="button"
              onClick={phase === "back" ? onCaptureBack : onCaptureFront}
              className="group flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3.5px] border-white transition-transform active:scale-90"
              aria-label={phase === "back" ? "Capture back photo" : "Capture selfie"}
            >
              <div className="h-[62px] w-[62px] rounded-full bg-white transition-transform group-active:scale-95" />
            </button>
            <p className="text-xs text-white/50">
              {phase === "back"
                ? "Snap your drink, then take a selfie"
                : "Tap to take your selfie"}
            </p>
          </>
        )}
      </div>
    </div>
  )
}