import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Must match the definitions in /api/discover/route.ts
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

// Word-boundary-aware matching for name keywords
function nameMatchesKeyword(drinkName: string, keyword: string): boolean {
  const kwLower = keyword.toLowerCase()
  if (kwLower.includes(" ") || kwLower.length > 5) {
    return drinkName.toLowerCase().includes(kwLower)
  }
  const re = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
  return re.test(drinkName)
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: collectionId } = await context.params
    const col = COLLECTION_DEFINITIONS.find((c) => c.id === collectionId)
    if (!col) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 })
    }

    // Fetch all drinks
    const { data: drinks } = await supabaseAdmin
      .from("drinks")
      .select("id, name, category, image_url")
      .limit(1500)

    if (!drinks) {
      return NextResponse.json({
        collection: { id: col.id, name: col.name, emoji: col.emoji, gradient: col.gradient },
        drinks: [],
      })
    }

    // Match drinks to this collection using same logic as discover route
    const matched: { id: string; name: string; category: string; imageUrl: string | null }[] = []
    const seenIds = new Set<string>()

    for (const d of drinks as any[]) {
      if (seenIds.has(d.id)) continue

      let isMatch = false

      // Match by category
      if (col.categories.length > 0 && col.categories.includes(d.category)) {
        isMatch = true
      }

      // Match by drink name keywords
      if (!isMatch) {
        if (col.nameKeywords.some((kw) => nameMatchesKeyword(d.name ?? "", kw))) {
          isMatch = true
        }
      }

      // Match by ingredient keywords (not available in this lighter query, skip)

      if (isMatch) {
        seenIds.add(d.id)
        matched.push({
          id: d.id,
          name: d.name,
          category: d.category,
          imageUrl: d.image_url ?? null,
        })
      }
    }

    // Sort alphabetically
    matched.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      collection: {
        id: col.id,
        name: col.name,
        emoji: col.emoji,
        gradient: col.gradient,
      },
      drinks: matched,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load collection" }, { status: 500 })
  }
}