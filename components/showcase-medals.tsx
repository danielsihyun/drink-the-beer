"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Trophy, Medal, Star, Flame, Users, Sun, Moon, Clock, Calendar, Target, Heart, Award, Flag, Zap, Share, ThumbsUp, Sparkles, Lock, Plus, X, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Difficulty = "bronze" | "silver" | "gold" | "diamond"

type Achievement = {
  id: string
  category: string
  name: string
  description: string
  requirement_type: string
  requirement_value: string
  difficulty: Difficulty
  icon: string
}

type UserAchievement = {
  achievement_id: string
  unlocked_at: string
}

const DIFFICULTY_COLORS: Record<Difficulty, { bg: string; border: string; text: string }> = {
  bronze: {
    bg: "bg-amber-900/30",
    border: "border-amber-700/50",
    text: "text-amber-600",
  },
  silver: {
    bg: "bg-slate-300/30",
    border: "border-slate-400/50",
    text: "text-slate-400",
  },
  gold: {
    bg: "bg-yellow-500/30",
    border: "border-yellow-500/50",
    text: "text-yellow-500",
  },
  diamond: {
    bg: "bg-cyan-400/30",
    border: "border-cyan-400/50",
    text: "text-cyan-400",
  },
}

function getIconComponent(iconName: string, className?: string) {
  const icons: Record<string, React.ReactNode> = {
    trophy: <Trophy className={className} />,
    medal: <Medal className={className} />,
    star: <Star className={className} />,
    flame: <Flame className={className} />,
    users: <Users className={className} />,
    sun: <Sun className={className} />,
    moon: <Moon className={className} />,
    clock: <Clock className={className} />,
    calendar: <Calendar className={className} />,
    target: <Target className={className} />,
    heart: <Heart className={className} />,
    award: <Award className={className} />,
    flag: <Flag className={className} />,
    zap: <Zap className={className} />,
    share: <Share className={className} />,
    "thumbs-up": <ThumbsUp className={className} />,
    sparkles: <Sparkles className={className} />,
  }
  return icons[iconName] || <Trophy className={className} />
}

// Small medal display for the profile card
export function ShowcaseMedal({ 
  achievement, 
  size = "md" 
}: { 
  achievement: Achievement
  size?: "xs" | "sm" | "md"
}) {
  const colors = DIFFICULTY_COLORS[achievement.difficulty]
  const sizeClasses = size === "xs" ? "h-6 w-6" : size === "sm" ? "h-8 w-8" : "h-10 w-10"
  const iconSize = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-4 w-4" : "h-5 w-5"

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full border-2",
        sizeClasses,
        colors.bg,
        colors.border,
      )}
      title={`${achievement.name} (${achievement.difficulty})`}
    >
      <span className={colors.text}>
        {getIconComponent(achievement.icon, iconSize)}
      </span>
    </div>
  )
}

// Showcase display for profile card (3 medals max) - always clickable
export function ProfileShowcase({
  showcaseIds,
  achievements,
  onSelectSlot,
  layout = "horizontal",
  readOnly = false,
}: {
  showcaseIds: string[]
  achievements: Achievement[]
  onSelectSlot: (slotIndex: number) => void
  layout?: "horizontal" | "vertical"
  readOnly?: boolean
}) {
  // Map showcase IDs to achievements, preserving empty slots
  const showcaseAchievements = showcaseIds.map((id) => 
    id ? achievements.find((a) => a.id === id) || null : null
  )

  // Always show 3 slots
  const slots = [0, 1, 2]

  // In read-only mode, check if there are any medals to show
  const hasMedals = showcaseAchievements.some(a => a !== null)
  if (readOnly && !hasMedals) {
    return null
  }

  return (
    <div className={cn(
      "flex gap-1.5",
      layout === "vertical" ? "flex-col items-center" : "flex-row items-center"
    )}>
      {slots.map((index) => {
        const achievement = showcaseAchievements[index]
        
        if (achievement) {
          if (readOnly) {
            // Read-only mode: just display, no interaction
            return <ShowcaseMedal key={index} achievement={achievement} size="sm" />
          }
          
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectSlot(index)}
              className="relative group"
              title={`${achievement.name} - Click to change`}
            >
              <ShowcaseMedal achievement={achievement} size="sm" />
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-[10px]">Edit</span>
              </div>
            </button>
          )
        }

        // Empty slot - only show if not read-only
        if (readOnly) {
          return null
        }

        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelectSlot(index)}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-foreground/20 text-foreground/30 hover:border-foreground/40 hover:text-foreground/50 transition-colors"
            title="Add a medal"
          >
            <Plus className="h-3 w-3" />
          </button>
        )
      })}
    </div>
  )
}

