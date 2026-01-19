import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type Difficulty = "bronze" | "silver" | "gold" | "diamond"

type Achievement = {
  id: string
  category: string
  name: string
  requirement_type: string
  requirement_value: string
  difficulty: Difficulty
}

type DrinkLog = {
  id: string
  user_id: string
  drink_type: string
  created_at: string
}

// Add this new type for the partial select
type DrinkLogPartial = {
  id: string
  drink_type: string
  created_at: string
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

        if (value === "thanksgiving") {
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

    case "first_day_log":
      return stats.totalDrinks >= 1

    case "perfect_week":
      return stats.longestStreak >= 7

    case "perfect_month":
      return stats.longestStreak >= 30

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

export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      )
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Fetch all achievements
    const { data: allAchievements, error: achievementsErr } = await admin
      .from("achievements")
      .select("*")

    if (achievementsErr) {
      return NextResponse.json({ error: achievementsErr.message }, { status: 400 })
    }

    const achievements = (allAchievements ?? []) as Achievement[]
    const achievementsMap = new Map(achievements.map((a) => [a.id, a]))

    // Get all users with unlocked achievements
    const { data: userAchievements, error: uaErr } = await admin
      .from("user_achievements")
      .select("user_id, achievement_id, unlocked_at")

    if (uaErr) {
      return NextResponse.json({ error: uaErr.message }, { status: 400 })
    }

    if (!userAchievements || userAchievements.length === 0) {
      return NextResponse.json({ message: "No user achievements found", updated: 0 })
    }

    // Group by user
    const byUser = new Map<string, Array<{ achievement_id: string; unlocked_at: string }>>()
    for (const ua of userAchievements) {
      if (!byUser.has(ua.user_id)) {
        byUser.set(ua.user_id, [])
      }
      byUser.get(ua.user_id)!.push({
        achievement_id: ua.achievement_id,
        unlocked_at: ua.unlocked_at,
      })
    }

    let totalUpdated = 0
    const results: Array<{ userId: string; achievementId: string; oldDate: string; newDate: string }> = []

    // Process each user
    for (const [userId, userAchievs] of byUser.entries()) {
      // Fetch user's drink logs in chronological order
      const { data: logs, error: logsErr } = await admin
        .from("drink_logs")
        .select("id, drink_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })

      if (logsErr || !logs) continue

      // Fetch user's profile for account age
      const { data: profile } = await admin
        .from("profiles")
        .select("created_at")
        .eq("id", userId)
        .single()

      // Fetch friend count (static for now - could be improved to track historically)
      const { count: friendCount } = await admin
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq("status", "accepted")

      const accountCreated = profile?.created_at ? new Date(profile.created_at) : new Date()

      // Process logs incrementally to find when each achievement was unlocked
      const unlockedDates = new Map<string, string>()

      // Initialize stats
      let stats: UserStats = {
        totalDrinks: 0,
        uniqueTypes: new Set(),
        maxInDay: 0,
        currentStreak: 0,
        longestStreak: 0,
        friendCount: friendCount ?? 0,
        accountAgeDays: 0,
        drinksByType: {},
        drinkTimes: [],
        lastDrinkDate: null,
        firstDrinkDate: null,
        daysWithDrinks: new Set(),
      }

      // Check achievements that don't depend on drink logs first (account_age)
      for (const ua of userAchievs) {
        const achievement = achievementsMap.get(ua.achievement_id)
        if (!achievement) continue

        if (achievement.requirement_type === "account_age") {
          const requiredDays = parseInt(achievement.requirement_value)
          const unlockDate = new Date(accountCreated)
          unlockDate.setDate(unlockDate.getDate() + requiredDays)
          unlockedDates.set(ua.achievement_id, unlockDate.toISOString())
        }
      }

      // Track drinks per day incrementally
      const drinksByDayMap = new Map<string, number>()

      // Process each drink log chronologically - USE DrinkLogPartial HERE
      for (const log of logs as DrinkLogPartial[]) {
        const logDate = new Date(log.created_at)
        const drinkType = log.drink_type.toLowerCase()
        const dayOfWeek = logDate.getDay()

        // Update stats incrementally
        stats.totalDrinks++
        stats.uniqueTypes.add(drinkType)
        stats.drinksByType[drinkType] = (stats.drinksByType[drinkType] || 0) + 1
        stats.drinkTimes.push(logDate)

        const dateStr = getLocalDateString(logDate)
        stats.daysWithDrinks.add(dateStr)

        // Update drinks per day count
        drinksByDayMap.set(dateStr, (drinksByDayMap.get(dateStr) || 0) + 1)
        stats.maxInDay = Math.max(stats.maxInDay, drinksByDayMap.get(dateStr) || 0)

        // Recalculate streaks
        const streakResult = calculateStreak(stats.daysWithDrinks)
        stats.currentStreak = streakResult.current
        stats.longestStreak = streakResult.longest

        // Update account age
        stats.accountAgeDays = Math.floor((logDate.getTime() - accountCreated.getTime()) / (24 * 60 * 60 * 1000))

        stats.lastDrinkDate = log.created_at
        if (!stats.firstDrinkDate) {
          stats.firstDrinkDate = log.created_at
        }

        // Check each achievement that hasn't been unlocked yet
        for (const ua of userAchievs) {
          if (unlockedDates.has(ua.achievement_id)) continue

          const achievement = achievementsMap.get(ua.achievement_id)
          if (!achievement) continue

          // Skip account_age (already handled)
          if (achievement.requirement_type === "account_age") continue

          // For time/date-specific achievements, check if THIS specific log meets the requirement
          const isTimeBased = [
            "time_of_day",
            "day_of_week",
            "specific_date",
            "palindrome_time",
            "lucky_seven",
          ].includes(achievement.requirement_type)

          let met = false
          if (isTimeBased) {
            // Check if this specific log meets the requirement
            const { requirement_type, requirement_value } = achievement
            const value = requirement_value.toLowerCase()
            const hours = logDate.getHours()
            const minutes = logDate.getMinutes()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
            const dateStr = getLocalDateString(logDate)
            const month = String(logDate.getMonth() + 1).padStart(2, "0")
            const day = String(logDate.getDate()).padStart(2, "0")
            const dateOnlyStr = `${month}-${day}`

            switch (requirement_type) {
              case "time_of_day":
                switch (value) {
                  case "before_10":
                    met = hours < 10
                    break
                  case "brunch":
                    met = isWeekend && hours >= 10 && hours < 12
                    break
                  case "afternoon":
                    met = hours >= 14 && hours < 17
                    break
                  case "happy_hour":
                    met = hours >= 17 && hours < 19
                    break
                  case "after_midnight":
                    met = hours >= 0 && hours < 5
                    break
                  case "after_3am":
                    met = hours >= 3 && hours < 6
                    break
                }
                break

              case "day_of_week":
                if (value === "friday") met = dayOfWeek === 5
                if (value === "sunday") met = dayOfWeek === 0
                break

              case "specific_date":
                if (value === dateOnlyStr) met = true
                if (value === "thanksgiving") {
                  if (logDate.getMonth() === 10) {
                    const firstDay = new Date(logDate.getFullYear(), 10, 1).getDay()
                    const thanksgivingDay = 22 + ((11 - firstDay) % 7)
                    met = logDate.getDate() === thanksgivingDay
                  }
                }
                break

              case "palindrome_time": {
                const hoursStr = String(hours).padStart(2, "0")
                const minutesStr = String(minutes).padStart(2, "0")
                const timeStr = `${hoursStr}${minutesStr}`
                met = timeStr === timeStr.split("").reverse().join("")
                break
              }

              case "lucky_seven": {
                const dayOfMonth = logDate.getDate()
                const drinksToday = drinksByDayMap.get(dateStr) || 0
                met = dayOfMonth === 7 && drinksToday === 7
                break
              }
            }
          } else {
            // For other achievements, check overall stats
            met = checkAchievementRequirement(achievement, stats)
          }

          if (met) {
            // This is when the achievement was unlocked
            unlockedDates.set(ua.achievement_id, log.created_at)
          }
        }

        // Special handling for weekend_both - need to check after processing all logs for a weekend
        for (const ua of userAchievs) {
          if (unlockedDates.has(ua.achievement_id)) continue

          const achievement = achievementsMap.get(ua.achievement_id)
          if (!achievement || achievement.requirement_type !== "weekend_both") continue

          // Check if this log completes a weekend (both Sat and Sun)
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            const sunday = new Date(logDate)
            if (dayOfWeek === 6) sunday.setDate(sunday.getDate() + 1)
            const weekendKey = getLocalDateString(sunday)

            // Check if we have logs for both Saturday and Sunday of this weekend
            const saturdayDate = new Date(sunday)
            saturdayDate.setDate(saturdayDate.getDate() - 1)
            const saturdayKey = getLocalDateString(saturdayDate)

            if (stats.daysWithDrinks.has(weekendKey) && stats.daysWithDrinks.has(saturdayKey)) {
              // Both days have drinks - find when the second day was logged
              let secondDayDate = log.created_at
              if (dayOfWeek === 0) {
                // This is Sunday, check if Saturday was already logged
                const saturdayLog = logs.find((l) => {
                  const lDate = new Date(l.created_at)
                  return getLocalDateString(lDate) === saturdayKey
                })
                if (saturdayLog) {
                  secondDayDate = saturdayLog.created_at > log.created_at ? log.created_at : saturdayLog.created_at
                }
              } else {
                // This is Saturday, check if Sunday was already logged
                const sundayLog = logs.find((l) => {
                  const lDate = new Date(l.created_at)
                  return getLocalDateString(lDate) === weekendKey
                })
                if (sundayLog) {
                  secondDayDate = sundayLog.created_at > log.created_at ? log.created_at : sundayLog.created_at
                }
              }

              unlockedDates.set(ua.achievement_id, secondDayDate)
            }
          }
        }
      }

      // Update unlocked_at dates in database
      for (const ua of userAchievs) {
        const newDate = unlockedDates.get(ua.achievement_id)
        if (newDate && newDate !== ua.unlocked_at) {
          const { error: updateErr } = await admin
            .from("user_achievements")
            .update({ unlocked_at: newDate })
            .eq("user_id", userId)
            .eq("achievement_id", ua.achievement_id)

          if (!updateErr) {
            totalUpdated++
            results.push({
              userId,
              achievementId: ua.achievement_id,
              oldDate: ua.unlocked_at,
              newDate,
            })
          }
        }
      }
    }

    return NextResponse.json({
      message: "Backfill complete",
      totalUpdated,
      totalProcessed: userAchievements.length,
      sampleResults: results.slice(0, 10), // Show first 10 for debugging
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}