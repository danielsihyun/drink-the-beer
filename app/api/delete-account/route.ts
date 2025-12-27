import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function POST() {
  const cookieStore = await cookies()

  // 1) Server client uses anon key + cookies to identify the current user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = userRes.user.id

  // 2) Admin client uses SERVICE ROLE to delete the user (server-only!)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Optional cleanup (recommended): delete app data first (tables/storage)
  // Note: service role bypasses RLS so this works reliably.
  await admin.from("drink_logs").delete().eq("user_id", userId)
  await admin.from("profiles").delete().eq("id", userId)

  // TODO (optional): if you stored avatar/drink photo paths, delete storage objects too.

  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
