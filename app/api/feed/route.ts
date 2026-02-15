import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getCachedSignedUrl, getBatchSignedUrls } from "@/lib/signed-url-cache"

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

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr) return NextResponse.json({ error: "Invalid session." }, { status: 401 })

    const user = userRes.user
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })

    // ✅ Get accepted friend IDs
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

    // ✅ Get logs for me + friends
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from("drink_logs")
      .select("id,user_id,photo_path,drink_type,caption,created_at")
      .in("user_id", feedUserIds)
      .order("created_at", { ascending: false })
      .limit(100)

    if (logsErr) throw logsErr

    const rows = (logs ?? []) as Array<{
      id: string
      user_id: string
      photo_path: string
      drink_type: string
      caption: string | null
      created_at: string
    }>

    if (rows.length === 0) {
      return NextResponse.json({ items: [] }, { status: 200 })
    }

    // ✅ Fetch profiles for all users in the feed rows
    const userIdsInFeed = Array.from(new Set(rows.map((r) => r.user_id)))

    const { data: profs, error: profErr } = await supabaseAdmin
      .from("profile_public_stats")
      .select("id,username,avatar_path")
      .in("id", userIdsInFeed)

    if (profErr) throw profErr

    const profileById = new Map(
      (profs ?? []).map((p: { id: string; username: string; avatar_path: string | null }) => [p.id, p])
    )

    // ✅ OPTIMIZED: Batch fetch all signed URLs in parallel

    // Collect all unique paths
    const photoPaths = rows.map((r) => r.photo_path)
    const avatarPaths = [...new Set((profs ?? []).map((p: any) => p.avatar_path).filter(Boolean))]

    // Fetch both batches in parallel
    const [photoUrls, avatarUrls] = await Promise.all([
      getBatchSignedUrls(supabaseAdmin, "drink-photos", photoPaths, 60 * 60),
      getBatchSignedUrls(supabaseAdmin, "profile-photos", avatarPaths, 60 * 60),
    ])

    // Create lookup maps
    const photoUrlMap = new Map<string, string | null>()
    for (let i = 0; i < photoPaths.length; i++) {
      photoUrlMap.set(photoPaths[i], photoUrls[i])
    }

    const avatarUrlMap = new Map<string, string | null>()
    for (let i = 0; i < avatarPaths.length; i++) {
      avatarUrlMap.set(avatarPaths[i], avatarUrls[i])
    }

    // ✅ Build response items (no more awaits needed!)
    const items = rows.map((row) => {
      const prof = profileById.get(row.user_id)
      const username = prof?.username ?? "user"
      const avatarPath = prof?.avatar_path ?? null

      return {
        id: row.id,
        user_id: row.user_id,
        photo_path: row.photo_path,
        drink_type: row.drink_type,
        caption: row.caption,
        created_at: row.created_at,
        username,
        avatarUrl: avatarPath ? avatarUrlMap.get(avatarPath) ?? null : null,
        photoUrl: photoUrlMap.get(row.photo_path) ?? null,
      }
    })

    return NextResponse.json({ items }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Could not load feed." }, { status: 500 })
  }
}