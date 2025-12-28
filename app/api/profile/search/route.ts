// app/api/profile/search/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // make sure this exists in env
  {
    auth: { persistSession: false },
  }
)

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : ""

    if (!token) {
      return NextResponse.json({ error: "Missing Authorization token." }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const meId = userRes.user.id
    const body = await req.json().catch(() => ({}))
    const q = String(body?.q ?? "").trim()

    if (!q) {
      return NextResponse.json({ items: [] })
    }

    // 1) Search profiles (your existing view/table)
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profile_public_stats")
      .select("id,username,display_name,avatar_path,friend_count,drink_count")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(25)

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 })
    }

    const base = (profiles ?? []).filter((p) => p.id !== meId)
    const ids = base.map((p) => p.id)

    // 2) Pull outgoing pending requests for just these ids
    // ⚠️ Adjust table/column names below if your schema differs.
    // Expected: friendships table with requester_id, addressee_id, status = 'pending'
    let pendingSet = new Set<string>()

    if (ids.length) {
      const { data: pendingRows, error: pendErr } = await supabaseAdmin
        .from("friendships") // <-- adjust if your table name differs
        .select("addressee_id") // <-- adjust if your column differs
        .eq("requester_id", meId) // <-- adjust if your column differs
        .in("addressee_id", ids) // <-- adjust if your column differs
        .eq("status", "pending") // <-- adjust if your status value differs (e.g., 'requested')

      if (!pendErr) {
        pendingSet = new Set((pendingRows ?? []).map((r: any) => r.addressee_id))
      }
    }

    const items = base.map((p) => ({
      ...p,
      outgoing_pending: pendingSet.has(p.id),
    }))

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Search failed." }, { status: 500 })
  }
}
