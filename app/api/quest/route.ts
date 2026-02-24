import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Helpers ──────────────────────────────────────────────────

/** Get today's date string in EST (YYYY-MM-DD) */
function getEstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
}

/** Get UTC boundaries for the current EST day */
function getEstDayBounds(): { start: string; end: string } {
  const estNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  )
  const startOfDay = new Date(estNow)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(estNow)
  endOfDay.setHours(23, 59, 59, 999)

  // Convert back to UTC for querying timestamps
  const offset = new Date().getTime() - estNow.getTime()
  return {
    start: new Date(startOfDay.getTime() + offset).toISOString(),
    end: new Date(endOfDay.getTime() + offset).toISOString(),
  }
}

/** Authenticate and return user ID */
async function authenticate(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
  if (error || !user) return null
  return user.id
}

// ── GET: Today's quest + progress ───────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await authenticate(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const estToday = getEstToday()

    // Check if user already has a quest for today
    let { data: todayQuest } = await supabaseAdmin
      .from("user_quests")
      .select("*, quest:quests(*)")
      .eq("user_id", userId)
      .eq("assigned_date", estToday)
      .single()

    // If no quest today, assign one
    if (!todayQuest) {
      todayQuest = await assignQuest(userId, estToday)
      if (!todayQuest) {
        return NextResponse.json({ error: "Failed to assign quest" }, { status: 500 })
      }
    }

    const quest = todayQuest.quest as any

    // Compute progress for non-honor quests (honor uses manual completion)
    let progress = todayQuest.progress
    if (quest.detection_type !== "honor" && !todayQuest.completed) {
      progress = await computeProgress(userId, quest)

      // Update progress in DB
      if (progress !== todayQuest.progress) {
        await supabaseAdmin
          .from("user_quests")
          .update({ progress })
          .eq("id", todayQuest.id)
      }

      // Auto-complete if target reached
      if (progress >= quest.target && !todayQuest.xp_awarded) {
        const { data: xpResult } = await supabaseAdmin.rpc("award_quest_xp", {
          p_user_id: userId,
          p_user_quest_id: todayQuest.id,
        })
        todayQuest.completed = true
        todayQuest.xp_awarded = true
      }
    }

    // For honor quests that were tapped complete
    if (quest.detection_type === "honor" && todayQuest.honor_completed) {
      progress = quest.target
    }

    // Get user XP & level
    const { data: userXp } = await supabaseAdmin
      .from("user_xp")
      .select("total_xp, quests_completed")
      .eq("user_id", userId)
      .single()

    const totalXp = userXp?.total_xp ?? 0
    const { data: levelData } = await supabaseAdmin.rpc("compute_level", { xp: totalXp })
    const level = levelData ?? 1
    const { data: currentThreshold } = await supabaseAdmin.rpc("xp_for_level", { lvl: level })
    const { data: nextThreshold } = await supabaseAdmin.rpc("xp_for_level", { lvl: level + 1 })

    return NextResponse.json({
      quest: {
        id: quest.id,
        emoji: quest.emoji,
        title: quest.title,
        description: quest.description,
        target: quest.target,
        xp: quest.xp,
        difficulty: quest.difficulty,
        detectionType: quest.detection_type,
      },
      userQuest: {
        id: todayQuest.id,
        progress: Math.min(progress, quest.target),
        completed: todayQuest.completed,
        xpAwarded: todayQuest.xp_awarded,
        honorCompleted: todayQuest.honor_completed,
      },
      xp: {
        total: totalXp,
        level,
        currentLevelXp: totalXp - (currentThreshold ?? 0),
        xpToNextLevel: (nextThreshold ?? 0) - (currentThreshold ?? 0),
        questsCompleted: userXp?.quests_completed ?? 0,
      },
    })
  } catch (e: any) {
    console.error("Quest GET error:", e)
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 })
  }
}

// ── POST: Honor-complete or manual actions ──────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await authenticate(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { action } = body

    if (action === "honor_complete") {
      return await handleHonorComplete(userId)
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: any) {
    console.error("Quest POST error:", e)
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 })
  }
}

// ── Honor complete handler ──────────────────────────────────

