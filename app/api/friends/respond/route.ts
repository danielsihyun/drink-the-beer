import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return NextResponse.json(
      { error: "Server not configured: missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" },
      { status: 500 }
    )
  }

  // Expect: Authorization: Bearer <access_token>
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null
  if (!token) return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 })

  // Admin client (service role) for server-side updates
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Validate the token + identify the user (the addressee must be the one responding)
  const { data: userRes, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 })
  }
  const meId = userRes.user.id

  const body = await req.json().catch(() => null)
  const requestId = (body?.requestId as string | undefined)?.trim()
  const rawAction = (body?.action as string | undefined)?.trim()

  if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 })
  if (!rawAction) return NextResponse.json({ error: "Missing action" }, { status: 400 })

  // Allow both "accept/reject" and "accepted/rejected" (prevents frontend mismatches)
  let action: "accepted" | "rejected" | null = null
  if (rawAction === "accept" || rawAction === "accepted") action = "accepted"
  if (rawAction === "reject" || rawAction === "rejected") action = "rejected"
  if (!action) return NextResponse.json({ error: "Invalid action" }, { status: 400 })

  // Only the addressee can accept/reject, and only if pending
  const { data, error } = await admin
    .from("friendships")
    .update({ status: action, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("addressee_id", meId)
    .eq("status", "pending")
    .select("id,requester_id,addressee_id,status,created_at,updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data) {
    return NextResponse.json({ error: "Request not found or not pending." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, request: data })
}
