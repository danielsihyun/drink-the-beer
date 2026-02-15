// ============================================================
// Seed script: Populate the drinks table
// Run with: npx tsx scripts/seed-drinks.ts
// Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
// ============================================================

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

// ── TheCocktailDB helpers ──────────────────────────────────────

const COCKTAILDB_BASE = "https://www.thecocktaildb.com/api/json/v1/1"

type CocktailDBDrink = Record<string, string | null>

function extractIngredients(drink: CocktailDBDrink): { name: string; measure: string }[] {
  const ingredients: { name: string; measure: string }[] = []
  for (let i = 1; i <= 15; i++) {
    const name = drink[`strIngredient${i}`]?.trim()
    const measure = drink[`strMeasure${i}`]?.trim() || ""
    if (name) {
      ingredients.push({ name, measure })
    }
  }
  return ingredients
}

async function fetchCocktailsByLetter(letter: string): Promise<CocktailDBDrink[]> {
  try {
    const res = await fetch(`${COCKTAILDB_BASE}/search.php?f=${letter}`)
    const json = await res.json()
    return json.drinks ?? []
  } catch (e) {
    console.warn(`Failed to fetch letter ${letter}:`, e)
    return []
  }
}

async function fetchAllCocktails(): Promise<CocktailDBDrink[]> {
  const letters = "abcdefghijklmnopqrstuvwxyz0123456789".split("")
  const all: CocktailDBDrink[] = []

  for (const letter of letters) {
    const drinks = await fetchCocktailsByLetter(letter)
    all.push(...drinks)
    // Rate limit: TheCocktailDB free tier
    await new Promise((r) => setTimeout(r, 250))
  }

  // Deduplicate by ID
  const seen = new Set<string>()
  return all.filter((d) => {
    const id = d.idDrink
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

// ── Static seed data ───────────────────────────────────────────

const COMMON_BEERS = [
  "Budweiser", "Bud Light", "Coors Light", "Miller Lite", "Corona Extra",
  "Heineken", "Stella Artois", "Guinness Draught", "Blue Moon Belgian White",
  "Sierra Nevada Pale Ale", "Sam Adams Boston Lager", "Modelo Especial",
  "Dos Equis Lager", "Lagunitas IPA", "Dogfish Head 60 Minute IPA",
  "Bell's Two Hearted Ale", "Stone IPA", "Founders All Day IPA",
  "Voodoo Ranger IPA", "Elysian Space Dust IPA", "Goose Island IPA",
  "Fat Tire Amber Ale", "Yuengling Lager", "PBR (Pabst Blue Ribbon)",
  "Michelob Ultra", "Busch Light", "Natural Light", "Keystone Light",
  "Sapporo Premium", "Asahi Super Dry", "Kirin Ichiban", "Peroni Nastro Azzurro",
  "Pilsner Urquell", "Hoegaarden", "Chimay Blue", "Duvel", "Delirium Tremens",
  "Pliny the Elder", "Heady Topper", "Tree House Julius",
]

const COMMON_WINES = [
  "Cabernet Sauvignon", "Merlot", "Pinot Noir", "Chardonnay", "Sauvignon Blanc",
  "Pinot Grigio", "Rosé", "Riesling", "Moscato", "Malbec",
  "Syrah / Shiraz", "Zinfandel", "Tempranillo", "Sangiovese", "Grenache",
  "Prosecco", "Champagne", "Cava", "Lambrusco", "Gewürztraminer",
  "Viognier", "Chenin Blanc", "Sémillon", "Albariño", "Grüner Veltliner",
  "Port", "Sherry", "Madeira", "Vermouth (Sweet)", "Vermouth (Dry)",
]

const COMMON_SPIRITS = [
  "Vodka", "Gin", "Rum (White)", "Rum (Dark)", "Rum (Spiced)",
  "Tequila Blanco", "Tequila Reposado", "Tequila Añejo", "Mezcal",
  "Bourbon", "Rye Whiskey", "Scotch (Single Malt)", "Scotch (Blended)",
  "Irish Whiskey", "Japanese Whisky", "Canadian Whisky",
  "Cognac", "Brandy", "Armagnac", "Grappa", "Pisco",
  "Absinthe", "Aquavit", "Baijiu", "Soju", "Sake",
  "Kahlúa", "Baileys Irish Cream", "Amaretto", "Campari", "Aperol",
  "Chartreuse (Green)", "Chartreuse (Yellow)", "St-Germain", "Cointreau", "Grand Marnier",
  "Fernet-Branca", "Jägermeister", "Fireball",
]

const COMMON_SELTZERS = [
  "White Claw Hard Seltzer", "Truly Hard Seltzer", "Bud Light Seltzer",
  "Vizzy Hard Seltzer", "Topo Chico Hard Seltzer", "High Noon Sun Sips",
  "Cacti Hard Seltzer", "Press Premium Alcohol Seltzer", "Bon & Viv Spiked Seltzer",
  "Corona Hard Seltzer", "Michelob Ultra Organic Seltzer",
]

const COMMON_SHOTS = [
  "Jägerbomb", "Lemon Drop Shot", "Kamikaze", "B-52",
  "Buttery Nipple", "Irish Car Bomb", "Washington Apple",
  "Fireball Shot", "Tequila Shot", "Vodka Shot", "Rumple Minze Shot",
  "Green Tea Shot", "Pickle Back", "Baby Guinness",
]

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("🍹 Starting drink seed...\n")

  // Check if already seeded
  const { count } = await supabase.from("drinks").select("*", { count: "exact", head: true })
  if (count && count > 50) {
    console.log(`Database already has ${count} drinks. Skipping seed.`)
    console.log("To re-seed, clear the drinks table first: DELETE FROM drinks;")
    return
  }

  // 1. Fetch cocktails from TheCocktailDB
  console.log("Fetching cocktails from TheCocktailDB...")
  const cocktails = await fetchAllCocktails()
  console.log(`Found ${cocktails.length} cocktails\n`)

  const cocktailRows = cocktails.map((d) => ({
    name: d.strDrink ?? "Unknown",
    category: "Cocktail",
    image_url: d.strDrinkThumb ?? null,
    glass: d.strGlass ?? null,
    instructions: d.strInstructions ?? null,
    ingredients: extractIngredients(d),
    source: "cocktaildb",
  }))

  // 2. Build static rows
  const staticRows = [
    ...COMMON_BEERS.map((name) => ({ name, category: "Beer", image_url: null, glass: null, instructions: null, ingredients: [], source: "seed" })),
    ...COMMON_WINES.map((name) => ({ name, category: "Wine", image_url: null, glass: null, instructions: null, ingredients: [], source: "seed" })),
    ...COMMON_SPIRITS.map((name) => ({ name, category: "Spirit", image_url: null, glass: null, instructions: null, ingredients: [], source: "seed" })),
    ...COMMON_SELTZERS.map((name) => ({ name, category: "Seltzer", image_url: null, glass: null, instructions: null, ingredients: [], source: "seed" })),
    ...COMMON_SHOTS.map((name) => ({ name, category: "Shot", image_url: null, glass: null, instructions: null, ingredients: [], source: "seed" })),
  ]

  const allRows = [...cocktailRows, ...staticRows]
  console.log(`Total drinks to insert: ${allRows.length}`)
  console.log(`  Cocktails: ${cocktailRows.length}`)
  console.log(`  Beers: ${COMMON_BEERS.length}`)
  console.log(`  Wines: ${COMMON_WINES.length}`)
  console.log(`  Spirits: ${COMMON_SPIRITS.length}`)
  console.log(`  Seltzers: ${COMMON_SELTZERS.length}`)
  console.log(`  Shots: ${COMMON_SHOTS.length}\n`)

  // 3. Insert in batches of 100
  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from("drinks").insert(batch)

    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error.message)
    } else {
      inserted += batch.length
      process.stdout.write(`  Inserted ${inserted}/${allRows.length}\r`)
    }
  }

  console.log(`\n\n✅ Seed complete! ${inserted} drinks added.`)
}

main().catch(console.error)