import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getBatchSignedUrls } from "@/lib/signed-url-cache"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const meId = userRes.user.id

    // Fetch accepted friendships + pending incoming in parallel
    const [acceptedRes, pendingRes] = await Promise.all([
      supabaseAdmin
        .from("friendships")
        .select("id, requester_id, addressee_id, created_at")
        .or(`requester_id.eq.${meId},addressee_id.eq.${meId}`)
        .eq("status", "accepted")
        .limit(500),
      supabaseAdmin
        .from("friendships")
        .select("id, requester_id, created_at")
        .eq("addressee_id", meId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(200),
    ])

    if (acceptedRes.error) throw acceptedRes.error
    if (pendingRes.error) throw pendingRes.error

    const friendships = acceptedRes.data ?? []
    const pendingRows = pendingRes.data ?? []

    const friendIds = friendships.map((f: any) =>
      f.requester_id === meId ? f.addressee_id : f.requester_id
    )
    const friendshipCreatedAtMap = new Map(
      friendships.map((f: any) => {
        const friendId = f.requester_id === meId ? f.addressee_id : f.requester_id
        return [friendId, f.created_at]
      })
    )

    const pendingRequesterIds = [...new Set(pendingRows.map((r: any) => r.requester_id))].filter(Boolean) as string[]

    // All profile IDs we need
    const allProfileIds = [...new Set([...friendIds, ...pendingRequesterIds])]

    // Fetch profiles + all drink logs for friends (for cheers counts) in parallel
    const [profilesRes, logsRes] = await Promise.all([
      allProfileIds.length > 0
        ? supabaseAdmin
            .from("profile_public_stats")
            .select("id, username, display_name, avatar_path, friend_count, drink_count")
            .in("id", allProfileIds)
        : Promise.resolve({ data: [], error: null }),
      friendIds.length > 0
        ? supabaseAdmin
            .from("drink_logs")
            .select("id, user_id")
            .in("user_id", friendIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (profilesRes.error) throw profilesRes.error

    const profiles = profilesRes.data ?? []
    const profileById = new Map(profiles.map((p: any) => [p.id, p]))

    // Build log→user map and collect all log IDs for cheers query
    const logToUser = new Map<string, string>()
    const userToLogs = new Map<string, string[]>()
    for (const row of (logsRes.data ?? []) as { id: string; user_id: string }[]) {
      logToUser.set(row.id, row.user_id)
      const arr = userToLogs.get(row.user_id) ?? []
      arr.push(row.id)
      userToLogs.set(row.user_id, arr)
    }
    const allLogIds = [...logToUser.keys()]

    // Fetch cheers counts in one bulk query
    const cheersByUser = new Map<string, number>()
    if (allLogIds.length > 0) {
      const { data: cheersRows } = await supabaseAdmin
        .from("drink_cheers")
        .select("drink_log_id")
        .in("drink_log_id", allLogIds)

      for (const row of (cheersRows ?? []) as { drink_log_id: string }[]) {
        const userId = logToUser.get(row.drink_log_id)
        if (userId) cheersByUser.set(userId, (cheersByUser.get(userId) ?? 0) + 1)
      }
    }

    // Batch all avatar signed URLs in one shot
    const avatarPaths = [...new Set(profiles.map((p: any) => p.avatar_path).filter(Boolean))] as string[]
    const avatarUrls = avatarPaths.length > 0
      ? await getBatchSignedUrls(supabaseAdmin, "profile-photos", avatarPaths, 60 * 60)
      : []

    const avatarUrlMap = new Map<string, string | null>()
    for (let i = 0; i < avatarPaths.length; i++) {
      avatarUrlMap.set(avatarPaths[i], avatarUrls[i])
    }

    function getAvatarUrl(profile: any): string | null {
      return profile?.avatar_path ? (avatarUrlMap.get(profile.avatar_path) ?? null) : null
    }

    // Build friends list
    const friends = friendIds
      .map((id: string) => {
        const p = profileById.get(id)
        if (!p) return null
        return {
          id: p.id,
          username: p.username,
          displayName: p.display_name,
          avatarUrl: getAvatarUrl(p),
          friendCount: p.friend_count ?? 0,
          drinkCount: p.drink_count ?? 0,
          cheersCount: cheersByUser.get(id) ?? 0,
          friendshipCreatedAt: friendshipCreatedAtMap.get(id) ?? null,
        }
      })
      .filter(Boolean)

    // Build pending list
    const pending = pendingRows.map((r: any) => {
      const p = profileById.get(r.requester_id)
      return {
        friendshipId: r.id,
        requesterId: r.requester_id,
        createdAt: r.created_at,
        username: p?.username ?? "unknown",
        displayName: p?.display_name ?? "Unknown",
        avatarUrl: getAvatarUrl(p),
        friendCount: p?.friend_count ?? 0,
        drinkCount: p?.drink_count ?? 0,
        cheersCount: 0,
      }
    })

    return NextResponse.json({ friends, pending })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}