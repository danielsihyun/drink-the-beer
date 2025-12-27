import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""

    if (!token) {
      return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const friendId = body?.friendId as string | undefined

    if (!friendId) {
      return NextResponse.json({ error: "Missing friendId" }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Server not configured: missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      )
    }

    // Service role client (bypasses RLS)
    const admin = createClient(url, serviceKey)

    // Validate token -> get the calling user
    const { data: userRes, error: userErr } = await admin.auth.getUser(token)
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 })

    const user = userRes.user
    if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    if (user.id === friendId) return NextResponse.json({ error: "You cannot friend yourself" }, { status: 400 })

    // Insert BOTH directions so each user sees the other in their list
    const now = new Date().toISOString()
    const { error: insErr } = await admin.from("friends").upsert(
      [
        { user_id: user.id, friend_id: friendId, created_at: now },
        { user_id: friendId, friend_id: user.id, created_at: now },
      ],
      { onConflict: "user_id,friend_id" }
    )

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
