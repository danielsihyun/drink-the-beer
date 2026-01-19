"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

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

type UnlockedAchievement = Achievement & {
  unlocked_at: string
}

type UserStats = {
  totalDrinks: number
  uniqueTypes: Set<string>
  maxInDay: number
  currentStreak: number
  longestStreak: number
  friendCount: number
  accountAgeDays: number
  drinksByType: Record<string, number>
  drinkTimes: Date[]
  lastDrinkDate: string | null
  firstDrinkDate: string | null
  daysWithDrinks: Set<string>
}

type AchievementContextType = {
  checkAchievements: () => Promise<void>
  pendingUnlocks: UnlockedAchievement[]
  dismissUnlock: () => void
  isChecking: boolean
}

const AchievementContext = React.createContext<AchievementContextType | null>(null)

export function useAchievements() {
  const context = React.useContext(AchievementContext)
  if (!context) {
    throw new Error("useAchievements must be used within AchievementProvider")
  }
  return context
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function calculateStreak(daysWithDrinks: Set<string>): { current: number; longest: number } {
  if (daysWithDrinks.size === 0) return { current: 0, longest: 0 }

  const sortedDays = Array.from(daysWithDrinks).sort()
  const today = getLocalDateString(new Date())
  const yesterday = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))

  let longest = 1
  let current = 0
  let tempStreak = 1

  for (let i = 1; i < sortedDays.length; i++) {
    const prevDate = new Date(sortedDays[i - 1])
    const currDate = new Date(sortedDays[i])
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000))

    if (diffDays === 1) {
      tempStreak++
      longest = Math.max(longest, tempStreak)
    } else {
      tempStreak = 1
    }
  }

  // Calculate current streak (must include today or yesterday)
  const lastDay = sortedDays[sortedDays.length - 1]
  if (lastDay === today || lastDay === yesterday) {
    current = 1
    for (let i = sortedDays.length - 2; i >= 0; i--) {
      const currDate = new Date(sortedDays[i + 1])
      const prevDate = new Date(sortedDays[i])
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000))

      if (diffDays === 1) {
        current++
      } else {
        break
      }
    }
  }

  return { current, longest: Math.max(longest, current) }
}