async function handleHonorComplete(userId: string) {
  const estToday = getEstToday()

  // Get today's quest
  const { data: todayQuest } = await supabaseAdmin
    .from("user_quests")
    .select("*, quest:quests(*)")
    .eq("user_id", userId)
    .eq("assigned_date", estToday)
    .single()

  if (!todayQuest) {
    return NextResponse.json({ error: "No quest assigned today" }, { status: 404 })
  }

  const quest = todayQuest.quest as any
  if (quest.detection_type !== "honor") {
    return NextResponse.json({ error: "Quest is not honor-based" }, { status: 400 })
  }

  if (todayQuest.xp_awarded) {
    return NextResponse.json({ error: "Quest already completed" }, { status: 400 })
  }

  // Mark honor as completed
  await supabaseAdmin
    .from("user_quests")
    .update({
      honor_completed: true,
      progress: quest.target,
    })
    .eq("id", todayQuest.id)

  // Award XP
  const { data: xpResult } = await supabaseAdmin.rpc("award_quest_xp", {
    p_user_id: userId,
    p_user_quest_id: todayQuest.id,
  })

  const result = xpResult?.[0] ?? xpResult ?? {}

  return NextResponse.json({
    success: true,
    xp: {
      total: result.new_total_xp ?? 0,
      level: result.new_level ?? 1,
      leveledUp: result.leveled_up ?? false,
    },
  })
}

// ── Quest Assignment Logic ──────────────────────────────────

