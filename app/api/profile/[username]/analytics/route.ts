import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const viewerId = user.id
    const { username } = await context.params

    // ── Round 1: profile lookup ──────────────────────────────────────────────
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profile_public_stats")
      .select("id")
      .eq("username", username)
      .single()

    if (profErr) {
      if (profErr.code === "PGRST116") {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      throw profErr
    }

    const profileUserId = (prof as any).id

    // Same user — tell client to redirect
    if (profileUserId === viewerId) {
      return NextResponse.json({ redirect: "/analytics" })
    }

    // ── Round 2: friendship + drink_logs + card_order in parallel ────────────
    const [friendshipRes, logsRes, cardOrderRes] = await Promise.all([
      supabaseAdmin
        .from("friendships")
        .select("status")
        .or(
          `and(requester_id.eq.${viewerId},addressee_id.eq.${profileUserId}),and(requester_id.eq.${profileUserId},addressee_id.eq.${viewerId})`
        )
        .eq("status", "accepted")
        .maybeSingle(),
      supabaseAdmin
        .from("drink_logs")
        .select("id, drink_type, created_at, caption")
        .eq("user_id", profileUserId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("profiles")
        .select("analytics_card_order")
        .eq("id", profileUserId)
        .single(),
    ])

    if (friendshipRes.error) throw friendshipRes.error
    if (!friendshipRes.data) {
      return NextResponse.json(
        { error: "You must be friends to view their analytics" },
        { status: 403 }
      )
    }

    if (logsRes.error) throw logsRes.error

    const logs = logsRes.data ?? []
    const logIds = logs.map((l: any) => l.id)

    // ── Round 3: cheers received + cheers given in parallel ──────────────────
    const [receivedRes, givenRes] = await Promise.all([
      logIds.length > 0
        ? supabaseAdmin
            .from("drink_cheers")
            .select("drink_log_id, user_id")
            .in("drink_log_id", logIds)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from("drink_cheers")
        .select("drink_log_id, user_id, created_at")
        .eq("user_id", profileUserId),
    ])

    if ((receivedRes as any).error) throw (receivedRes as any).error
    if ((givenRes as any).error) throw (givenRes as any).error

    return NextResponse.json({
      analyticsCardOrder: (cardOrderRes.data as any)?.analytics_card_order ?? null,
      logs,
      receivedCheers: receivedRes.data ?? [],
      givenCheers: givenRes.data ?? [],
    })
  } catch (e: any) {
    console.error("[/api/profile/[username]/analytics]", e)
    return NextResponse.json({ error: e?.message ?? "Failed to load analytics" }, { status: 500 })
  }
}