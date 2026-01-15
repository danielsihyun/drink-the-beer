"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface BeerLikeButtonProps {
  initialLiked?: boolean
  onLike?: (liked: boolean) => void
  className?: string
}

export function BeerLikeButton({ initialLiked = false, onLike, className }: BeerLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [isAnimating, setIsAnimating] = useState(false)

  const handleClick = () => {
    setIsAnimating(true)
    setLiked(!liked)
    onLike?.(!liked)
    setTimeout(() => setIsAnimating(false), 300)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative p-2 transition-transform duration-200 hover:scale-110 active:scale-95 focus:outline-none",
        isAnimating && "animate-bounce-once",
        className,
      )}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <svg
        viewBox="0 0 24 24"
        className={cn(
          "h-8 w-8 transition-all duration-300",
          liked ? "fill-amber-500 stroke-amber-600" : "fill-transparent stroke-foreground",
        )}
        strokeWidth={1.5}
      >
        {/* Beer mug body */}
        <path d="M5 6h10v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6z" className="transition-all duration-300" />
        {/* Handle */}
        <path d="M15 8h2a2 2 0 012 2v2a2 2 0 01-2 2h-2" fill="transparent" className="transition-all duration-300" />
        {/* Foam top */}
        <path
          d="M4 6c0-1 .5-2 2-2h1c.5-1 1.5-1.5 2.5-1.5S12 3 12.5 4h1c1.5 0 2 1 2 2H4z"
          className={cn("transition-all duration-300", liked ? "fill-amber-100 stroke-amber-300" : "fill-transparent")}
        />
        {/* Bubbles (visible when liked) */}
        {liked && (
          <>
            <circle cx="7" cy="12" r="0.5" className="fill-amber-200 animate-pulse" />
            <circle
              cx="10"
              cy="10"
              r="0.5"
              className="fill-amber-200 animate-pulse"
              style={{ animationDelay: "0.1s" }}
            />
            <circle
              cx="12"
              cy="14"
              r="0.5"
              className="fill-amber-200 animate-pulse"
              style={{ animationDelay: "0.2s" }}
            />
          </>
        )}
      </svg>

      {/* Burst effect on like */}
      {isAnimating && liked && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="absolute h-12 w-12 animate-ping rounded-full bg-amber-400/30" />
        </span>
      )}
    </button>
  )
}
