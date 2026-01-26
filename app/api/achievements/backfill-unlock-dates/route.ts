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

type DrinkLogPartial = {
  id: string
  drink_type: string
  created_at: string
}

type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  status: string
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
  drinksByDay: Record<string, number>
  accountCreatedAt: Date
  weeklyStreakCount: number
  monthlyStreakCount: number
  maxDaysInactive: number
  totalCheersReceived: number
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

function calculateMaxDaysInactive(daysWithDrinks: Set<string>): number {
  if (daysWithDrinks.size < 2) return 0

  const sortedDays = Array.from(daysWithDrinks).sort()
  let maxGap = 0

  for (let i = 1; i < sortedDays.length; i++) {
    const prevDate = new Date(sortedDays[i - 1])
    const currDate = new Date(sortedDays[i])
    const gap = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000))
    maxGap = Math.max(maxGap, gap)
  }

  return maxGap
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

    case "specific_drink_count": {
      const [drinkType, count] = value.split(":")
      return (stats.drinksByType[drinkType] || 0) >= parseInt(count)
    }

    case "same_type_count": {
      const threshold = parseInt(value)
      return Object.values(stats.drinksByType).some((count) => count >= threshold)
    }

    case "perfect_week":
      return stats.longestStreak >= 7

    case "perfect_month":
      return stats.longestStreak >= 30

    case "weekly_streak":
      return stats.weeklyStreakCount >= parseInt(value)

    case "monthly_streak":
      return stats.monthlyStreakCount >= parseInt(value)

    case "days_inactive_before":
      return stats.maxDaysInactive >= parseInt(value)

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
      for (const [dateStr, count] of Object.entries(stats.drinksByDay)) {
        const date = new Date(dateStr)
        if (date.getDate() === 7 && count >= 7) return true
      }
      return false
    }

    case "exact_time": {
      // Midnight on Jan 1
      for (const time of stats.drinkTimes) {
        const month = time.getMonth() + 1
        const day = time.getDate()
        const hours = time.getHours()
        const minutes = time.getMinutes()
        if (month === 1 && day === 1 && hours === 0 && minutes < 10) return true
      }
      return false
    }

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

    // These are handled in pre-check section, not here
    case "share_count":
    case "friend_count":
    case "account_age":
    case "betatesters":
    case "reactions_received":
    case "first_day_log":
      return false

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
    const results: Array<{ odDate: string; newDate: string; achievementId: string }> = []

    // Process each user
    for (const [userId, userAchievs] of byUser.entries()) {
      // Fetch user's drink logs in chronological order
      const { data: logs, error: logsErr } = await admin
        .from("drink_logs")
        .select("id, drink_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })

      if (logsErr || !logs) continue

      // Fetch user's profile for account creation date
      const { data: profile } = await admin
        .from("profiles")
        .select("created_at")
        .eq("id", userId)
        .single()

      // Fetch friendships with timestamps (for friend_count achievements)
      const { data: friendshipsData } = await admin
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq("status", "accepted")
        .order("created_at", { ascending: true })
      
      const friendships = (friendshipsData ?? []) as Friendship[]

      // Fetch cheers received with timestamps
      const drinkLogIds = logs.map(l => l.id)
      let cheersReceived: Array<{ created_at: string }> = []
      if (drinkLogIds.length > 0) {
        const { data: cheersData } = await admin
          .from("drink_cheers")
          .select("created_at")
          .in("drink_log_id", drinkLogIds)
          .order("created_at", { ascending: true })
        cheersReceived = cheersData ?? []
      }

      const accountCreated = profile?.created_at ? new Date(profile.created_at) : new Date()
      const accountCreatedDateStr = getLocalDateString(accountCreated)

      // Process logs incrementally to find when each achievement was unlocked
      const unlockedDates = new Map<string, string>()

      // Initialize stats
      let stats: UserStats = {
        totalDrinks: 0,
        uniqueTypes: new Set(),
        maxInDay: 0,
        currentStreak: 0,
        longestStreak: 0,
        friendCount: friendships.length,
        accountAgeDays: 0,
        drinksByType: {},
        drinkTimes: [],
        lastDrinkDate: null,
        firstDrinkDate: null,
        daysWithDrinks: new Set(),
        drinksByDay: {},
        accountCreatedAt: accountCreated,
        weeklyStreakCount: 0,
        monthlyStreakCount: 0,
        maxDaysInactive: 0,
        totalCheersReceived: cheersReceived.length,
      }

      // ============================================================
      // PRE-CHECK SECTION: Handle achievements with special date logic
      // These achievements have dates that are NOT based on drink logs
      // ============================================================
      
      for (const ua of userAchievs) {
        const achievement = achievementsMap.get(ua.achievement_id)
        if (!achievement) continue

        // account_age: unlock date = account creation + N days
        // Example: "One Week In" (7 days) for account created 12/31/2025 → unlocks 1/7/2026
        if (achievement.requirement_type === "account_age") {
          const requiredDays = parseInt(achievement.requirement_value)
          // Use milliseconds math to avoid timezone issues with setDate()
          const unlockDate = new Date(accountCreated.getTime() + requiredDays * 24 * 60 * 60 * 1000)
          unlockedDates.set(ua.achievement_id, unlockDate.toISOString())
        }

        // betatesters: unlock date = account creation date
        if (achievement.requirement_type === "betatesters") {
          unlockedDates.set(ua.achievement_id, accountCreated.toISOString())
        }

        // reactions_received: unlock date = when the Nth cheer was received
        if (achievement.requirement_type === "reactions_received") {
          const requiredCheers = parseInt(achievement.requirement_value)
          if (cheersReceived.length >= requiredCheers) {
            // The Nth cheer (0-indexed, so requiredCheers - 1)
            const nthCheer = cheersReceived[requiredCheers - 1]
            unlockedDates.set(ua.achievement_id, nthCheer.created_at)
          }
        }

        // first_day_log: unlock date = first drink logged on account creation day
        if (achievement.requirement_type === "first_day_log") {
          const firstDayDrink = logs.find(l => {
            const drinkDateStr = getLocalDateString(new Date(l.created_at))
            return drinkDateStr === accountCreatedDateStr
          })
          if (firstDayDrink) {
            unlockedDates.set(ua.achievement_id, firstDayDrink.created_at)
          }
        }

        // friend_count: unlock date = when the Nth friendship was established
        if (achievement.requirement_type === "friend_count") {
          const requiredFriends = parseInt(achievement.requirement_value)
          if (friendships.length >= requiredFriends) {
            // The Nth friendship (0-indexed, so requiredFriends - 1)
            const nthFriendship = friendships[requiredFriends - 1]
            unlockedDates.set(ua.achievement_id, nthFriendship.created_at)
          }
        }

        // share_count: All drinks are considered "shared" (public feed)
        // Unlock date = when the Nth drink was logged
        if (achievement.requirement_type === "share_count") {
          const requiredShares = parseInt(achievement.requirement_value)
          if (logs.length >= requiredShares) {
            // The Nth drink log (0-indexed, so requiredShares - 1)
            const nthDrink = logs[requiredShares - 1]
            unlockedDates.set(ua.achievement_id, nthDrink.created_at)
          }
        }
      }

      // ============================================================
      // MAIN LOOP: Process each drink log chronologically
      // For achievements where unlock date = specific drink log timestamp
      // ============================================================

      const drinksByDayMap = new Map<string, number>()

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
        stats.drinksByDay[dateStr] = drinksByDayMap.get(dateStr) || 0
        stats.maxInDay = Math.max(stats.maxInDay, drinksByDayMap.get(dateStr) || 0)

        // Recalculate streaks
        const streakResult = calculateStreak(stats.daysWithDrinks)
        stats.currentStreak = streakResult.current
        stats.longestStreak = streakResult.longest
        stats.weeklyStreakCount = calculateWeeklyStreak(stats.daysWithDrinks)
        stats.monthlyStreakCount = calculateMonthlyStreak(stats.daysWithDrinks)
        stats.maxDaysInactive = calculateMaxDaysInactive(stats.daysWithDrinks)

        // Update account age (as of this log's timestamp)
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

          // Skip achievements already handled in pre-check section
          if (achievement.requirement_type === "account_age") continue
          if (achievement.requirement_type === "betatesters") continue
          if (achievement.requirement_type === "reactions_received") continue
          if (achievement.requirement_type === "first_day_log") continue
          if (achievement.requirement_type === "friend_count") continue
          if (achievement.requirement_type === "share_count") continue

          // For time/date-specific achievements, check if THIS specific log meets the requirement
          const isTimeBased = [
            "time_of_day",
            "day_of_week",
            "specific_date",
            "palindrome_time",
            "lucky_seven",
            "exact_time",
          ].includes(achievement.requirement_type)

          let met = false
          if (isTimeBased) {
            // Check if this specific log meets the requirement
            const { requirement_type, requirement_value } = achievement
            const value = requirement_value.toLowerCase()
            const hours = logDate.getHours()
            const minutes = logDate.getMinutes()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
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

              case "day_of_week": {
                const dayMap: Record<string, number> = {
                  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
                  thursday: 4, friday: 5, saturday: 6,
                }
                met = dayOfWeek === dayMap[value]
                break
              }

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
                met = dayOfMonth === 7 && drinksToday >= 7
                break
              }

              case "exact_time": {
                // Midnight on Jan 1 (within first 10 minutes)
                const monthNum = logDate.getMonth() + 1
                const dayNum = logDate.getDate()
                met = monthNum === 1 && dayNum === 1 && hours === 0 && minutes < 10
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

        // Special handling for weekend_both - check if this log completes a weekend
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
              unlockedDates.set(ua.achievement_id, log.created_at)
            }
          }
        }
      }

      // ============================================================
      // UPDATE DATABASE: Set correct unlocked_at dates
      // ============================================================

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
              achievementId: ua.achievement_id,
              odDate: ua.unlocked_at,
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
      sampleResults: results.slice(0, 20),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}