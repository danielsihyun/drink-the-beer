import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Helpers ──────────────────────────────────────────────────────────

function getSeasonalConfig() {
  const month = new Date().getMonth() // 0-indexed
  if (month >= 11 || month <= 1) {
    return {
      title: "Winter Warmers",
      subtitle: "Cozy cocktails for cold nights",
      emoji: "❄️",
      keywords: ["Hot Toddy", "Irish Coffee", "Mulled Wine", "Hot Chocolate", "Eggnog", "Grog", "Wassail", "Amaretto", "Baileys", "Kahlúa"],
      ingredientKeywords: ["cinnamon", "nutmeg", "honey", "cream", "coffee", "chocolate", "whiskey", "brandy"],
    }
  }
  if (month >= 2 && month <= 4) {
    return {
      title: "Spring Sips",
      subtitle: "Fresh & floral drinks for warmer days",
      emoji: "🌸",
      keywords: ["Aperol Spritz", "French 75", "Hugo", "Gin Fizz", "Mimosa", "Bellini", "Kir Royale", "Elderflower"],
      ingredientKeywords: ["elderflower", "gin", "prosecco", "champagne", "lemon", "lavender", "mint", "cucumber"],
    }
  }
  if (month >= 5 && month <= 7) {
    return {
      title: "Summer Crushes",
      subtitle: "Cool refreshers for hot days",
      emoji: "☀️",
      keywords: ["Mojito", "Piña Colada", "Daiquiri", "Margarita", "Paloma", "Caipirinha", "Sangria", "Frosé"],
      ingredientKeywords: ["rum", "tequila", "lime", "coconut", "pineapple", "watermelon", "mint", "agave"],
    }
  }
  // Aug - Oct
  return {
    title: "Autumn Favorites",
    subtitle: "Rich & warming harvest drinks",
    emoji: "🍂",
    keywords: ["Old Fashioned", "Manhattan", "Whiskey Sour", "Apple Cider", "Bourbon", "Sazerac", "Rob Roy", "Penicillin"],
    ingredientKeywords: ["bourbon", "whiskey", "apple", "cinnamon", "maple", "ginger", "bitters", "rye"],
  }
}

const COLLECTION_DEFINITIONS = [
  {
    id: "whiskey",
    name: "Whiskey Classics",
    emoji: "🥃",
    gradient: "from-amber-900/40 to-amber-600/20",
    keywords: ["whiskey", "bourbon", "rye", "scotch"],
    ingredientKeywords: ["whiskey", "bourbon", "rye", "scotch"],
  },
  {
    id: "tiki",
    name: "Tiki Time",
    emoji: "🌺",
    gradient: "from-rose-900/40 to-rose-500/20",
    keywords: ["Mai Tai", "Zombie", "Piña Colada", "Hurricane", "Blue Lagoon", "Jungle Bird", "Painkiller"],
    ingredientKeywords: ["rum", "coconut", "pineapple", "orgeat", "falernum"],
  },
  {
    id: "low-abv",
    name: "Low & No ABV",
    emoji: "🌿",
    gradient: "from-emerald-900/40 to-emerald-500/20",
    keywords: ["Spritz", "Shandy", "Radler", "Americano", "Sherry", "Vermouth"],
    ingredientKeywords: ["vermouth", "aperol", "campari", "sherry", "bitters", "soda"],
  },
  {
    id: "brunch",
    name: "Brunch Worthy",
    emoji: "🥂",
    gradient: "from-yellow-900/40 to-yellow-500/20",
    keywords: ["Mimosa", "Bellini", "Bloody Mary", "Screwdriver", "Irish Coffee", "Kir Royale", "French 75"],
    ingredientKeywords: ["champagne", "prosecco", "orange juice", "tomato", "coffee"],
  },
  {
    id: "bitter",
    name: "Bitter & Bold",
    emoji: "🍋",
    gradient: "from-orange-900/40 to-orange-500/20",
    keywords: ["Negroni", "Boulevardier", "Campari", "Aperol", "Americano", "Paper Plane"],
    ingredientKeywords: ["campari", "aperol", "amaro", "fernet", "bitter"],
  },
  {
    id: "date",
    name: "Date Night",
    emoji: "🌙",
    gradient: "from-violet-900/40 to-violet-500/20",
    keywords: ["Espresso Martini", "French 75", "Champagne Cocktail", "Aviation", "Clover Club", "Sidecar"],
    ingredientKeywords: ["champagne", "cognac", "espresso", "rose", "violet", "maraschino"],
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
      seasonalResult,
      collectionsResult,
      recommendationsResult,
      userLogsResult,
    ] = await Promise.all([
      loadTrending(),
      loadDrinkOfTheDay(),
      loadSeasonal(),
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
      seasonal: seasonalResult,
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

// ── Seasonal: real drinks matching seasonal theme ────────────────────

async function loadSeasonal() {
  const config = getSeasonalConfig()

  // Search for drinks matching seasonal keywords
  const { data: drinks } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, image_url")
    .limit(500)

  if (!drinks || drinks.length === 0) {
    return { ...config, drinks: [] }
  }

  // Match by name keywords
  const nameMatches = drinks.filter((d: any) =>
    config.keywords.some((kw) => d.name.toLowerCase().includes(kw.toLowerCase()))
  )

  // Match by ingredient keywords
  const ingredientMatches = drinks.filter((d: any) => {
    if (nameMatches.some((m: any) => m.id === d.id)) return false // avoid dupes
    // We don't have ingredients in this query, so skip for now
    return false
  })

  const matchedDrinks = [...nameMatches, ...ingredientMatches].slice(0, 8)

  return {
    title: config.title,
    subtitle: config.subtitle,
    emoji: config.emoji,
    drinks: matchedDrinks.map((d: any) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      imageUrl: d.image_url,
    })),
  }
}

// ── Collections: real counts from drinks table ──────────────────────

async function loadCollections() {
  // Get all drinks for matching
  const { data: drinks } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category")
    .limit(1000)

  if (!drinks) return COLLECTION_DEFINITIONS.map((c) => ({ ...c, count: 0 }))

  return COLLECTION_DEFINITIONS.map((col) => {
    const matches = drinks.filter((d: any) =>
      col.keywords.some((kw) => d.name.toLowerCase().includes(kw.toLowerCase()))
    )

    return {
      id: col.id,
      name: col.name,
      emoji: col.emoji,
      gradient: col.gradient,
      count: matches.length,
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
  const { data: candidates } = await supabaseAdmin
    .from("drinks")
    .select("id, name, category, image_url, ingredients")
    .in("category", topCategories.length > 0 ? topCategories : ["Cocktail"])
    .limit(300)

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

    if (score > 0 || topCategories.includes(d.category)) {
      // Build reason string
      const loggedSimilar = loggedDrinks.find((ld: any) =>
        (ld.ingredients as any[] ?? []).some((i: any) =>
          matchedIngredients.includes((i.name ?? "").toLowerCase())
        )
      )

      const reason = loggedSimilar
        ? `Because you liked ${loggedSimilar.name}`
        : `Popular ${d.category.toLowerCase()}`

      scored.push({
        id: d.id,
        name: d.name,
        category: d.category,
        imageUrl: d.image_url ?? null,
        score: score + (topCategories.includes(d.category) ? 1 : 0),
        reason,
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