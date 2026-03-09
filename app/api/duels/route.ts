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

    const uid = user.id

    // Maintenance RPCs fire in parallel — both update duels state before we read it
    await Promise.all([
      supabaseAdmin.rpc("complete_expired_duels"),
      supabaseAdmin.rpc("update_user_duel_scores", { p_user_id: uid }),
    ])

    // Fetch all duels for this user
    const { data: duels, error: duelsErr } = await supabaseAdmin
      .from("duels")
      .select("*")
      .or(`challenger_id.eq.${uid},challenged_id.eq.${uid}`)
      .order("created_at", { ascending: false })

    if (duelsErr) throw duelsErr

    const rows = (duels ?? []) as any[]

    // Collect unique opponent IDs
    const oppIds = [
      ...new Set(rows.map((d) => (d.challenger_id === uid ? d.challenged_id : d.challenger_id))),
    ] as string[]

    const profileMap: Record<string, any> = {}

    if (oppIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, display_name, avatar_path")
        .in("id", oppIds)

      // Batch all avatar URLs in one shot
      const avatarPaths = [
        ...new Set((profiles ?? []).map((p: any) => p.avatar_path).filter(Boolean)),
      ] as string[]

      const avatarUrls =
        avatarPaths.length > 0
          ? await getBatchSignedUrls(supabaseAdmin, "profile-photos", avatarPaths, 3600)
          : []

      const avatarMap = new Map(avatarPaths.map((p, i) => [p, avatarUrls[i]]))

      for (const p of profiles ?? []) {
        profileMap[p.id] = {
          id: p.id,
          username: p.username,
          displayName: p.display_name || p.username,
          avatarUrl: p.avatar_path ? (avatarMap.get(p.avatar_path) ?? null) : null,
        }
      }
    }

    const formattedDuels = rows.map((d) => {
      const amChallenger = d.challenger_id === uid
      const oppId = amChallenger ? d.challenged_id : d.challenger_id
      return {
        ...d,
        opponent: profileMap[oppId] ?? {
          id: oppId,
          username: "unknown",
          displayName: "Unknown",
          avatarUrl: null,
        },
        amChallenger,
      }
    })

    return NextResponse.json({ duels: formattedDuels })
  } catch (e: any) {
    console.error("[/api/duels]", e)
    return NextResponse.json(
      { error: e?.message ?? "Failed to load duels" },
      { status: 500 }
    )
  }
}