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

    const url = new URL(req.url)
    const scope = url.searchParams.get("scope") ?? "friends"
    const startDate = url.searchParams.get("start_date") ?? new Date(0).toISOString()
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100)

    // Single RPC call for leaderboard data
    const { data, error: rpcErr } = await supabaseAdmin.rpc("get_leaderboard", {
      p_viewer_id: user.id,
      p_scope: scope,
      p_start_date: startDate,
      p_limit: limit,
    })

    if (rpcErr) throw rpcErr

    const rows = (data ?? []) as any[]

    // Resolve all avatar URLs in parallel server-side
    const avatarUrls = await Promise.all(
      rows.map((r) =>
        r.avatar_path
          ? supabaseAdmin.storage
              .from("profile-photos")
              .createSignedUrl(r.avatar_path, 60 * 60)
              .then((res) => res.data?.signedUrl ?? null)
          : Promise.resolve(null)
      )
    )

    const entries = rows.map((r, i) => ({
      user_id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      drink_count: r.drink_count,
      rank: r.rank,
      is_viewer: r.is_viewer,
      avatarUrl: avatarUrls[i],
    }))

    return NextResponse.json({ viewerId: user.id, entries })
  } catch (e: any) {
    console.error("[/api/leaderboard]", e)
    return NextResponse.json(
      { error: e?.message ?? "Failed to load leaderboard" },
      { status: 500 }
    )
  }
}