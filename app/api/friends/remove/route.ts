import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Server not configured: missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      )
    }

    const auth = req.headers.get("authorization") || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 })

    const body = await req.json().catch(() => null)
    const friendId = body?.friendId as string | undefined
    if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 })

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // Identify caller from JWT
    const { data: userRes, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const meId = userRes.user.id

    if (meId === friendId) return NextResponse.json({ error: "Invalid friendId" }, { status: 400 })

      async function tryDeletePair(colA: string, colB: string) {
        // direction 1
        const r1 = (await admin
          .from("friendships")
          .delete()
          .eq("status", "accepted")
          .eq(colA as any, meId)
          .eq(colB as any, friendId)
          .select("id")
          .limit(1)) as any
      
        if (r1.error) return { ok: false as const, error: r1.error.message }
        if ((r1.data ?? []).length > 0) return { ok: true as const }
      
        // direction 2
        const r2 = (await admin
          .from("friendships")
          .delete()
          .eq("status", "accepted")
          .eq(colA as any, friendId)
          .eq(colB as any, meId)
          .select("id")
          .limit(1)) as any
      
        if (r2.error) return { ok: false as const, error: r2.error.message }
        if ((r2.data ?? []).length > 0) return { ok: true as const }
      
        return { ok: false as const, error: "Friendship not found." }
      }

    // Try common schemas (we stop on first one that works)
    const candidates: Array<[string, string]> = [
      ["requester_id", "addressee_id"],
      ["requester", "addressee"],
      ["user_id_1", "user_id_2"],
      ["user1_id", "user2_id"],
      ["user_a", "user_b"],
      ["user_low", "user_high"],
    ]

    let lastErr: string | null = null

    for (const [a, b] of candidates) {
      const res = await tryDeletePair(a, b)

      if (res.ok) {
        return NextResponse.json({ ok: true })
      }

      // If we got a "column does not exist" error, try the next candidate pair
      if (res.error?.includes("does not exist")) {
        lastErr = res.error
        continue
      }

      // Otherwise, return the real error (or not found)
      return NextResponse.json({ error: res.error }, { status: res.error === "Friendship not found." ? 404 : 400 })
    }

    // If every candidate failed due to missing columns, surface the last message
    return NextResponse.json(
      { error: lastErr ?? "Could not remove friend." },
      { status: 400 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
