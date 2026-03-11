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

    const userId = user.id

    // ── Single parallel batch: everything the profile page needs ──
    const [
      profileRes,
      logsRes,
      achievementsRes,
      userAchievementsRes,
      pendingFriendsRes,
      unseenCheersRes,
      userXpRes,
      pendingDuelsRes,
      unseenAcceptedDuelsRes,
      unseenAcceptedFriendsRes,
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

      // Pending incoming friend requests
      supabaseAdmin
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("addressee_id", userId)
        .eq("status", "pending"),

      // Unseen cheers count
      supabaseAdmin.rpc("get_unseen_cheers_count", { p_user_id: userId }),

      // XP / level
      supabaseAdmin
        .from("user_xp")
        .select("total_xp")
        .eq("user_id", userId)
        .maybeSingle(),

      // Pending duel challenges
      supabaseAdmin
        .from("duels")
        .select("*", { count: "exact", head: true })
        .eq("challenged_id", userId)
        .eq("status", "pending"),

      // Duels challenger accepted but not yet seen
      supabaseAdmin
        .from("duels")
        .select("*", { count: "exact", head: true })
        .eq("challenger_id", userId)
        .eq("status", "active")
        .eq("challenger_seen_active", false),

      // Friend requests the user sent that were accepted but not yet seen
      supabaseAdmin
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("requester_id", userId)
        .eq("status", "accepted")
        .eq("requester_seen_accepted", false),
    ])

    if (profileRes.error) throw profileRes.error
    if (!profileRes.data) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }
    if (logsRes.error) throw logsRes.error

    const profile = profileRes.data as any
    const logs = (logsRes.data ?? []) as any[]

    // ── Parallel batch 2: signed URLs (batched), drink names, cheers state ──
    const drinkIds = [...new Set(logs.map((r) => r.drink_id).filter(Boolean))] as string[]
    const logIds = logs.map((r) => r.id)
    const photoPaths = logs.map((r) => r.photo_path as string)

    const [
      photoUrls,
      avatarUrlArr,
      drinkNamesRes,
      cheersStateRes,
    ] = await Promise.all([
      // Batch all drink photo signed URLs in one shot (vs N serial calls before)
      photoPaths.length > 0
        ? getBatchSignedUrls(supabaseAdmin, "drink-photos", photoPaths, 60 * 60)
        : Promise.resolve([] as (string | null)[]),

      // Avatar — single path, still use batch helper for cache consistency
      profile.avatar_path
        ? getBatchSignedUrls(supabaseAdmin, "profile-photos", [profile.avatar_path], 60 * 60)
        : Promise.resolve([null] as (string | null)[]),

      drinkIds.length > 0
        ? supabaseAdmin.from("drinks").select("id, name").in("id", drinkIds)
        : Promise.resolve({ data: [] }),

      logIds.length > 0
        ? supabaseAdmin.rpc("get_cheers_state", {
            post_ids: logIds,
            viewer_id: userId,
          })
        : Promise.resolve({ data: [] }),
    ])

    // ── Assemble response ──────────────────────────────────────────
    const avatarUrl = avatarUrlArr[0] ?? null

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
        photoUrl: photoUrls[i] ?? "",
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
      totalXp: userXpRes.data?.total_xp ?? 0,
      pendingDuelRequests: (pendingDuelsRes?.count ?? 0) + (unseenAcceptedDuelsRes?.count ?? 0),
      unseenAcceptedFriends: unseenAcceptedFriendsRes?.count ?? 0,
    })
  } catch (e: any) {
    console.error("[/api/profile/me]", e)
    return NextResponse.json(
      { error: e?.message ?? "Failed to load profile" },
      { status: 500 }
    )
  }
}