async function assignQuest(userId: string, estToday: string) {
  // Count how many quests user has been assigned historically
  const { count: totalAssigned } = await supabaseAdmin
    .from("user_quests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)

  // Get IDs of recently assigned quests (to avoid repeats)
  const { data: recentQuests } = await supabaseAdmin
    .from("user_quests")
    .select("quest_id")
    .eq("user_id", userId)
    .order("assigned_date", { ascending: false })
    .limit(90) // avoid repeats for ~3 months

  const recentQuestIds = new Set((recentQuests ?? []).map((q: any) => q.quest_id))

  let difficultyFilter: string | null = null

  if (totalAssigned === 0) {
    // First ever quest → easy
    difficultyFilter = "easy"
  } else if (totalAssigned === 1) {
    // Second quest → moderate
    difficultyFilter = "moderate"
  }
  // else: random from all difficulties

  // Build query for available quests
  let query = supabaseAdmin
    .from("quests")
    .select("id")
    .eq("active", true)

  if (difficultyFilter) {
    query = query.eq("difficulty", difficultyFilter)
  }

  const { data: allQuests } = await query

  if (!allQuests || allQuests.length === 0) {
    return null
  }

  // Filter out recently assigned (if pool isn't exhausted)
  let available = allQuests.filter((q: any) => !recentQuestIds.has(q.id))

  // If pool exhausted, reset and use all quests
  if (available.length === 0) {
    available = allQuests
  }

  // Pick randomly
  const pick = available[Math.floor(Math.random() * available.length)]

  // Insert assignment
  const { data: assigned, error } = await supabaseAdmin
    .from("user_quests")
    .insert({
      user_id: userId,
      quest_id: pick.id,
      assigned_date: estToday,
    })
    .select("*, quest:quests(*)")
    .single()

  if (error) {
    console.error("Quest assignment error:", error)
    return null
  }

  return assigned
}

// ── Progress Detection Engine ───────────────────────────────

async function computeProgress(userId: string, quest: any): Promise<number> {
  const bounds = getEstDayBounds()
  const { detection_type, detection_value, target } = quest

  switch (detection_type) {
    case "log_count":
      return await countLogs(userId, bounds)

    case "category_match":
      return await countLogsByCategory(userId, bounds, detection_value)

    case "ingredient_match":
      return await countLogsByIngredient(userId, bounds, detection_value)

    case "distinct_categories":
      return await countDistinctCategories(userId, bounds)

    case "cheers_given":
      return await countCheersGiven(userId, bounds)

    case "caption_count":
      return await countCaptions(userId, bounds)

    case "never_logged":
      return await countNeverLogged(userId, bounds)

    case "same_drink":
      return await countSameDrink(userId, bounds)

    case "honor":
      return 0 // handled separately via tap-to-complete

    default:
      return 0
  }
}

// ── Detection helpers ───────────────────────────────────────

/** Count total drink logs for today */
async function countLogs(userId: string, bounds: { start: string; end: string }) {
  const { count } = await supabaseAdmin
    .from("drink_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", bounds.start)
    .lte("created_at", bounds.end)

  return count ?? 0
}

/** Count drink logs matching a specific drink category */
async function countLogsByCategory(
  userId: string,
  bounds: { start: string; end: string },
  categoryValue: string,
) {
  // drink_type on drink_logs is the category enum
  const categories = categoryValue.split(",").map((c) => c.trim())

  const { count } = await supabaseAdmin
    .from("drink_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", bounds.start)
    .lte("created_at", bounds.end)
    .in("drink_type", categories)

  return count ?? 0
}

/** Count drink logs where the linked drink has a matching ingredient */
async function countLogsByIngredient(
  userId: string,
  bounds: { start: string; end: string },
  ingredientValue: string,
) {
  const keywords = ingredientValue.split(",").map((k) => k.trim().toLowerCase())

  // Get today's logs with drink_id
  const { data: logs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_id")
    .eq("user_id", userId)
    .gte("created_at", bounds.start)
    .lte("created_at", bounds.end)
    .not("drink_id", "is", null)

  if (!logs || logs.length === 0) return 0

  const drinkIds = [...new Set(logs.map((l: any) => l.drink_id))]

  // Get ingredients for these drinks
  const { data: drinks } = await supabaseAdmin
    .from("drinks")
    .select("id, ingredients")
    .in("id", drinkIds)

  if (!drinks) return 0

  // Build set of drink IDs that match any keyword
  const matchingDrinkIds = new Set<string>()
  for (const d of drinks) {
    const ings = (d.ingredients as any[] ?? []).map((i: any) => (i.name ?? "").toLowerCase())
    if (keywords.some((kw) => ings.some((ing) => ing.includes(kw)))) {
      matchingDrinkIds.add(d.id)
    }
  }

  // Count logs that reference matching drinks
  return logs.filter((l: any) => matchingDrinkIds.has(l.drink_id)).length
}

/** Count distinct drink categories logged today */
async function countDistinctCategories(userId: string, bounds: { start: string; end: string }) {
  const { data: logs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_type")
    .eq("user_id", userId)
    .gte("created_at", bounds.start)
    .lte("created_at", bounds.end)

  if (!logs) return 0
  return new Set(logs.map((l: any) => l.drink_type)).size
}

/** Count cheers the user gave today */
async function countCheersGiven(userId: string, bounds: { start: string; end: string }) {
  const { count } = await supabaseAdmin
    .from("drink_cheers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", bounds.start)
    .lte("created_at", bounds.end)

  return count ?? 0
}

/** Count drink logs with a non-empty caption today */
async function countCaptions(userId: string, bounds: { start: string; end: string }) {
  const { data: logs } = await supabaseAdmin
    .from("drink_logs")
    .select("caption")
    .eq("user_id", userId)
    .gte("created_at", bounds.start)
    .lte("created_at", bounds.end)

  if (!logs) return 0
  return logs.filter((l: any) => l.caption && l.caption.trim().length > 0).length
}

/** Count drinks logged today that the user has never logged before today */
async function countNeverLogged(userId: string, bounds: { start: string; end: string }) {
  // Get today's logged drink IDs
  const { data: todayLogs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_id")
    .eq("user_id", userId)
    .gte("created_at", bounds.start)
    .lte("created_at", bounds.end)
    .not("drink_id", "is", null)

  if (!todayLogs || todayLogs.length === 0) return 0

  const todayDrinkIds = [...new Set(todayLogs.map((l: any) => l.drink_id))]

  // Get all drink IDs the user has ever logged BEFORE today
  const { data: historicLogs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_id")
    .eq("user_id", userId)
    .lt("created_at", bounds.start)
    .not("drink_id", "is", null)

  const historicDrinkIds = new Set((historicLogs ?? []).map((l: any) => l.drink_id))

  // Count today's drinks that aren't in historic set
  return todayDrinkIds.filter((id) => !historicDrinkIds.has(id)).length
}

/** Count max occurrences of any single drink_id today (for "same drink twice") */
async function countSameDrink(userId: string, bounds: { start: string; end: string }) {
  const { data: logs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_id")
    .eq("user_id", userId)
    .gte("created_at", bounds.start)
    .lte("created_at", bounds.end)
    .not("drink_id", "is", null)

  if (!logs || logs.length === 0) return 0

  const counts: Record<string, number> = {}
  for (const l of logs) {
    counts[l.drink_id] = (counts[l.drink_id] || 0) + 1
  }

  return Math.max(...Object.values(counts))
}