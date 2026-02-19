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

    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const viewerId = user.id
    const { username } = await context.params

    // ── Lookup profile by username ─────────────────────────────────
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profile_public_stats")
      .select("id, username, display_name, avatar_path, friend_count, drink_count, showcase_achievements, created_at")
      .eq("username", username)
      .maybeSingle()

    if (profErr) throw profErr
    if (!prof) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (prof.id === viewerId) {
      return NextResponse.json({ redirect: "/profile/me" }, { status: 302 })
    }

    const profileUserId = prof.id

    // ── Parallel batch 1: friendship, avatar, achievements, cheers total ──
    const [
      friendshipRes,
      avatarRes,
      achievementsRes,
      userAchievementsRes,
      logIdsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("friendships")
        .select("requester_id, addressee_id, status")
        .or(
          `and(requester_id.eq.${viewerId},addressee_id.eq.${profileUserId}),and(requester_id.eq.${profileUserId},addressee_id.eq.${viewerId})`
        )
        .limit(1)
        .maybeSingle(),

      prof.avatar_path
        ? supabaseAdmin.storage
            .from("profile-photos")
            .createSignedUrl(prof.avatar_path, 60 * 60)
        : Promise.resolve({ data: null }),

      supabaseAdmin.from("achievements").select("*"),

      supabaseAdmin
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", profileUserId),

      // Get all log IDs for total cheers count
      supabaseAdmin
        .from("drink_logs")
        .select("id")
        .eq("user_id", profileUserId),
    ])

    if (friendshipRes.error) throw friendshipRes.error

    // Determine friendship status
    let friendshipStatus = "none"
    if (friendshipRes.data) {
      const f = friendshipRes.data
      if (f.status === "accepted") {
        friendshipStatus = "friends"
      } else if (f.status === "pending") {
        friendshipStatus = f.requester_id === viewerId ? "pending_outgoing" : "pending_incoming"
      }
    }

    const avatarUrl = (avatarRes as any)?.data?.signedUrl ?? null

    // Total cheers received
    const logIdList = (logIdsRes.data ?? []).map((r: any) => r.id)
    let totalCheersReceived = 0
    if (logIdList.length > 0) {
      const { count } = await supabaseAdmin
        .from("drink_cheers")
        .select("*", { count: "exact", head: true })
        .in("drink_log_id", logIdList)
      totalCheersReceived = count ?? 0
    }

    // ── If friends: fetch logs, photos, drink names, cheers state ──
    let items: any[] = []

    if (friendshipStatus === "friends") {
      const { data: logsData, error: logsErr } = await supabaseAdmin
        .from("drink_logs")
        .select("id, user_id, photo_path, drink_type, drink_id, caption, created_at")
        .eq("user_id", profileUserId)
        .order("created_at", { ascending: false })
        .limit(200)

      if (logsErr) throw logsErr

      const logs = (logsData ?? []) as any[]
      const drinkIds = [...new Set(logs.map((r) => r.drink_id).filter(Boolean))] as string[]
      const friendLogIds = logs.map((r) => r.id)

      const [
        drinkNamesRes,
        cheersStateRes,
        ...photoUrlResults
      ] = await Promise.all([
        drinkIds.length > 0
          ? supabaseAdmin.from("drinks").select("id, name").in("id", drinkIds)
          : Promise.resolve({ data: [] }),

        friendLogIds.length > 0
          ? supabaseAdmin.rpc("get_cheers_state", {
              post_ids: friendLogIds,
              viewer_id: viewerId,
            })
          : Promise.resolve({ data: [] }),

        ...logs.map((r) =>
          supabaseAdmin.storage
            .from("drink-photos")
            .createSignedUrl(r.photo_path, 60 * 60)
        ),
      ])

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

      items = logs.map((r, i) => {
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
    }

    return NextResponse.json({
      profile: {
        id: prof.id,
        username: prof.username,
        displayName: prof.display_name,
        avatarUrl,
        friendCount: prof.friend_count ?? 0,
        drinkCount: prof.drink_count ?? 0,
        joinDate: prof.created_at ?? null,
        showcaseAchievements: prof.showcase_achievements ?? [],
        totalCheersReceived,
      },
      friendshipStatus,
      logs: items,
      achievements: achievementsRes.data ?? [],
      userAchievements: userAchievementsRes.data ?? [],
    })
  } catch (e: any) {
    console.error("[/api/profile/[username]]", e)
    return NextResponse.json(
      { error: e?.message ?? "Failed to load profile" },
      { status: 500 }
    )
  }
}