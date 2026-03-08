import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getBatchSignedUrls } from "@/lib/signed-url-cache"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Helpers ──────────────────────────────────────────────────────────

function getEstDayIndex(): number {
  const estNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  )
  return (
    estNow.getFullYear() * 10000 +
    (estNow.getMonth() + 1) * 100 +
    estNow.getDate()
  )
}

const COLLECTION_DEFINITIONS = [
  {
    id: "beer-brews",
    name: "Beers & Brews",
    emoji: "🍺",
    gradient: "from-amber-900/40 to-yellow-600/20",
    categories: ["Beer"],
    nameKeywords: [],
    ingredientKeywords: [],
  },
  {
    id: "wine-bubbly",
    name: "Wine & Bubbly",
    emoji: "🍷",
    gradient: "from-rose-900/40 to-rose-500/20",
    categories: ["Wine"],
    nameKeywords: ["champagne", "prosecco", "cava", "mimosa", "bellini", "sangria", "kir royale", "spritz"],
    ingredientKeywords: ["wine", "champagne", "prosecco"],
  },
  {
    id: "spirit-neat",
    name: "Spirits & Sippers",
    emoji: "🥃",
    gradient: "from-orange-900/40 to-orange-600/20",
    categories: ["Spirit"],
    nameKeywords: [],
    ingredientKeywords: [],
  },
  {
    id: "refreshers",
    name: "Light & Refreshing",
    emoji: "🧊",
    gradient: "from-sky-900/40 to-cyan-500/20",
    categories: ["Seltzer"],
    nameKeywords: ["mojito", "paloma", "daiquiri", "gimlet", "tom collins", "gin fizz", "vodka fizz", "whiskey fizz", "cooler", "shandy", "radler", "highball", "mule", "hugo", "lemonade", "rickey"],
    ingredientKeywords: [],
  },
  {
    id: "classic-cocktails",
    name: "Classic Cocktails",
    emoji: "🍸",
    gradient: "from-violet-900/40 to-violet-500/20",
    categories: [],
    nameKeywords: ["martini", "manhattan", "old fashioned", "negroni", "margarita", "sidecar", "sazerac", "cosmopolitan", "alexander", "whiskey sour", "amaretto sour", "pisco sour", "mai tai", "boulevardier", "aviation", "last word", "french 75", "espresso martini", "bloody mary", "caipirinha", "piña colada", "hurricane", "zombie", "rob roy", "rusty nail", "long island", "tequila sunrise", "cuba libre", "dark and stormy", "gin and tonic", "irish coffee"],
    ingredientKeywords: [],
  },
  {
    id: "shots-party",
    name: "Shots & Party",
    emoji: "🎉",
    gradient: "from-fuchsia-900/40 to-pink-500/20",
    categories: ["Shot"],
    nameKeywords: ["shot", "bomb", "jägerbomb", "fireball", "shooter", "slammer", "kamikaze", "b-52", "buttery nipple", "punch", "jungle juice"],
    ingredientKeywords: [],
  },
]

function nameMatchesKeyword(drinkName: string, keyword: string): boolean {
  const nameLower = drinkName.toLowerCase()
  const kwLower = keyword.toLowerCase()
  if (kwLower.includes(" ") || kwLower.length > 5) {
    return nameLower.includes(kwLower)
  }
  const re = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
  return re.test(drinkName)
}

// ── Main handler ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id

    // Fetch friendships first — needed by both suggested and recommendations
    const { data: friendships } = await supabaseAdmin
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted")
      .limit(500)

    const friendIds = (friendships ?? []).map((r: { requester_id: string; addressee_id: string }) =>
      r.requester_id === userId ? r.addressee_id : r.requester_id
    )
    const friendIdSet = new Set(friendIds)

    // Run all sections in parallel
    const [
      trendingResult,
      drinkOfDayResult,
      collectionsResult,
      recommendationsResult,
      suggestedResult,
    ] = await Promise.all([
      loadTrending(),
      loadDrinkOfTheDay(),
      loadCollections(),
      loadRecommendations(userId),
      loadSuggested(userId, friendIdSet),
    ])

    return NextResponse.json({
      trending: trendingResult,
      drinkOfTheDay: drinkOfDayResult,
      collections: collectionsResult,
      recommendations: recommendationsResult,
      suggested: suggestedResult,
      // Return friend IDs so the client doesn't need a separate friendships query
      friendIds,
    })
  } catch (e: any) {
    console.error("Discover API error:", e)
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 })
  }
}

