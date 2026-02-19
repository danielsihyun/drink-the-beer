import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Helpers ──────────────────────────────────────────────────────────

const COLLECTION_DEFINITIONS = [
  {
    id: "beer-brews",
    name: "Beers & Brews",
    emoji: "🍺",
    gradient: "from-amber-900/40 to-yellow-600/20",
    categories: ["Beer"],
    nameKeywords: ["ale", "lager", "ipa", "stout", "pilsner", "porter", "wheat", "amber", "draught"],
    ingredientKeywords: [],
  },
  {
    id: "wine-bubbly",
    name: "Wine & Bubbly",
    emoji: "🍷",
    gradient: "from-rose-900/40 to-rose-500/20",
    categories: ["Wine"],
    nameKeywords: ["champagne", "prosecco", "cava", "mimosa", "bellini", "sangria", "kir", "spritz"],
    ingredientKeywords: ["wine", "champagne", "prosecco"],
  },
  {
    id: "spirit-neat",
    name: "Spirits & Sippers",
    emoji: "🥃",
    gradient: "from-orange-900/40 to-orange-600/20",
    categories: ["Spirit"],
    nameKeywords: ["whiskey", "bourbon", "scotch", "rye", "cognac", "brandy", "mezcal", "tequila", "rum", "vodka", "gin", "sake", "soju", "baijiu"],
    ingredientKeywords: [],
  },
  {
    id: "refreshers",
    name: "Light & Refreshing",
    emoji: "🧊",
    gradient: "from-sky-900/40 to-cyan-500/20",
    categories: ["Seltzer"],
    nameKeywords: ["spritz", "mojito", "paloma", "daiquiri", "gimlet", "collins", "fizz", "cooler", "shandy", "radler", "highball", "soda", "tonic", "lemonade", "mule"],
    ingredientKeywords: ["soda", "tonic", "lime juice", "lemon juice", "club soda", "ginger beer", "sparkling"],
  },
  {
    id: "classic-cocktails",
    name: "Classic Cocktails",
    emoji: "🍸",
    gradient: "from-violet-900/40 to-violet-500/20",
    categories: [],
    nameKeywords: ["martini", "manhattan", "old fashioned", "negroni", "margarita", "sidecar", "sazerac", "cosmopolitan", "alexander", "sour", "mai tai", "boulevardier", "aviation", "last word", "french 75", "espresso martini", "bloody mary", "caipirinha", "piña colada", "hurricane", "zombie"],
    ingredientKeywords: [],
  },
  {
    id: "shots-party",
    name: "Shots & Party",
    emoji: "🎉",
    gradient: "from-fuchsia-900/40 to-pink-500/20",
    categories: ["Shot"],
    nameKeywords: ["shot", "bomb", "jäger", "fireball", "shooter", "slammer", "kamikaze", "b-52", "buttery nipple", "punch", "jungle juice"],
    ingredientKeywords: [],
  },
]

// ── Main handler ────────────────────────────────────────────────────

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

    // ── Run all queries in parallel ──────────────────────────────

    const [
      trendingResult,
      drinkOfDayResult,
      collectionsResult,
      recommendationsResult,
      userLogsResult,
    ] = await Promise.all([
      loadTrending(),
      loadDrinkOfTheDay(),
      loadCollections(),
      loadRecommendations(userId),
      // For recommendations we need user's logged drink IDs
      supabaseAdmin
        .from("drink_logs")
        .select("drink_id, drink_type")
        .eq("user_id", userId)
        .not("drink_id", "is", null)
        .limit(500),
    ])

    return NextResponse.json({
      trending: trendingResult,
      drinkOfTheDay: drinkOfDayResult,
      collections: collectionsResult,
      recommendations: recommendationsResult,
    })
  } catch (e: any) {
    console.error("Discover API error:", e)
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 })
  }
}

// ── Trending: specific drink names, last 7 days vs prior 7 ──────────

