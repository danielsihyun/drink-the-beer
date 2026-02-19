import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    const userId = user.id

    // ── Parallel batch 1: profile, logs, achievements, counts ──────
    const [
      profileRes,
      logsRes,
      achievementsRes,
      userAchievementsRes,
      pendingFriendsRes,
      unseenCheersRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("profile_public_stats")
        .select("id, username, display_name, avatar_path, friend_count, drink_count, showcase_achievements, created_at")
        .eq("id", userId)
        .maybeSingle(),

      supabaseAdmin
        .from("drink_logs")
        .select("id, user_id, photo_path, drink_type, drink_id, caption, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),

      supabaseAdmin.from("achievements").select("*"),

      supabaseAdmin
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", userId),

      supabaseAdmin
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("addressee_id", userId)
        .eq("status", "pending"),

      supabaseAdmin.rpc("get_unseen_cheers_count", { p_user_id: userId }),
    ])

    if (profileRes.error) throw profileRes.error
    if (!profileRes.data) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }
    if (logsRes.error) throw logsRes.error

    const profile = profileRes.data as any
    const logs = (logsRes.data ?? []) as any[]

    // ── Parallel batch 2: avatar, photo URLs, drink names, cheers ──
    const drinkIds = [...new Set(logs.map((r) => r.drink_id).filter(Boolean))] as string[]
    const logIds = logs.map((r) => r.id)

    const [
      avatarRes,
      drinkNamesRes,
      cheersStateRes,
      ...photoUrlResults
    ] = await Promise.all([
      profile.avatar_path
        ? supabaseAdmin.storage
            .from("profile-photos")
            .createSignedUrl(profile.avatar_path, 60 * 60)
        : Promise.resolve({ data: null }),

      drinkIds.length > 0
        ? supabaseAdmin.from("drinks").select("id, name").in("id", drinkIds)
        : Promise.resolve({ data: [] }),

      logIds.length > 0
        ? supabaseAdmin.rpc("get_cheers_state", {
            post_ids: logIds,
            viewer_id: userId,
          })
        : Promise.resolve({ data: [] }),

      ...logs.map((r) =>
        supabaseAdmin.storage
          .from("drink-photos")
          .createSignedUrl(r.photo_path, 60 * 60)
      ),
    ])

    // ── Assemble response ──────────────────────────────────────────
    const avatarUrl = (avatarRes as any)?.data?.signedUrl ?? null

    const drinkNameById = new Map<string, string>(
      ((drinkNamesRes as any)?.data ?? []).map((d: any) => [d.id, d.name])
    )

    const cheersRows = ((cheersStateRes as any)?.data ?? []) as any[]
    const cheersMap = new Map<string, { count: number; cheered: boolean }>(
      cheersRows.map((r: any) => [
        r.drink_log_id,
        { count: Number(r.cheers_count ?? 0), cheered: Boolean(r.cheered) },
      ])
    )

    // Sum total cheers from cheers state instead of a separate query
    let totalCheersReceived = 0
    for (const r of cheersRows) {
      totalCheersReceived += Number(r.cheers_count ?? 0)
    }

    const items = logs.map((r, i) => {
      const cheers = cheersMap.get(r.id)
      return {
        id: r.id,
        userId: r.user_id,
        photoPath: r.photo_path,
        photoUrl: (photoUrlResults[i] as any)?.data?.signedUrl ?? "",
        drinkType: r.drink_type,
        drinkName: r.drink_id ? drinkNameById.get(r.drink_id) ?? null : null,
        caption: r.caption ?? null,
        createdAt: r.created_at,
        cheersCount: cheers?.count ?? 0,
        cheeredByMe: cheers?.cheered ?? false,
      }
    })

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl,
        avatarPath: profile.avatar_path ?? null,
        friendCount: profile.friend_count ?? 0,
        drinkCount: profile.drink_count ?? 0,
        joinDate: profile.created_at ?? null,
        showcaseAchievements: profile.showcase_achievements ?? [],
      },
      logs: items,
      achievements: achievementsRes.data ?? [],
      userAchievements: userAchievementsRes.data ?? [],
      pendingFriendRequests: pendingFriendsRes?.count ?? 0,
      unseenCheersCount: unseenCheersRes?.data ?? 0,
      totalCheersReceived,
    })
  } catch (e: any) {
    console.error("[/api/profile/me]", e)
    return NextResponse.json(
      { error: e?.message ?? "Failed to load profile" },
      { status: 500 }
    )
  }
}