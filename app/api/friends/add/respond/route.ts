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

    const { friendshipId, action } = await req.json()
    if (!friendshipId || (action !== "accept" && action !== "reject")) {
      return NextResponse.json({ error: "Missing friendshipId or invalid action" }, { status: 400 })
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data: userRes, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const meId = userRes.user.id

    // Ensure this request belongs to me (I must be the addressee)
    const { data: row, error: rowErr } = await admin
      .from("friendships")
      .select("id,addressee_id,status")
      .eq("id", friendshipId)
      .maybeSingle()

    if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 400 })
    if (!row) return NextResponse.json({ error: "Friend request not found" }, { status: 404 })
    if (row.addressee_id !== meId) return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    if (row.status !== "pending") return NextResponse.json({ error: "Request is not pending" }, { status: 400 })

    if (action === "accept") {
      const { error: updErr } = await admin
        .from("friendships")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", friendshipId)

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })
    } else {
      const { error: delErr } = await admin.from("friendships").delete().eq("id", friendshipId)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
