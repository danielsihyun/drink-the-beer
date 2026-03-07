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
    const { username } = await context.params

    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const {
      data: { user: viewer },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !viewer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const viewerId = viewer.id

    // If viewing own profile, redirect to /profile/me equivalent
    const { data: targetProfile, error: profileErr } = await supabaseAdmin
      .from("profile_public_stats")
      .select("id, username, display_name, avatar_path, friend_count, drink_count, showcase_achievements, created_at")
      .eq("username", username)
      .maybeSingle()

    if (profileErr) throw profileErr
    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Redirect to /profile/me if viewing own profile
    if (targetProfile.id === viewerId) {
      return NextResponse.json({ redirect: "/profile/me" }, { status: 302 })
    }

    const targetUserId = targetProfile.id

    // ── Parallel batch 1: friendship status + XP + achievements ──
    const [
      friendshipRes,
      userXpRes,
      achievementsRes,
      userAchievementsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .or(
          `and(requester_id.eq.${viewerId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${viewerId})`
        )
        .maybeSingle(),

      supabaseAdmin
        .from("user_xp")
        .select("total_xp")
        .eq("user_id", targetUserId)
        .maybeSingle(),

      supabaseAdmin.from("achievements").select("*"),

      supabaseAdmin
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", targetUserId),
    ])

    // Derive friendship status
    let friendshipStatus: "none" | "friends" | "pending_outgoing" | "pending_incoming" = "none"
    const friendship = friendshipRes.data

    if (friendship) {
      if (friendship.status === "accepted") {
        friendshipStatus = "friends"
      } else if (friendship.status === "pending") {
        friendshipStatus =
          friendship.requester_id === viewerId ? "pending_outgoing" : "pending_incoming"
      }
    }

    // If not friends, return locked profile (no logs)
    if (friendshipStatus !== "friends") {
      const [avatarRes] = await Promise.all([
        targetProfile.avatar_path
          ? supabaseAdmin.storage
              .from("profile-photos")
              .createSignedUrl(targetProfile.avatar_path, 60 * 60)
          : Promise.resolve({ data: null }),
      ])

      return NextResponse.json({
        profile: {
          id: targetProfile.id,
          username: targetProfile.username,
          displayName: targetProfile.display_name,
          avatarUrl: (avatarRes as any)?.data?.signedUrl ?? null,
          avatarPath: targetProfile.avatar_path ?? null,
          friendCount: targetProfile.friend_count ?? 0,
          drinkCount: targetProfile.drink_count ?? 0,
          totalCheersReceived: 0,
          joinDate: targetProfile.created_at ?? null,
          showcaseAchievements: targetProfile.showcase_achievements ?? [],
        },
        friendshipStatus,
        logs: [],
        achievements: achievementsRes.data ?? [],
        userAchievements: userAchievementsRes.data ?? [],
        totalXp: userXpRes.data?.total_xp ?? 0,
      })
    }

    // ── Parallel batch 2: logs ──
    const logsRes = await supabaseAdmin
      .from("drink_logs")
      .select("id, user_id, photo_path, drink_type, drink_id, caption, created_at")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(200)

    if (logsRes.error) throw logsRes.error
    const logs = (logsRes.data ?? []) as any[]

    // ── Parallel batch 3: signed URLs + drink names + cheers + avatar ──
    const drinkIds = [...new Set(logs.map((r) => r.drink_id).filter(Boolean))] as string[]
    const logIds = logs.map((r) => r.id)

    const [
      avatarRes,
      drinkNamesRes,
      cheersStateRes,
      ...photoUrlResults
    ] = await Promise.all([
      targetProfile.avatar_path
        ? supabaseAdmin.storage
            .from("profile-photos")
            .createSignedUrl(targetProfile.avatar_path, 60 * 60)
        : Promise.resolve({ data: null }),

      drinkIds.length > 0
        ? supabaseAdmin.from("drinks").select("id, name").in("id", drinkIds)
        : Promise.resolve({ data: [] }),

      logIds.length > 0
        ? supabaseAdmin.rpc("get_cheers_state", {
            post_ids: logIds,
            viewer_id: viewerId,
          })
        : Promise.resolve({ data: [] }),

      ...logs.map((r) =>
        supabaseAdmin.storage
          .from("drink-photos")
          .createSignedUrl(r.photo_path, 60 * 60)
      ),
    ])

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
        id: targetProfile.id,
        username: targetProfile.username,
        displayName: targetProfile.display_name,
        avatarUrl,
        avatarPath: targetProfile.avatar_path ?? null,
        friendCount: targetProfile.friend_count ?? 0,
        drinkCount: targetProfile.drink_count ?? 0,
        totalCheersReceived,
        joinDate: targetProfile.created_at ?? null,
        showcaseAchievements: targetProfile.showcase_achievements ?? [],
      },
      friendshipStatus,
      logs: items,
      achievements: achievementsRes.data ?? [],
      userAchievements: userAchievementsRes.data ?? [],
      totalXp: userXpRes.data?.total_xp ?? 0,
    })
  } catch (e: any) {
    console.error("[/api/profile/[username]]", e)
    return NextResponse.json(
      { error: e?.message ?? "Failed to load profile" },
      { status: 500 }
    )
  }
}