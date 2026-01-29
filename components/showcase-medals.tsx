"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Trophy, Medal, Star, Flame, Users, Sun, Moon, Clock, Calendar, Target, Heart, Award, Flag, Zap, Share, ThumbsUp, Sparkles, Plus, X, Check } from "lucide-react"

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

const DIFFICULTY_COLORS: Record<Difficulty, { bg: string; border: string; text: string }> = {
  bronze: {
    bg: "bg-amber-900/30",
    border: "border-amber-700/50",
    text: "text-amber-600",
  },
  silver: {
    bg: "bg-slate-400/30",
    border: "border-slate-500/70",
    text: "text-slate-500",
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

// Modal to show medal details (for read-only viewing)
export function MedalDetailModal({
  achievement,
  unlockedAt,
  onClose,
}: {
  achievement: Achievement
  unlockedAt?: string | null
  onClose: () => void
}) {
  const colors = DIFFICULTY_COLORS[achievement.difficulty]
  
  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat(undefined, { 
      month: "long", 
      day: "numeric",
      year: "numeric" 
    }).format(d)
  }

  const formattedDate = formatDate(unlockedAt)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="container max-w-2xl px-3">
        <div className="relative w-full overflow-hidden rounded-2xl border bg-background shadow-2xl">
        {/* X button in top right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10 z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center px-6 py-6">
          {/* Medal icon */}
          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full border-4",
              colors.bg,
              colors.border
            )}
          >
            <span className={colors.text}>
              {getIconComponent(achievement.icon, "h-10 w-10")}
            </span>
          </div>

          {/* Title with difficulty badge inline */}
          <div className="mt-4 flex items-center gap-2">
            <h3 className="text-lg font-bold">{achievement.name}</h3>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                colors.bg,
                colors.text
              )}
            >
              {achievement.difficulty}
            </span>
          </div>

          {/* Description */}
          <p className="mt-2 text-sm text-center text-muted-foreground">
            {achievement.description}
          </p>

          {/* Date acquired */}
          {formattedDate && (
            <p className="mt-3 text-xs text-center opacity-60">
              Earned on {formattedDate}
            </p>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

// Showcase display for profile card (2 medals max) - always clickable, draggable
export function ProfileShowcase({
  showcaseIds,
  achievements,
  onSelectSlot,
  onReorder,
  onMedalClick,
  layout = "horizontal",
  readOnly = false,
}: {
  showcaseIds: string[]
  achievements: Achievement[]
  onSelectSlot: (slotIndex: number) => void
  onReorder?: (newOrder: string[]) => void
  onMedalClick?: (achievement: Achievement) => void
  layout?: "horizontal" | "vertical"
  readOnly?: boolean
}) {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null)

  // Get the actual achievements (filter out empty strings), limit to 2
  const filledIds = showcaseIds.filter(id => id && id !== "").slice(0, 2)
  
  // Map to achievements
  const filledAchievements = filledIds
    .map(id => achievements.find(a => a.id === id))
    .filter(Boolean) as Achievement[]

  // Build display array: empty slots on left, medals on right
  const emptySlotCount = Math.max(0, 2 - filledAchievements.length)
  const displaySlots: (Achievement | null)[] = [
    ...Array(emptySlotCount).fill(null),
    ...filledAchievements
  ]

  // In read-only mode, check if there are any medals to show
  if (readOnly && filledAchievements.length === 0) {
    return null
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (readOnly || !displaySlots[index]) return
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (readOnly || draggedIndex === null) return
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (readOnly || draggedIndex === null || !onReorder) return

    // Only allow dropping on filled slots for reordering
    if (displaySlots[dropIndex] === null || displaySlots[draggedIndex] === null) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    // Calculate the actual indices in filledIds array
    const draggedFilledIndex = draggedIndex - emptySlotCount
    const dropFilledIndex = dropIndex - emptySlotCount

    if (draggedFilledIndex >= 0 && dropFilledIndex >= 0 && draggedFilledIndex !== dropFilledIndex) {
      const newOrder = [...filledIds]
      const [removed] = newOrder.splice(draggedFilledIndex, 1)
      newOrder.splice(dropFilledIndex, 0, removed)
      onReorder(newOrder)
    }

    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Map display index to actual slot index for the picker
  const getSlotIndex = (displayIndex: number): number => {
    // Slot index is based on filled position from right
    // If clicking empty slot, it's always adding to the leftmost empty position
    if (displaySlots[displayIndex] === null) {
      return filledAchievements.length // Next available slot
    }
    // For filled slots, calculate position in filledIds
    return displayIndex - emptySlotCount
  }

  return (
    <div className={cn(
      "flex gap-1.5",
      layout === "vertical" ? "flex-col items-center" : "flex-row items-center"
    )}>
      {displaySlots.map((achievement, index) => {
        const isDragging = draggedIndex === index
        const isDragOver = dragOverIndex === index && draggedIndex !== index
        
        if (achievement) {
          if (readOnly) {
            return (
              <button
                key={`${achievement.id}-${index}`}
                type="button"
                onClick={() => onMedalClick?.(achievement)}
                className="transition-transform hover:scale-110 active:scale-95"
                title={achievement.name}
              >
                <ShowcaseMedal achievement={achievement} size="sm" />
              </button>
            )
          }
          
          return (
            <button
              key={`${achievement.id}-${index}`}
              type="button"
              onClick={() => onSelectSlot(getSlotIndex(index))}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative group cursor-grab active:cursor-grabbing",
                isDragging && "opacity-50",
                isDragOver && "ring-2 ring-foreground/50 rounded-full"
              )}
              title={`${achievement.name} - Click to change, drag to reorder`}
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
            key={`empty-${index}`}
            type="button"
            onClick={() => onSelectSlot(getSlotIndex(index))}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-foreground/20 text-foreground/30 hover:border-foreground/40 hover:text-foreground/50 transition-colors",
              isDragOver && "border-foreground/50 bg-foreground/5"
            )}
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
  currentShowcaseIds: string[]  // Already filtered, no empty strings
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

  // Filter out the currently selected achievement from the list
  const availableAchievements = unlockedAchievements.filter(a => a.id !== selected)

  const handleSave = () => {
    onSave(slotIndex, selected)
    onClose()
  }

  const toggleSelection = (achievementId: string) => {
    if (selected === achievementId) {
      setSelected(null)
    } else {
      setSelected(achievementId)
    }
  }

  const selectedAchievement = selected ? allAchievements.find(a => a.id === selected) : null

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
            <div className="text-xs text-muted-foreground">
              {slotIndex < currentShowcaseIds.length 
                ? `Change medal in slot ${slotIndex + 1}`
                : "Add a new medal"
              }
            </div>
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
          <div className="min-h-[56px]">
            {selectedAchievement ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex w-full items-center gap-3 rounded-lg p-2 -m-2 text-left hover:bg-foreground/5 transition-colors"
              >
                {(() => {
                  const colors = DIFFICULTY_COLORS[selectedAchievement.difficulty]
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
                          {getIconComponent(selectedAchievement.icon, "h-5 w-5")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{selectedAchievement.name}</span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                              colors.bg,
                              colors.text
                            )}
                          >
                            {selectedAchievement.difficulty}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{selectedAchievement.description}</p>
                      </div>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0 border-green-500 bg-green-500">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    </>
                  )
                })()}
              </button>
            ) : (
              <div className="flex items-center gap-3 p-2 -m-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-foreground/20">
                  <Plus className="h-4 w-4 text-foreground/30" />
                </div>
                <span className="text-sm text-muted-foreground">Tap an achievement below to select</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable list of unlocked achievements */}
        <div className="max-h-[50vh] overflow-y-auto">
          {availableAchievements.length === 0 && !selectedAchievement ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No achievements unlocked yet. Keep drinking to earn medals!
            </div>
          ) : availableAchievements.length === 0 && selectedAchievement ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No other achievements available
            </div>
          ) : (
            <div className="divide-y">
              {availableAchievements.map((achievement) => {
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

                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0 border-foreground/20" />
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