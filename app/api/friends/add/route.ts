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

    const body = await req.json().catch(() => ({}))
    const friendId = body?.friendId as string | undefined
    if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 })

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

    // Identify caller from the JWT
    const { data: userRes, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const meId = userRes.user.id

    if (meId === friendId) return NextResponse.json({ error: "You can't add yourself." }, { status: 400 })

    // 1) Look for existing relationship in either direction (unordered pair)
    const { data: existing, error: findErr } = await admin
      .from("friendships")
      .select("id,requester_id,addressee_id,status")
      .or(`and(requester_id.eq.${meId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${meId})`)
      .maybeSingle()

    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 400 })

    if (existing) {
      // Already friends
      if (existing.status === "accepted") {
        return NextResponse.json({ ok: true, alreadyFriends: true })
      }

      // Incoming pending exists: friendId -> meId, so auto-accept
      if (existing.status === "pending" && existing.requester_id === friendId && existing.addressee_id === meId) {
        const { error: updErr } = await admin
          .from("friendships")
          .update({ status: "accepted", updated_at: new Date().toISOString() })
          .eq("id", existing.id)

        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })
        return NextResponse.json({ ok: true, autoAccepted: true })
      }

      // Outgoing pending already exists: meId -> friendId
      if (existing.status === "pending" && existing.requester_id === meId) {
        return NextResponse.json({ ok: true, alreadyPending: true })
      }

      // If it was rejected, you can decide your behavior. Here: allow "re-send" by resetting to pending + making me the requester.
      if (existing.status === "rejected") {
        const { error: updErr } = await admin
          .from("friendships")
          .update({
            requester_id: meId,
            addressee_id: friendId,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)

        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })
        return NextResponse.json({ ok: true, resent: true })
      }

      // Fallback
      return NextResponse.json({ ok: true })
    }

    // 2) No row exists: create pending request
    const { error: insErr } = await admin
      .from("friendships")
      .insert({ requester_id: meId, addressee_id: friendId, status: "pending" })

    // Race-condition fallback: if another request landed first, treat it as "existing" and auto-accept if needed
    if (insErr) {
      const msg = insErr.message?.toLowerCase?.() ?? ""
      if (msg.includes("duplicate") || msg.includes("unique")) {
        const { data: ex2 } = await admin
          .from("friendships")
          .select("id,requester_id,addressee_id,status")
          .or(`and(requester_id.eq.${meId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${meId})`)
          .maybeSingle()

        if (ex2?.status === "pending" && ex2.requester_id === friendId && ex2.addressee_id === meId) {
          await admin
            .from("friendships")
            .update({ status: "accepted", updated_at: new Date().toISOString() })
            .eq("id", ex2.id)
          return NextResponse.json({ ok: true, autoAccepted: true })
        }

        return NextResponse.json({ ok: true, alreadyPending: true })
      }

      return NextResponse.json({ error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
