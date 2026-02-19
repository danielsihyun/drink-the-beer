import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getCachedSignedUrl, getBatchSignedUrls } from "@/lib/signed-url-cache"

const DEFAULT_LIMIT = 10

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null
    if (!token) return NextResponse.json({ error: "Missing Authorization token." }, { status: 401 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Server misconfigured (missing Supabase env vars)." }, { status: 500 })
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    // Parse pagination params
    const reqUrl = new URL(req.url)
    const cursor = reqUrl.searchParams.get("cursor") // ISO timestamp of last item
    const limit = Math.min(Number(reqUrl.searchParams.get("limit")) || DEFAULT_LIMIT, 50)

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr) return NextResponse.json({ error: "Invalid session." }, { status: 401 })

    const user = userRes.user
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

    // Get accepted friend IDs
    const { data: fr, error: frErr } = await supabaseAdmin
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted")
      .limit(500)

    if (frErr) throw frErr

    const friendIds = (fr ?? []).map((r: { requester_id: string; addressee_id: string }) =>
      r.requester_id === user.id ? r.addressee_id : r.requester_id
    )
    const feedUserIds = Array.from(new Set([user.id, ...friendIds]))

    // Get logs with cursor-based pagination
    // Fetch limit + 1 to know if there's a next page
    let query = supabaseAdmin
      .from("drink_logs")
      .select("id,user_id,photo_path,drink_type,drink_id,caption,created_at")
      .in("user_id", feedUserIds)
      .order("created_at", { ascending: false })
      .limit(limit + 1)

    if (cursor) {
      query = query.lt("created_at", cursor)
    }

    const { data: logs, error: logsErr } = await query

    if (logsErr) throw logsErr

    const allRows = (logs ?? []) as Array<{
      id: string
      user_id: string
      photo_path: string
      drink_type: string
      drink_id: string | null
      caption: string | null
      created_at: string
    }>

    // Determine if there's a next page
    const hasMore = allRows.length > limit
    const rows = hasMore ? allRows.slice(0, limit) : allRows
    const nextCursor = hasMore ? rows[rows.length - 1].created_at : null

    if (rows.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null }, { status: 200 })
    }

    // Fetch profiles and drink names in parallel
    const userIdsInFeed = Array.from(new Set(rows.map((r) => r.user_id)))
    const drinkIds = [...new Set(rows.map((r) => r.drink_id).filter(Boolean))] as string[]
    const postIds = rows.map((r) => r.id)

    const [profsRes, drinksRes, cheersRes] = await Promise.all([
      supabaseAdmin
        .from("profile_public_stats")
        .select("id,username,avatar_path")
        .in("id", userIdsInFeed),
      drinkIds.length > 0
        ? supabaseAdmin
            .from("drinks")
            .select("id,name")
            .in("id", drinkIds)
        : Promise.resolve({ data: [], error: null }),
      // Cheers: counts + whether viewer cheered each post
      supabaseAdmin.rpc("get_cheers_state", { post_ids: postIds, viewer_id: user.id }),
    ])

    if (profsRes.error) throw profsRes.error
    const profs = profsRes.data ?? []

    const drinkNameById = new Map<string, string>(
      (drinksRes.data ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    )

    const profileById = new Map(
      profs.map((p: { id: string; username: string; avatar_path: string | null }) => [p.id, p])
    )

    // Build cheers lookup: postId -> { count, cheered }
    const cheersById = new Map<string, { count: number; cheered: boolean }>()
    for (const r of (cheersRes.data ?? []) as any[]) {
      cheersById.set(r.drink_log_id, {
        count: Number(r.cheers_count ?? 0),
        cheered: Boolean(r.cheered),
      })
    }

    // Batch fetch all signed URLs in parallel
    const photoPaths = rows.map((r) => r.photo_path)
    const avatarPaths = [...new Set((profs ?? []).map((p: any) => p.avatar_path).filter(Boolean))]

    const [photoUrls, avatarUrls] = await Promise.all([
      getBatchSignedUrls(supabaseAdmin, "drink-photos", photoPaths, 60 * 60),
      getBatchSignedUrls(supabaseAdmin, "profile-photos", avatarPaths, 60 * 60),
    ])

    const photoUrlMap = new Map<string, string | null>()
    for (let i = 0; i < photoPaths.length; i++) {
      photoUrlMap.set(photoPaths[i], photoUrls[i])
    }

    const avatarUrlMap = new Map<string, string | null>()
    for (let i = 0; i < avatarPaths.length; i++) {
      avatarUrlMap.set(avatarPaths[i], avatarUrls[i])
    }

    // Build response items
    const items = rows.map((row) => {
      const prof = profileById.get(row.user_id)
      const username = prof?.username ?? "user"
      const avatarPath = prof?.avatar_path ?? null
      const cheers = cheersById.get(row.id)

      return {
        id: row.id,
        user_id: row.user_id,
        photo_path: row.photo_path,
        drink_type: row.drink_type,
        drink_name: row.drink_id ? drinkNameById.get(row.drink_id) ?? null : null,
        caption: row.caption,
        created_at: row.created_at,
        username,
        avatarUrl: avatarPath ? avatarUrlMap.get(avatarPath) ?? null : null,
        photoUrl: photoUrlMap.get(row.photo_path) ?? null,
        cheersCount: cheers?.count ?? 0,
        cheeredByMe: cheers?.cheered ?? false,
      }
    })

    return NextResponse.json({ items, nextCursor }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Could not load feed." }, { status: 500 })
  }
}