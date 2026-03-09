import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getBatchSignedUrls } from "@/lib/signed-url-cache"

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

    const { username } = await context.params

    // ── Round 1: profile lookup ──────────────────────────────────────────────
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profile_public_stats")
      .select("id, username, display_name")
      .eq("username", username)
      .single()

    if (profErr) {
      if (profErr.code === "PGRST116") {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      throw profErr
    }

    const targetUserId = (prof as any).id
    const displayName = (prof as any).display_name || (prof as any).username

    // ── Round 2: friendships ─────────────────────────────────────────────────
    const { data: friendships, error: fErr } = await supabaseAdmin
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${targetUserId},addressee_id.eq.${targetUserId}`)
      .eq("status", "accepted")

    if (fErr) throw fErr
    if (!friendships || friendships.length === 0) {
      return NextResponse.json({ friends: [], displayName })
    }

    const friendIds = friendships.map((f: any) =>
      f.requester_id === targetUserId ? f.addressee_id : f.requester_id
    )

    // ── Round 3: friend profiles + drink_log IDs in parallel ─────────────────
    const [profilesRes, logsRes] = await Promise.all([
      supabaseAdmin
        .from("profile_public_stats")
        .select("id, username, display_name, avatar_path, friend_count, drink_count")
        .in("id", friendIds),
      supabaseAdmin
        .from("drink_logs")
        .select("id, user_id")
        .in("user_id", friendIds),
    ])

    if (profilesRes.error) throw profilesRes.error

    const profiles = (profilesRes.data ?? []) as any[]
    const allLogs = (logsRes.data ?? []) as { id: string; user_id: string }[]
    const allLogIds = allLogs.map((l) => l.id)

    // ── Round 4: one flat cheers query + batch avatar URLs in parallel ────────
    // Previously: N friends × (query drink_logs + count drink_cheers) = N×2 sequential round trips
    // Now: 1 bulk drink_cheers query + in-memory join + 1 storage batch call
    const avatarPaths = [...new Set(profiles.map((p) => p.avatar_path).filter(Boolean))] as string[]

    const [cheersRes, avatarUrls] = await Promise.all([
      allLogIds.length > 0
        ? supabaseAdmin.from("drink_cheers").select("drink_log_id").in("drink_log_id", allLogIds)
        : Promise.resolve({ data: [] as { drink_log_id: string }[], error: null }),
      avatarPaths.length > 0
        ? getBatchSignedUrls(supabaseAdmin, "profile-photos", avatarPaths, 3600)
        : Promise.resolve([] as (string | null)[]),
    ])

    if ((cheersRes as any).error) throw (cheersRes as any).error

    // In-memory join: map log ID → owner, then count per user
    const logOwner = new Map(allLogs.map((l) => [l.id, l.user_id]))
    const cheersPerUser: Record<string, number> = {}
    for (const c of (cheersRes.data ?? []) as { drink_log_id: string }[]) {
      const uid = logOwner.get(c.drink_log_id)
      if (uid) cheersPerUser[uid] = (cheersPerUser[uid] ?? 0) + 1
    }

    const avatarMap = new Map(avatarPaths.map((p, i) => [p, avatarUrls[i] ?? null]))

    const friends = profiles
      .map((p) => ({
        id: p.id,
        username: p.username,
        displayName: p.display_name || p.username,
        avatarUrl: p.avatar_path ? (avatarMap.get(p.avatar_path) ?? null) : null,
        friendCount: p.friend_count ?? 0,
        drinkCount: p.drink_count ?? 0,
        cheersCount: cheersPerUser[p.id] ?? 0,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))

    return NextResponse.json({ friends, displayName })
  } catch (e: any) {
    console.error("[/api/profile/[username]/friends]", e)
    return NextResponse.json({ error: e?.message ?? "Failed to load friends" }, { status: 500 })
  }
}