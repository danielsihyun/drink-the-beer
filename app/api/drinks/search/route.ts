import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get("q")?.trim() ?? ""
    const category = url.searchParams.get("category") ?? null
    const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 30)

    if (q.length < 1) {
      return NextResponse.json({ items: [] }, { status: 200 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server misconfigured." }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // Use the RPC function for fast prefix search
    const { data, error } = await supabase.rpc("search_drinks", {
      query: q,
      category_filter: category,
      result_limit: limit,
    })

    if (error) throw error

    return NextResponse.json({ items: data ?? [] }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Search failed." }, { status: 500 })
  }
}