// Single medal picker modal (for one slot at a time)
export function SingleMedalPickerModal({
  slotIndex,
  currentAchievementId,
  currentShowcaseIds,
  allAchievements,
  unlockedIds,
  onSave,
  onClose,
}: {
  slotIndex: number
  currentAchievementId: string | null
  currentShowcaseIds: string[]
  allAchievements: Achievement[]
  unlockedIds: Set<string>
  onSave: (slotIndex: number, achievementId: string | null) => void
  onClose: () => void
}) {
  const [selected, setSelected] = React.useState<string | null>(currentAchievementId)

  const unlockedAchievements = allAchievements.filter((a) => unlockedIds.has(a.id))
  
  // Get IDs that are already selected in OTHER slots
  const alreadySelectedInOtherSlots = new Set(
    currentShowcaseIds.filter((id, idx) => id && idx !== slotIndex)
  )

  const handleSave = () => {
    onSave(slotIndex, selected)
    onClose()
  }

  const toggleSelection = (achievementId: string) => {
    if (selected === achievementId) {
      // Clicking already selected item unselects it
      setSelected(null)
    } else {
      setSelected(achievementId)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-base font-semibold">Choose Medal</div>
            <div className="text-xs text-muted-foreground">Select an achievement for slot {slotIndex + 1}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Current selection preview */}
        <div className="px-4 py-3 border-b bg-foreground/5">
          <div className="text-xs text-muted-foreground mb-2">Selected</div>
          <div className="flex items-center gap-3 min-h-[40px]">
            {selected ? (
              (() => {
                const achievement = allAchievements.find((a) => a.id === selected)
                if (!achievement) return null
                const colors = DIFFICULTY_COLORS[achievement.difficulty]
                return (
                  <>
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2",
                        colors.bg,
                        colors.border
                      )}
                    >
                      <span className={colors.text}>
                        {getIconComponent(achievement.icon, "h-5 w-5")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{achievement.name}</span>
                      <p className="text-xs text-muted-foreground truncate">{achievement.description}</p>
                    </div>
                  </>
                )
              })()
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-foreground/20">
                  <Plus className="h-4 w-4 text-foreground/30" />
                </div>
                <span className="text-sm text-muted-foreground">Empty slot</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable list of unlocked achievements */}
        <div className="max-h-[50vh] overflow-y-auto">
          {unlockedAchievements.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No achievements unlocked yet. Keep drinking to earn medals!
            </div>
          ) : (
            <div className="divide-y">
              {unlockedAchievements.map((achievement) => {
                const isSelected = selected === achievement.id
                const isUsedInOtherSlot = alreadySelectedInOtherSlots.has(achievement.id)
                const colors = DIFFICULTY_COLORS[achievement.difficulty]

                return (
                  <button
                    key={achievement.id}
                    type="button"
                    onClick={() => !isUsedInOtherSlot && toggleSelection(achievement.id)}
                    disabled={isUsedInOtherSlot}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      isUsedInOtherSlot 
                        ? "opacity-50 cursor-not-allowed" 
                        : isSelected 
                          ? "bg-foreground/10" 
                          : "hover:bg-foreground/5"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2",
                        colors.bg,
                        colors.border
                      )}
                    >
                      <span className={colors.text}>
                        {getIconComponent(achievement.icon, "h-5 w-5")}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{achievement.name}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                            colors.bg,
                            colors.text
                          )}
                        >
                          {achievement.difficulty}
                        </span>
                        {isUsedInOtherSlot && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            Already selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{achievement.description}</p>
                    </div>

                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0",
                        isSelected ? "border-green-500 bg-green-500" : "border-foreground/20"
                      )}
                    >
                      {isSelected && <Check className="h-4 w-4 text-white" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}