import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getBatchSignedUrls } from "@/lib/signed-url-cache"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const uid = user.id

    // ── Round 1: three independent queries fire in parallel ─────────────────
    const [profileRes, logsRes, givenCheersRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("analytics_card_order")
        .eq("id", uid)
        .single(),
      supabaseAdmin
        .from("drink_logs")
        .select("id, drink_type, created_at, caption")
        .eq("user_id", uid)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("drink_cheers")
        .select("drink_log_id, user_id, created_at")
        .eq("user_id", uid),
    ])

    const logs = (logsRes.data ?? []) as { id: string; drink_type: string; created_at: string; caption: string | null }[]
    const givenCheers = (givenCheersRes.data ?? []) as { drink_log_id: string; user_id: string; created_at: string }[]
    const myLogIds = logs.map((l) => l.id)
    const givenPostIds = [...new Set(givenCheers.map((c) => c.drink_log_id))]

    // ── Round 2: received cheers + post owners fire in parallel ─────────────
    const [receivedCheersRes, cheeredPostsRes] = await Promise.all([
      myLogIds.length > 0
        ? supabaseAdmin
            .from("drink_cheers")
            .select("drink_log_id, user_id")
            .in("drink_log_id", myLogIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      givenPostIds.length > 0
        ? supabaseAdmin
            .from("drink_logs")
            .select("id, user_id")
            .in("id", givenPostIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])

    const receivedCheers = (receivedCheersRes.data ?? []) as { drink_log_id: string; user_id: string }[]
    const cheeredPosts = (cheeredPostsRes.data ?? []) as { id: string; user_id: string }[]

    // Build post owner map
    const cheeredPostOwners: Record<string, string> = {}
    for (const p of cheeredPosts) {
      cheeredPostOwners[p.id] = p.user_id
    }

    // ── Round 3: profiles for all relevant users ────────────────────────────
    const profileUserIds = new Set<string>()
    for (const c of receivedCheers) {
      if (c.user_id !== uid) profileUserIds.add(c.user_id)
    }
    for (const ownerId of Object.values(cheeredPostOwners)) {
      if (ownerId !== uid) profileUserIds.add(ownerId)
    }

    const allUserIds = Array.from(profileUserIds)
    const cheersProfiles: Record<string, { username: string; displayName: string; avatarUrl: string | null }> = {}

    if (allUserIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profile_public_stats")
        .select("id, username, display_name, avatar_path")
        .in("id", allUserIds)

      const avatarPaths = [
        ...new Set((profiles ?? []).map((p: any) => p.avatar_path).filter(Boolean)),
      ] as string[]

      const avatarUrls =
        avatarPaths.length > 0
          ? await getBatchSignedUrls(supabaseAdmin, "profile-photos", avatarPaths, 3600)
          : []

      const avatarMap = new Map(avatarPaths.map((p, i) => [p, avatarUrls[i]]))

      for (const p of profiles ?? []) {
        cheersProfiles[(p as any).id] = {
          username: (p as any).username,
          displayName: (p as any).display_name || (p as any).username,
          avatarUrl: (p as any).avatar_path ? (avatarMap.get((p as any).avatar_path) ?? null) : null,
        }
      }
    }

    return NextResponse.json({
      analyticsCardOrder: profileRes.data?.analytics_card_order ?? null,
      logs,
      receivedCheers,
      givenCheers,
      cheeredPostOwners,
      cheersProfiles,
    })
  } catch (e: any) {
    console.error("[/api/analytics]", e)
    return NextResponse.json(
      { error: e?.message ?? "Failed to load analytics" },
      { status: 500 }
    )
  }
}