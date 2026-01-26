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
  size?: "sm" | "md"
}) {
  const colors = DIFFICULTY_COLORS[achievement.difficulty]
  const sizeClasses = size === "sm" ? "h-8 w-8" : "h-10 w-10"
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5"

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

// Empty slot for adding a medal
function EmptyMedalSlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-foreground/20 text-foreground/30 hover:border-foreground/40 hover:text-foreground/50 transition-colors"
      title="Add a medal"
    >
      <Plus className="h-4 w-4" />
    </button>
  )
}

// Showcase display for profile card (3 medals max)
export function ProfileShowcase({
  showcaseIds,
  achievements,
  isEditing,
  onOpenPicker,
  layout = "vertical",
}: {
  showcaseIds: string[]
  achievements: Achievement[]
  isEditing: boolean
  onOpenPicker: () => void
  layout?: "horizontal" | "vertical"
}) {
  const showcaseAchievements = showcaseIds
    .map((id) => achievements.find((a) => a.id === id))
    .filter(Boolean) as Achievement[]

  // Always show 3 slots
  const slots = [0, 1, 2]

  if (!isEditing && showcaseAchievements.length === 0) {
    return null // Don't show anything if no medals and not editing
  }

  return (
    <div className={cn(
      "flex gap-1.5",
      layout === "vertical" ? "flex-col items-center" : "flex-row items-center"
    )}>
      {slots.map((index) => {
        const achievement = showcaseAchievements[index]
        
        if (achievement) {
          if (isEditing) {
            return (
              <button
                key={index}
                type="button"
                onClick={onOpenPicker}
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
          return <ShowcaseMedal key={index} achievement={achievement} size="sm" />
        }

        if (isEditing) {
          return (
            <button
              key={index}
              type="button"
              onClick={onOpenPicker}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-foreground/20 text-foreground/30 hover:border-foreground/40 hover:text-foreground/50 transition-colors"
              title="Add a medal"
            >
              <Plus className="h-3 w-3" />
            </button>
          )
        }

        return null
      })}
    </div>
  )
}

// Medal picker modal
export function MedalPickerModal({
  currentShowcase,
  allAchievements,
  unlockedIds,
  onSave,
  onClose,
}: {
  currentShowcase: string[]
  allAchievements: Achievement[]
  unlockedIds: Set<string>
  onSave: (ids: string[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = React.useState<string[]>(currentShowcase)

  const unlockedAchievements = allAchievements.filter((a) => unlockedIds.has(a.id))

  const toggleSelection = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id))
    } else if (selected.length < 3) {
      setSelected([...selected, id])
    }
  }

  const handleSave = () => {
    onSave(selected)
    onClose()
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
            <div className="text-base font-semibold">Showcase Medals</div>
            <div className="text-xs text-muted-foreground">Select up to 3 medals to display</div>
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

        {/* Selected medals preview */}
        <div className="px-4 py-3 border-b bg-foreground/5">
          <div className="text-xs text-muted-foreground mb-2">Selected ({selected.length}/3)</div>
          <div className="flex items-center gap-2 min-h-[40px]">
            {selected.length === 0 ? (
              <span className="text-sm text-muted-foreground">No medals selected</span>
            ) : (
              selected.map((id) => {
                const achievement = allAchievements.find((a) => a.id === id)
                if (!achievement) return null
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleSelection(id)}
                    className="relative group"
                    title="Click to remove"
                  >
                    <ShowcaseMedal achievement={achievement} />
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-4 w-4 text-white" />
                    </div>
                  </button>
                )
              })
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
                const isSelected = selected.includes(achievement.id)
                const colors = DIFFICULTY_COLORS[achievement.difficulty]
                const canSelect = isSelected || selected.length < 3

                return (
                  <button
                    key={achievement.id}
                    type="button"
                    onClick={() => canSelect && toggleSelection(achievement.id)}
                    disabled={!canSelect}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      isSelected ? "bg-foreground/10" : "hover:bg-foreground/5",
                      !canSelect && "opacity-50 cursor-not-allowed"
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