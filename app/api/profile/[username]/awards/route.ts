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

    // ── Round 1: profile + achievements in parallel ──────────────────────────
    const [profRes, achievementsRes] = await Promise.all([
      supabaseAdmin
        .from("profile_public_stats")
        .select("id, username, display_name")
        .eq("username", username)
        .single(),
      supabaseAdmin
        .from("achievements")
        .select("*")
        .order("sort_order", { ascending: true }),
    ])

    if (profRes.error) {
      if (profRes.error.code === "PGRST116") {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      throw profRes.error
    }

    const profileUserId = (profRes.data as any).id

    // Same user — tell the client to redirect
    if (profileUserId === viewerId) {
      return NextResponse.json({ redirect: "/awards" }, { status: 200 })
    }

    // ── Round 2: friendship check + user_achievements in parallel ────────────
    const [friendshipRes, userAchievementsRes] = await Promise.all([
      supabaseAdmin
        .from("friendships")
        .select("status")
        .or(
          `and(requester_id.eq.${viewerId},addressee_id.eq.${profileUserId}),and(requester_id.eq.${profileUserId},addressee_id.eq.${viewerId})`
        )
        .eq("status", "accepted")
        .maybeSingle(),
      supabaseAdmin
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", profileUserId),
    ])

    if (friendshipRes.error) throw friendshipRes.error
    if (!friendshipRes.data) {
      return NextResponse.json(
        { error: "You must be friends to view their medals" },
        { status: 403 }
      )
    }

    if (userAchievementsRes.error) throw userAchievementsRes.error

    return NextResponse.json({
      achievements: achievementsRes.data ?? [],
      userAchievements: userAchievementsRes.data ?? [],
    })
  } catch (e: any) {
    console.error("[/api/profile/[username]/awards]", e)
    return NextResponse.json({ error: e?.message ?? "Failed to load awards" }, { status: 500 })
  }
}