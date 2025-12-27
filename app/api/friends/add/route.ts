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

    const { friendId } = await req.json()
    if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 })

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // Identify caller from the JWT
    const { data: userRes, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const meId = userRes.user.id

    if (meId === friendId) {
      return NextResponse.json({ error: "You can't add yourself." }, { status: 400 })
    }

    // Insert (idempotent) friendship request
    // NOTE: this assumes your base table is "friendships"
    const { error: insErr } = await admin
      .from("friendships")
      .upsert(
        { requester_id: meId, addressee_id: friendId, status: "pending" },
        { onConflict: "requester_id,addressee_id" }
      )

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
