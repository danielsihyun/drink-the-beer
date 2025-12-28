import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Server not configured: missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      )
    }

    const auth = req.headers.get("authorization") || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 })

    const { q } = await req.json().catch(() => ({}))
    const query = String(q ?? "").trim()
    if (!query.length) return NextResponse.json({ items: [] })

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // Validate caller
    const { data: userRes, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const { data, error } = await admin
      .from("profile_public_stats")
      .select("id,username,display_name,avatar_path,friend_count,drink_count")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(25)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ items: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
