import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Server misconfigured (missing Supabase env vars)." }, { status: 500 })
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ---- token: Authorization header OR body.token ----
    let token: string | null = null

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || ""
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim()
    }

    if (!token) {
      // try body
      const body = await req.json().catch(() => null)
      if (body?.token && typeof body.token === "string") token = body.token.trim()
    }

    // guard against common bad values
    if (!token || token === "undefined" || token === "null") {
      return NextResponse.json(
        { error: "Missing/invalid auth token. Please sign in again and retry." },
        { status: 401 }
      )
    }

    // Verify the caller by validating token -> user
    const { data: userRes, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { error: "Invalid session token. Please sign in again and retry." },
        { status: 401 }
      )
    }

    const userId = userRes.user.id

    // 1) Delete DB rows (child -> parent)
    await admin.from("drink_logs").delete().eq("user_id", userId)
    await admin.from("profiles").delete().eq("id", userId)

    // 2) Delete storage files under <uid>/ in both buckets
    const drinkList = await admin.storage.from("drink-photos").list(userId, { limit: 1000 })
    if (drinkList.data?.length) {
      const paths = drinkList.data.map((f) => `${userId}/${f.name}`)
      await admin.storage.from("drink-photos").remove(paths)
    }

    const profList = await admin.storage.from("profile-photos").list(userId, { limit: 1000 })
    if (profList.data?.length) {
      const paths = profList.data.map((f) => `${userId}/${f.name}`)
      await admin.storage.from("profile-photos").remove(paths)
    }

    // 3) Delete auth user (last)
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(userId)
    if (delAuthErr) {
      return NextResponse.json({ error: delAuthErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown server error." }, { status: 500 })
  }
}
