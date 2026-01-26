"use client"

import * as React from "react"
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
  drinksByDay: Record<string, number>
  accountCreatedAt: Date | null
  weeklyStreakCount: number
  monthlyStreakCount: number
  daysInactiveBefore: number
  totalCheersReceived: number
  shareCount: number
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

function calculateWeeklyStreak(daysWithDrinks: Set<string>): number {
  if (daysWithDrinks.size === 0) return 0

  const sortedDays = Array.from(daysWithDrinks).sort()
  const weekSet = new Set<string>()
  
  for (const day of sortedDays) {
    const date = new Date(day)
    const year = date.getFullYear()
    const startOfYear = new Date(year, 0, 1)
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
    const weekNum = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7)
    weekSet.add(`${year}-W${weekNum}`)
  }

  const sortedWeeks = Array.from(weekSet).sort()
  let maxStreak = 1
  let currentStreak = 1

  for (let i = 1; i < sortedWeeks.length; i++) {
    const [prevYear, prevWeek] = sortedWeeks[i - 1].split('-W').map(Number)
    const [currYear, currWeek] = sortedWeeks[i].split('-W').map(Number)

    const isConsecutive =
      (currYear === prevYear && currWeek === prevWeek + 1) ||
      (currYear === prevYear + 1 && prevWeek >= 52 && currWeek === 1)

    if (isConsecutive) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 1
    }
  }

  return maxStreak
}

function calculateMonthlyStreak(daysWithDrinks: Set<string>): number {
  if (daysWithDrinks.size === 0) return 0

  const sortedDays = Array.from(daysWithDrinks).sort()
  const monthSet = new Set<string>()
  
  for (const day of sortedDays) {
    const date = new Date(day)
    monthSet.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const sortedMonths = Array.from(monthSet).sort()
  let maxStreak = 1
  let currentStreak = 1

  for (let i = 1; i < sortedMonths.length; i++) {
    const [prevYear, prevMonth] = sortedMonths[i - 1].split('-').map(Number)
    const [currYear, currMonth] = sortedMonths[i].split('-').map(Number)

    const isConsecutive =
      (currYear === prevYear && currMonth === prevMonth + 1) ||
      (currYear === prevYear + 1 && prevMonth === 12 && currMonth === 1)

    if (isConsecutive) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 1
    }
  }

  return maxStreak
}

function calculateDaysInactiveBefore(drinkTimes: Date[]): number {
  if (drinkTimes.length < 2) return 0

  const sortedTimes = [...drinkTimes].sort((a, b) => a.getTime() - b.getTime())
  let maxGap = 0

  for (let i = 1; i < sortedTimes.length; i++) {
    const gap = Math.floor((sortedTimes[i].getTime() - sortedTimes[i - 1].getTime()) / (24 * 60 * 60 * 1000))
    maxGap = Math.max(maxGap, gap)
  }

  return maxGap
}