// ── Suggested people (friends of friends) ────────────────────────────

async function loadSuggested(userId: string, friendIdSet: Set<string>) {
  if (friendIdSet.size === 0) return []

  const friendIdArray = Array.from(friendIdSet)

  // Friends-of-friends
  const { data: fofRows } = await supabaseAdmin
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(
      friendIdArray.map((id) => `requester_id.eq.${id}`).join(",") +
      "," +
      friendIdArray.map((id) => `addressee_id.eq.${id}`).join(",")
    )
    .limit(500)

  const mutualCounts: Record<string, number> = {}

  for (const row of fofRows ?? []) {
    const personA = row.requester_id
    const personB = row.addressee_id

    if (friendIdSet.has(personA) && personB !== userId && !friendIdSet.has(personB)) {
      mutualCounts[personB] = (mutualCounts[personB] || 0) + 1
    }
    if (friendIdSet.has(personB) && personA !== userId && !friendIdSet.has(personA)) {
      mutualCounts[personA] = (mutualCounts[personA] || 0) + 1
    }
  }

  const topSuggestions = Object.entries(mutualCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  if (topSuggestions.length === 0) return []

  const suggestedIds = topSuggestions.map(([id]) => id)
  const mutualMap = new Map(topSuggestions)

  // Profiles + pending status in parallel
  const [profilesRes, pendingRes] = await Promise.all([
    supabaseAdmin
      .from("profile_public_stats")
      .select("id, username, display_name, avatar_path, friend_count, drink_count")
      .in("id", suggestedIds),
    supabaseAdmin
      .from("friendships")
      .select("addressee_id")
      .eq("requester_id", userId)
      .eq("status", "pending")
      .in("addressee_id", suggestedIds),
  ])

  const profiles = profilesRes.data ?? []
  const pendingOutIds = new Set((pendingRes.data ?? []).map((r: any) => r.addressee_id))

  // Batch avatar signed URLs
  const avatarPaths = profiles.map((p: any) => p.avatar_path).filter(Boolean) as string[]
  const uniqueAvatarPaths = [...new Set(avatarPaths)]
  const avatarUrls = await getBatchSignedUrls(supabaseAdmin, "profile-photos", uniqueAvatarPaths, 60 * 60)

  const avatarUrlMap = new Map<string, string | null>()
  for (let i = 0; i < uniqueAvatarPaths.length; i++) {
    avatarUrlMap.set(uniqueAvatarPaths[i], avatarUrls[i])
  }

  return profiles.map((p: any) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_path ? (avatarUrlMap.get(p.avatar_path) ?? null) : null,
    friendCount: p.friend_count ?? 0,
    drinkCount: p.drink_count ?? 0,
    cheersCount: 0,
    mutualCount: mutualMap.get(p.id) ?? 0,
    outgoingPending: pendingOutIds.has(p.id),
  })).sort((a: any, b: any) => b.mutualCount - a.mutualCount)
}

// ── Trending ─────────────────────────────────────────────────────────

