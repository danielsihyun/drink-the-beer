import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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
      .from("friends_with_stats")
      .select("friend_id")
      .eq("user_id", user.id)
      .limit(500)

    if (frErr) throw frErr

    const friendIds = (fr ?? []).map((r: { friend_id: string }) => r.friend_id)
    const feedUserIds = Array.from(new Set([user.id, ...friendIds]))

    // ✅ Get logs for me + friends
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from("drink_logs")
      .select("id,user_id,photo_path,drink_type,caption,created_at")
      .in("user_id", feedUserIds)
      .order("created_at", { ascending: false })
      .limit(50)

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
      .from("profiles")
      .select("id,username,avatar_path")
      .in("id", userIdsInFeed)

    if (profErr) throw profErr

    const profileById = new Map(
      (profs ?? []).map((p: { id: string; username: string; avatar_path: string | null }) => [p.id, p])
    )

    // ✅ Create signed URLs for photos + avatars using service role
    const avatarUrlByPath = new Map<string, string | null>()

    const items = await Promise.all(
      rows.map(async (row) => {
        const prof = profileById.get(row.user_id)
        const username = prof?.username ?? "user"
        const avatarPath = prof?.avatar_path ?? null

        const { data: photoData } = await supabaseAdmin.storage
          .from("drink-photos")
          .createSignedUrl(row.photo_path, 60 * 60)

        const photoUrl = photoData?.signedUrl ?? null

        let avatarUrl: string | null = null
        if (avatarPath) {
          if (avatarUrlByPath.has(avatarPath)) {
            avatarUrl = avatarUrlByPath.get(avatarPath) ?? null
          } else {
            const { data: avData } = await supabaseAdmin.storage
              .from("profile-photos")
              .createSignedUrl(avatarPath, 60 * 60)

            avatarUrl = avData?.signedUrl ?? null
            avatarUrlByPath.set(avatarPath, avatarUrl)
          }
        }

        return {
          id: row.id,
          user_id: row.user_id,
          photo_path: row.photo_path,
          drink_type: row.drink_type,
          caption: row.caption,
          created_at: row.created_at,
          username,
          avatarUrl,
          photoUrl,
        }
      })
    )

    return NextResponse.json({ items }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Could not load feed." }, { status: 500 })
  }
}