async function fetchUserStats(supabase: ReturnType<typeof createClient>, userId: string): Promise<UserStats> {
  const { data: logs } = await supabase
    .from("drink_logs")
    .select("id, drink_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  const { count: friendCount } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted")

  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .single()

  // Get cheers received on this user's drink logs
  const drinkLogIds = (logs ?? []).map(l => l.id)
  let totalCheersReceived = 0
  if (drinkLogIds.length > 0) {
    const { count } = await supabase
      .from("drink_cheers")
      .select("*", { count: "exact", head: true })
      .in("drink_log_id", drinkLogIds)
    totalCheersReceived = count ?? 0
  }

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
  const weeklyStreakCount = calculateWeeklyStreak(daysWithDrinks)
  const monthlyStreakCount = calculateMonthlyStreak(daysWithDrinks)
  const daysInactiveBefore = calculateDaysInactiveBefore(drinkTimes)

  const accountCreatedAt = profile?.created_at ? new Date(profile.created_at) : null
  const accountAgeDays = accountCreatedAt 
    ? Math.floor((Date.now() - accountCreatedAt.getTime()) / (24 * 60 * 60 * 1000))
    : 0

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
    drinksByDay,
    accountCreatedAt,
    weeklyStreakCount,
    monthlyStreakCount,
    daysInactiveBefore,
    totalCheersReceived: totalCheersReceived ?? 0,
    shareCount: drinkLogs.length,
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
      const [drinkType, count] = value.split(":")
      return (stats.drinksByType[drinkType] || 0) >= parseInt(count)
    }

    case "same_type_count": {
      const threshold = parseInt(value)
      return Object.values(stats.drinksByType).some((count) => count >= threshold)
    }

    case "time_of_day": {
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
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      }
      const targetDay = dayMap[value]
      if (targetDay === undefined) return false
      
      for (const time of stats.drinkTimes) {
        if (time.getDay() === targetDay) return true
      }
      return false
    }

    case "specific_date": {
      for (const time of stats.drinkTimes) {
        const month = String(time.getMonth() + 1).padStart(2, "0")
        const day = String(time.getDate()).padStart(2, "0")
        const dateStr = `${month}-${day}`

        if (value === dateStr) return true

        if (value === "thanksgiving") {
          if (time.getMonth() === 10) {
            const firstDay = new Date(time.getFullYear(), 10, 1).getDay()
            const thanksgivingDay = 22 + ((11 - firstDay) % 7)
            if (time.getDate() === thanksgivingDay) return true
          }
        }

        if (value === "birthday") {
          return false
        }
      }
      return false
    }

    case "weekend_both": {
      const weekends = new Map<string, Set<number>>()
      for (const time of stats.drinkTimes) {
        const dayOfWeek = time.getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) {
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
      if (!stats.firstDrinkDate || !stats.accountCreatedAt) return false
      const firstDrink = new Date(stats.firstDrinkDate)
      return getLocalDateString(firstDrink) === getLocalDateString(stats.accountCreatedAt)
    }

    case "days_inactive_before": {
      const threshold = parseInt(value)
      return stats.daysInactiveBefore >= threshold
    }

    case "weekly_streak": {
      const threshold = parseInt(value)
      return stats.weeklyStreakCount >= threshold
    }

    case "monthly_streak": {
      const threshold = parseInt(value)
      return stats.monthlyStreakCount >= threshold
    }

    case "perfect_week":
      return stats.longestStreak >= 7

    case "perfect_month":
      return stats.longestStreak >= 30

    case "time_between": {
      if (stats.drinkTimes.length < 2) return false
      
      const sortedTimes = [...stats.drinkTimes].sort((a, b) => a.getTime() - b.getTime())
      
      if (value === "exact_60") {
        for (let i = 1; i < sortedTimes.length; i++) {
          const diff = (sortedTimes[i].getTime() - sortedTimes[i - 1].getTime()) / (60 * 1000)
          if (diff >= 55 && diff <= 65) return true
        }
        return false
      }
      
      if (value === "30") {
        for (let i = 1; i < sortedTimes.length; i++) {
          const diff = (sortedTimes[i].getTime() - sortedTimes[i - 1].getTime()) / (60 * 1000)
          if (diff <= 30) return true
        }
      } else if (value === "60") {
        for (let i = 2; i < sortedTimes.length; i++) {
          const diff = (sortedTimes[i].getTime() - sortedTimes[i - 2].getTime()) / (60 * 1000)
          if (diff <= 60) return true
        }
      }
      return false
    }

    case "same_time_streak": {
      const threshold = parseInt(value)
      if (stats.drinkTimes.length < threshold) return false
      
      const dailyFirstDrink = new Map<string, Date>()
      for (const time of stats.drinkTimes) {
        const dateStr = getLocalDateString(time)
        if (!dailyFirstDrink.has(dateStr) || time < dailyFirstDrink.get(dateStr)!) {
          dailyFirstDrink.set(dateStr, time)
        }
      }
      
      const sortedDays = Array.from(dailyFirstDrink.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      
      for (let i = 0; i <= sortedDays.length - threshold; i++) {
        let validStreak = true
        const baseMinutes = sortedDays[i][1].getHours() * 60 + sortedDays[i][1].getMinutes()
        
        for (let j = 1; j < threshold; j++) {
          const prevDate = new Date(sortedDays[i + j - 1][0])
          const currDate = new Date(sortedDays[i + j][0])
          const dayDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000))
          
          if (dayDiff !== 1) {
            validStreak = false
            break
          }
          
          const currMinutes = sortedDays[i + j][1].getHours() * 60 + sortedDays[i + j][1].getMinutes()
          if (Math.abs(currMinutes - baseMinutes) > 30) {
            validStreak = false
            break
          }
        }
        
        if (validStreak) return true
      }
      return false
    }

    case "same_day_streak": {
      const threshold = parseInt(value)
      
      const drinksByWeekday: Record<number, string[]> = {}
      for (const time of stats.drinkTimes) {
        const dayOfWeek = time.getDay()
        const dateStr = getLocalDateString(time)
        if (!drinksByWeekday[dayOfWeek]) drinksByWeekday[dayOfWeek] = []
        if (!drinksByWeekday[dayOfWeek].includes(dateStr)) {
          drinksByWeekday[dayOfWeek].push(dateStr)
        }
      }
      
      for (const dates of Object.values(drinksByWeekday)) {
        if (dates.length < threshold) continue
        
        const sortedDates = dates.sort()
        let streak = 1
        
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1])
          const currDate = new Date(sortedDates[i])
          const dayDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000))
          
          if (dayDiff === 7) {
            streak++
            if (streak >= threshold) return true
          } else {
            streak = 1
          }
        }
      }
      return false
    }

    case "ascending_days": {
      const threshold = parseInt(value)
      
      const sortedDays = Array.from(stats.daysWithDrinks).sort()
      if (sortedDays.length < threshold) return false
      
      for (let i = 0; i <= sortedDays.length - threshold; i++) {
        let validStreak = true
        
        for (let j = 1; j < threshold; j++) {
          const prevDate = new Date(sortedDays[i + j - 1])
          const currDate = new Date(sortedDays[i + j])
          const dayDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000))
          
          if (dayDiff !== 1) {
            validStreak = false
            break
          }
          
          const prevCount = stats.drinksByDay[sortedDays[i + j - 1]] || 0
          const currCount = stats.drinksByDay[sortedDays[i + j]] || 0
          
          if (currCount <= prevCount) {
            validStreak = false
            break
          }
        }
        
        if (validStreak) return true
      }
      return false
    }

    case "share_count": {
      const threshold = parseInt(value)
      return stats.shareCount >= threshold
    }

    case "reactions_received": {
      const threshold = parseInt(value)
      return stats.totalCheersReceived >= threshold
    }

    case "exact_time": {
      for (const drinkTime of stats.drinkTimes) {
        const hours = drinkTime.getHours()
        const minutes = drinkTime.getMinutes()
        const month = drinkTime.getMonth() + 1
        const day = drinkTime.getDate()
        
        if (month === 1 && day === 1 && hours === 0 && minutes <= 5) {
          return true
        }
      }
      return false
    }

    case "lucky_seven": {
      for (const [dateStr, count] of Object.entries(stats.drinksByDay)) {
        const date = new Date(dateStr)
        if (date.getDate() === 7 && count >= 7) return true
      }
      return false
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

    case "betatesters":
      return false

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

      const { data: allAchievements } = await supabase
        .from("achievements")
        .select("*")

      const { data: userAchievements } = await supabase
        .from("user_achievements")
        .select("achievement_id")
        .eq("user_id", userId)

      const unlockedIds = new Set((userAchievements ?? []).map((ua) => ua.achievement_id))
      const achievements = (allAchievements ?? []) as Achievement[]

      const stats = await fetchUserStats(supabase, userId)

      const newlyUnlocked: UnlockedAchievement[] = []

      for (const achievement of achievements) {
        if (unlockedIds.has(achievement.id)) continue

        const met = checkAchievementRequirement(achievement, stats)
        if (met) {
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