async function loadTrending() {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const { data: recentLogs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_id, drink_type, created_at")
    .gte("created_at", twoWeeksAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000)

  if (!recentLogs || recentLogs.length === 0) return []

  const thisWeekById: Record<string, number> = {}
  const lastWeekById: Record<string, number> = {}
  const thisWeekByCat: Record<string, number> = {}
  const lastWeekByCat: Record<string, number> = {}

  for (const log of recentLogs) {
    const logDate = new Date(log.created_at)
    const isThisWeek = logDate >= weekAgo

    if (log.drink_id) {
      const map = isThisWeek ? thisWeekById : lastWeekById
      map[log.drink_id] = (map[log.drink_id] || 0) + 1
    } else {
      const map = isThisWeek ? thisWeekByCat : lastWeekByCat
      map[log.drink_type] = (map[log.drink_type] || 0) + 1
    }
  }

  const allDrinkIds = [...new Set([...Object.keys(thisWeekById), ...Object.keys(lastWeekById)])]
  let drinkNameMap = new Map<string, { name: string; category: string; image_url: string | null }>()

  if (allDrinkIds.length > 0) {
    const { data: drinks } = await supabaseAdmin
      .from("drinks")
      .select("id, name, category, image_url")
      .in("id", allDrinkIds)

    drinkNameMap = new Map(
      (drinks ?? []).map((d: any) => [d.id, { name: d.name, category: d.category, image_url: d.image_url }])
    )
  }

  type TrendingItem = {
    id: string | null
    name: string
    category: string
    imageUrl: string | null
    count: number
    percentChange: number | null
  }

  const items: TrendingItem[] = []

  const allIds = new Set([...Object.keys(thisWeekById), ...Object.keys(lastWeekById)])
  for (const id of allIds) {
    const current = thisWeekById[id] || 0
    if (current === 0) continue
    const previous = lastWeekById[id] || 0
    const percentChange = previous > 0
      ? Math.round(((current - previous) / previous) * 100)
      : current > 0 ? 100 : null

    const info = drinkNameMap.get(id)
    items.push({
      id,
      name: info?.name ?? "Unknown",
      category: info?.category ?? "Other",
      imageUrl: info?.image_url ?? null,
      count: current,
      percentChange,
    })
  }

  const allCats = new Set([...Object.keys(thisWeekByCat), ...Object.keys(lastWeekByCat)])
  for (const cat of allCats) {
    const current = thisWeekByCat[cat] || 0
    if (current === 0) continue
    const previous = lastWeekByCat[cat] || 0
    const percentChange = previous > 0
      ? Math.round(((current - previous) / previous) * 100)
      : current > 0 ? 100 : null

    items.push({
      id: null,
      name: cat,
      category: cat,
      imageUrl: null,
      count: current,
      percentChange,
    })
  }

  items.sort((a, b) => b.count - a.count)
  return items.slice(0, 6)
}

// ── Drink of the Day ─────────────────────────────────────────────────

async function loadDrinkOfTheDay() {
  const dayIndex = getEstDayIndex()

  const { data: drinks } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, image_url, glass, instructions, ingredients")
    .eq("category", "Cocktail")
    .not("image_url", "is", null)
    .not("instructions", "is", null)
    .limit(500)

  if (!drinks || drinks.length === 0) return null

  const pick = drinks[dayIndex % drinks.length]

  const ingredients = (pick.ingredients as any[] ?? [])
    .slice(0, 3)
    .map((i: any) => i.name)
    .filter(Boolean)

  const description = ingredients.length > 0
    ? `${ingredients.join(" · ")} — ${pick.glass ? `Served in a ${pick.glass}` : "A classic cocktail"}`
    : pick.glass ? `Served in a ${pick.glass}` : "A classic cocktail"

  return {
    id: pick.id,
    name: pick.name,
    category: pick.category,
    imageUrl: pick.image_url,
    description,
    instructions: pick.instructions,
  }
}

// ── Collections ──────────────────────────────────────────────────────

async function loadCollections() {
  const { data: drinks } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, ingredients")
    .limit(1500)

  if (!drinks) return COLLECTION_DEFINITIONS.map((c) => ({ ...c, count: 0 }))

  return COLLECTION_DEFINITIONS.map((col) => {
    const matchedIds = new Set<string>()

    for (const d of drinks as any[]) {
      if (col.categories.length > 0 && col.categories.includes(d.category)) {
        matchedIds.add(d.id)
        continue
      }
      if (col.nameKeywords.some((kw) => nameMatchesKeyword(d.name ?? "", kw))) {
        matchedIds.add(d.id)
        continue
      }
      if (col.ingredientKeywords.length > 0) {
        const ings = (d.ingredients as any[] ?? []).map((i: any) => (i.name ?? "").toLowerCase())
        if (col.ingredientKeywords.some((kw) => ings.some((ing) => ing.includes(kw.toLowerCase())))) {
          matchedIds.add(d.id)
        }
      }
    }

    return {
      id: col.id,
      name: col.name,
      emoji: col.emoji,
      gradient: col.gradient,
      count: matchedIds.size,
    }
  })
}

// ── Recommendations ──────────────────────────────────────────────────

async function loadRecommendations(userId: string) {
  const { data: userLogs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_id, drink_type")
    .eq("user_id", userId)
    .not("drink_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200)

  if (!userLogs || userLogs.length === 0) {
    return loadPopularDrinksAsRecommendations()
  }

  const loggedDrinkIds = new Set(userLogs.map((l: any) => l.drink_id).filter(Boolean))

  const { data: loggedDrinks } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, ingredients")
    .in("id", [...loggedDrinkIds])

  if (!loggedDrinks || loggedDrinks.length === 0) {
    return loadPopularDrinksAsRecommendations()
  }

  const catCount: Record<string, number> = {}
  for (const log of userLogs) {
    catCount[log.drink_type] = (catCount[log.drink_type] || 0) + 1
  }
  const topCategories = Object.entries(catCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([cat]) => cat)

  const ingredientFreq: Record<string, number> = {}
  for (const d of loggedDrinks) {
    const ings = (d.ingredients as any[] ?? [])
    for (const ing of ings) {
      const name = (ing.name ?? "").toLowerCase()
      if (name) ingredientFreq[name] = (ingredientFreq[name] || 0) + 1
    }
  }
  const topIngredients = Object.entries(ingredientFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name]) => name)

  const { data: candidates } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, image_url, ingredients")
    .in("category", topCategories.length > 0 ? topCategories : ["Cocktail"])

  if (!candidates || candidates.length === 0) {
    return loadPopularDrinksAsRecommendations()
  }

  type ScoredDrink = {
    id: string
    name: string
    category: string
    imageUrl: string | null
    score: number
    reason: string
  }

  const scored: ScoredDrink[] = []

  for (const d of candidates) {
    if (loggedDrinkIds.has(d.id)) continue

    const ings = (d.ingredients as any[] ?? []).map((i: any) => (i.name ?? "").toLowerCase())
    let score = 0
    const matchedIngredients: string[] = []

    for (const ing of ings) {
      if (topIngredients.includes(ing)) {
        score += ingredientFreq[ing] ?? 1
        matchedIngredients.push(ing)
      }
    }

    if (score > 0) {
      const loggedSimilar = loggedDrinks.find((ld: any) =>
        (ld.ingredients as any[] ?? []).some((i: any) =>
          matchedIngredients.includes((i.name ?? "").toLowerCase())
        )
      )

      scored.push({
        id: d.id,
        name: d.name,
        category: d.category,
        imageUrl: d.image_url ?? null,
        score,
        reason: loggedSimilar
          ? `Because you liked ${loggedSimilar.name}`
          : `Popular ${d.category.toLowerCase()}`,
      })
    }
  }

  if (scored.length < 5) {
    const scoredIds = new Set(scored.map((s) => s.id))
    const remaining = candidates.filter(
      (d: any) => !loggedDrinkIds.has(d.id) && !scoredIds.has(d.id)
    )

    const daySeed = getEstDayIndex()
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = (daySeed * (i + 1) * 2654435761) % (i + 1)
      const abs = Math.abs(j)
      ;[remaining[i], remaining[abs]] = [remaining[abs], remaining[i]]
    }

    for (const d of remaining.slice(0, 5 - scored.length)) {
      scored.push({
        id: d.id,
        name: d.name,
        category: d.category,
        imageUrl: d.image_url ?? null,
        score: 0,
        reason: `Popular ${d.category.toLowerCase()}`,
      })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 5).map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    imageUrl: d.imageUrl,
    reason: d.reason,
  }))
}

async function loadPopularDrinksAsRecommendations() {
  const { data: logs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_id")
    .not("drink_id", "is", null)
    .limit(2000)

  const countById: Record<string, number> = {}
  for (const l of (logs ?? [])) {
    if (l.drink_id) countById[l.drink_id] = (countById[l.drink_id] || 0) + 1
  }

  const topIds = Object.entries(countById)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id)

  if (topIds.length === 0) return []

  const { data: drinks } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, image_url")
    .in("id", topIds)

  return (drinks ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    imageUrl: d.image_url,
    reason: "Popular with everyone",
  }))
}