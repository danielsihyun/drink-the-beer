import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: Request) {
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

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // Identify caller from JWT
    const { data: userRes, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const meId = userRes.user.id

    // Fetch pending incoming requests
    const { data: reqs, error: rErr } = await admin
      .from("friendships")
      .select("id,requester_id,created_at")
      .eq("addressee_id", meId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200)

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 })

    const requesterIds = Array.from(new Set((reqs ?? []).map((r) => r.requester_id))).filter(Boolean)
    if (requesterIds.length === 0) return NextResponse.json({ items: [] })

    // Pull public profile stats for requesters
    const { data: profiles, error: pErr } = await admin
      .from("profile_public_stats")
      .select("id,username,display_name,avatar_path,friend_count,drink_count")
      .in("id", requesterIds)

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })

    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    const items = (reqs ?? []).map((r: any) => {
      const p = byId.get(r.requester_id)
      return {
        friendshipId: r.id,
        requesterId: r.requester_id,
        createdAt: r.created_at,
        username: p?.username ?? "unknown",
        display_name: p?.display_name ?? "Unknown",
        avatar_path: p?.avatar_path ?? null,
        friend_count: p?.friend_count ?? 0,
        drink_count: p?.drink_count ?? 0,
      }
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