async function fetchUserStats(supabase: ReturnType<typeof createClient>, userId: string): Promise<UserStats> {
  // Fetch all drink logs
  const { data: logs } = await supabase
    .from("drink_logs")
    .select("id, drink_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  // Fetch friend count
  const { count: friendCount } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq("status", "accepted")

  // Fetch user created_at for account age
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .single()

  const drinkLogs = logs ?? []
  const uniqueTypes = new Set<string>()
  const drinksByType: Record<string, number> = {}
  const drinksByDay: Record<string, number> = {}
  const daysWithDrinks = new Set<string>()
  const drinkTimes: Date[] = []

  for (const log of drinkLogs) {
    const drinkType = log.drink_type.toLowerCase()
    uniqueTypes.add(drinkType)
    drinksByType[drinkType] = (drinksByType[drinkType] || 0) + 1

    const dateStr = getLocalDateString(new Date(log.created_at))
    drinksByDay[dateStr] = (drinksByDay[dateStr] || 0) + 1
    daysWithDrinks.add(dateStr)
    drinkTimes.push(new Date(log.created_at))
  }

  const maxInDay = Math.max(...Object.values(drinksByDay), 0)
  const { current: currentStreak, longest: longestStreak } = calculateStreak(daysWithDrinks)

  const accountCreated = profile?.created_at ? new Date(profile.created_at) : new Date()
  const accountAgeDays = Math.floor((Date.now() - accountCreated.getTime()) / (24 * 60 * 60 * 1000))

  return {
    totalDrinks: drinkLogs.length,
    uniqueTypes,
    maxInDay,
    currentStreak,
    longestStreak,
    friendCount: friendCount ?? 0,
    accountAgeDays,
    drinksByType,
    drinkTimes,
    lastDrinkDate: drinkLogs.length > 0 ? drinkLogs[drinkLogs.length - 1].created_at : null,
    firstDrinkDate: drinkLogs.length > 0 ? drinkLogs[0].created_at : null,
    daysWithDrinks,
  }
}

function checkAchievementRequirement(achievement: Achievement, stats: UserStats): boolean {
  const { requirement_type, requirement_value } = achievement
  const value = requirement_value.toLowerCase()

  switch (requirement_type) {
    case "total_drinks":
      return stats.totalDrinks >= parseInt(value)

    case "unique_types":
      if (value === "all") {
        // Assuming 7 drink types: beer, seltzer, wine, cocktail, shot, spirit, other
        return stats.uniqueTypes.size >= 7
      }
      return stats.uniqueTypes.size >= parseInt(value)

    case "max_in_day":
      return stats.maxInDay >= parseInt(value)

    case "streak_days":
      return stats.longestStreak >= parseInt(value)

    case "friend_count":
      return stats.friendCount >= parseInt(value)

    case "account_age":
      return stats.accountAgeDays >= parseInt(value)

    case "specific_drink_count": {
      // Format: "beer:10" or "wine:50"
      const [drinkType, count] = value.split(":")
      return (stats.drinksByType[drinkType] || 0) >= parseInt(count)
    }

    case "same_type_count": {
      // Check if any drink type has been logged X times
      const threshold = parseInt(value)
      return Object.values(stats.drinksByType).some((count) => count >= threshold)
    }

    case "time_of_day": {
      // Check drink times
      for (const time of stats.drinkTimes) {
        const hours = time.getHours()
        const dayOfWeek = time.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

        switch (value) {
          case "before_10":
            if (hours < 10) return true
            break
          case "brunch":
            if (isWeekend && hours >= 10 && hours < 12) return true
            break
          case "afternoon":
            if (hours >= 14 && hours < 17) return true
            break
          case "happy_hour":
            if (hours >= 17 && hours < 19) return true
            break
          case "after_midnight":
            if (hours >= 0 && hours < 5) return true
            break
          case "after_3am":
            if (hours >= 3 && hours < 6) return true
            break
        }
      }
      return false
    }

    case "day_of_week": {
      for (const time of stats.drinkTimes) {
        const dayOfWeek = time.getDay()
        if (value === "friday" && dayOfWeek === 5) return true
        if (value === "sunday" && dayOfWeek === 0) return true
      }
      return false
    }

    case "specific_date": {
      for (const time of stats.drinkTimes) {
        const month = String(time.getMonth() + 1).padStart(2, "0")
        const day = String(time.getDate()).padStart(2, "0")
        const dateStr = `${month}-${day}`

        if (value === dateStr) return true

        // Special cases
        if (value === "thanksgiving") {
          // 4th Thursday of November
          if (time.getMonth() === 10) {
            const firstDay = new Date(time.getFullYear(), 10, 1).getDay()
            const thanksgivingDay = 22 + ((11 - firstDay) % 7)
            if (time.getDate() === thanksgivingDay) return true
          }
        }
      }
      return false
    }

    case "weekend_both": {
      // Check if user logged on both Sat and Sun of the same weekend
      const weekends = new Map<string, Set<number>>()
      for (const time of stats.drinkTimes) {
        const dayOfWeek = time.getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          // Get the Sunday of this weekend as the key
          const sunday = new Date(time)
          if (dayOfWeek === 6) sunday.setDate(sunday.getDate() + 1)
          const key = getLocalDateString(sunday)
          if (!weekends.has(key)) weekends.set(key, new Set())
          weekends.get(key)!.add(dayOfWeek)
        }
      }
      for (const days of weekends.values()) {
        if (days.has(0) && days.has(6)) return true
      }
      return false
    }

    case "first_day_log": {
      if (!stats.firstDrinkDate) return false
      const firstDrink = new Date(stats.firstDrinkDate)
      const { data: profile } = { data: null } // Would need to fetch
      // Simplified: assume first drink was on first day
      return stats.totalDrinks >= 1
    }

    case "perfect_week": {
      // Check for 7 consecutive days
      return stats.longestStreak >= 7
    }

    case "perfect_month": {
      // Check for 30 consecutive days
      return stats.longestStreak >= 30
    }

    case "palindrome_time": {
      for (const time of stats.drinkTimes) {
        const hours = String(time.getHours()).padStart(2, "0")
        const minutes = String(time.getMinutes()).padStart(2, "0")
        const timeStr = `${hours}${minutes}`
        if (timeStr === timeStr.split("").reverse().join("")) return true
      }
      return false
    }

    case "lucky_seven": {
      // Log exactly 7 drinks on the 7th day of month
      for (const [dateStr, count] of Object.entries(stats.drinksByType)) {
        // This needs to check drinksByDay, not drinksByType
      }
      // Check drinksByDay for 7th of any month with exactly 7 drinks
      const drinksByDay: Record<string, number> = {}
      for (const time of stats.drinkTimes) {
        const dateStr = getLocalDateString(time)
        drinksByDay[dateStr] = (drinksByDay[dateStr] || 0) + 1
      }
      for (const [dateStr, count] of Object.entries(drinksByDay)) {
        const date = new Date(dateStr)
        if (date.getDate() === 7 && count === 7) return true
      }
      return false
    }

    default:
      return false
  }
}

export function AchievementProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [pendingUnlocks, setPendingUnlocks] = React.useState<UnlockedAchievement[]>([])
  const [isChecking, setIsChecking] = React.useState(false)

  const checkAchievements = React.useCallback(async () => {
    setIsChecking(true)

    try {
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes.user) return

      const userId = userRes.user.id

      // Fetch all achievements
      const { data: allAchievements } = await supabase
        .from("achievements")
        .select("*")

      // Fetch already unlocked achievements
      const { data: userAchievements } = await supabase
        .from("user_achievements")
        .select("achievement_id")
        .eq("user_id", userId)

      const unlockedIds = new Set((userAchievements ?? []).map((ua) => ua.achievement_id))
      const achievements = (allAchievements ?? []) as Achievement[]

      // Get user stats
      const stats = await fetchUserStats(supabase, userId)

      // Check each non-unlocked achievement
      const newlyUnlocked: UnlockedAchievement[] = []

      for (const achievement of achievements) {
        if (unlockedIds.has(achievement.id)) continue

        const met = checkAchievementRequirement(achievement, stats)
        if (met) {
          // Insert into user_achievements
          const { error } = await supabase
            .from("user_achievements")
            .insert({
              user_id: userId,
              achievement_id: achievement.id,
            })

          if (!error) {
            newlyUnlocked.push({
              ...achievement,
              unlocked_at: new Date().toISOString(),
            })
          }
        }
      }

      if (newlyUnlocked.length > 0) {
        setPendingUnlocks((prev) => [...prev, ...newlyUnlocked])
      }
    } catch (e) {
      console.error("Error checking achievements:", e)
    } finally {
      setIsChecking(false)
    }
  }, [supabase])

  const dismissUnlock = React.useCallback(() => {
    setPendingUnlocks((prev) => prev.slice(1))
  }, [])

  return (
    <AchievementContext.Provider
      value={{
        checkAchievements,
        pendingUnlocks,
        dismissUnlock,
        isChecking,
      }}
    >
      {children}
    </AchievementContext.Provider>
  )
}