async function loadTrending() {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Get recent logs with drink names
  const { data: recentLogs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_id, drink_type, created_at")
    .gte("created_at", twoWeeksAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000)

  if (!recentLogs || recentLogs.length === 0) return []

  // Count by drink_id (specific drinks) this week vs last week
  const thisWeekById: Record<string, number> = {}
  const lastWeekById: Record<string, number> = {}
  // Fallback: count by category for logs without drink_id
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

  // Get drink names for all referenced drink IDs
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

  // Build trending list from specific drinks
  type TrendingItem = {
    id: string | null
    name: string
    category: string
    imageUrl: string | null
    count: number
    percentChange: number | null
  }

  const items: TrendingItem[] = []

  // Specific drinks
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

  // Category fallbacks (for logs without drink_id)
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

// ── Drink of the Day: seeded deterministic pick from popular drinks ──

async function loadDrinkOfTheDay() {
  // Use today's date as seed for deterministic daily pick
  const today = new Date()
  const dayIndex = Math.floor(today.getTime() / (24 * 60 * 60 * 1000))

  // Get cocktails with images (better for display)
  const { data: drinks } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, image_url, glass, instructions, ingredients")
    .eq("category", "Cocktail")
    .not("image_url", "is", null)
    .not("instructions", "is", null)
    .limit(500)

  if (!drinks || drinks.length === 0) return null

  const pick = drinks[dayIndex % drinks.length]

  // Build a short description from ingredients
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

// ── Collections: real counts from drinks table ──────────────────────

async function loadCollections() {
  // Get all drinks for matching (include ingredients for broader matching)
  const { data: drinks } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, ingredients")
    .limit(1500)

  if (!drinks) return COLLECTION_DEFINITIONS.map((c) => ({ ...c, count: 0 }))

  return COLLECTION_DEFINITIONS.map((col) => {
    const matchedIds = new Set<string>()

    for (const d of drinks as any[]) {
      // Match by category
      if (col.categories.length > 0 && col.categories.includes(d.category)) {
        matchedIds.add(d.id)
        continue
      }

      // Match by drink name keywords
      const nameLower = (d.name ?? "").toLowerCase()
      if (col.nameKeywords.some((kw) => nameLower.includes(kw.toLowerCase()))) {
        matchedIds.add(d.id)
        continue
      }

      // Match by ingredient keywords
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

// ── Recommendations: drinks similar to what user has logged ─────────

async function loadRecommendations(userId: string) {
  // Get user's logged drinks
  const { data: userLogs } = await supabaseAdmin
    .from("drink_logs")
    .select("drink_id, drink_type")
    .eq("user_id", userId)
    .not("drink_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200)

  if (!userLogs || userLogs.length === 0) {
    // Fallback: recommend popular drinks
    return loadPopularDrinksAsRecommendations()
  }

  const loggedDrinkIds = new Set(userLogs.map((l: any) => l.drink_id).filter(Boolean))

  // Get details of logged drinks to find their categories and ingredients
  const { data: loggedDrinks } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, ingredients")
    .in("id", [...loggedDrinkIds])

  if (!loggedDrinks || loggedDrinks.length === 0) {
    return loadPopularDrinksAsRecommendations()
  }

  // Find most-logged categories
  const catCount: Record<string, number> = {}
  for (const log of userLogs) {
    catCount[log.drink_type] = (catCount[log.drink_type] || 0) + 1
  }
  const topCategories = Object.entries(catCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([cat]) => cat)

  // Collect ingredient names from logged drinks for similarity
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

  // Find drinks user hasn't tried, in their preferred categories
  // Fetch all drinks (not limited) to avoid alphabetical bias from insertion order
  const { data: candidates } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, image_url, ingredients")
    .in("category", topCategories.length > 0 ? topCategories : ["Cocktail"])

  if (!candidates || candidates.length === 0) {
    return loadPopularDrinksAsRecommendations()
  }

  // Score candidates by ingredient overlap
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
    if (loggedDrinkIds.has(d.id)) continue // skip already logged

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
      // Build reason string from the best matching logged drink
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

  // If ingredient matching produced too few results, add some category matches
  if (scored.length < 5) {
    // Shuffle remaining unscored candidates from same categories
    const scoredIds = new Set(scored.map((s) => s.id))
    const remaining = candidates.filter(
      (d: any) => !loggedDrinkIds.has(d.id) && !scoredIds.has(d.id)
    )

    // Deterministic daily shuffle so results don't change on every page load
    const daySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000))
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
  // Count most-logged drinks globally
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