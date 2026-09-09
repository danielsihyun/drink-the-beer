import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isV2Error, requestID, v2Context } from "@/lib/v2/auth"

export async function DELETE(request: NextRequest) {
  const context = await v2Context(request)
  if (isV2Error(context)) return context
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: "Account service unavailable", requestId: requestID(request) }, { status: 503 })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const userID = context.user.id
  const { data: assets } = await admin.from("media_assets").select("original_key,thumbnail_key").eq("owner_id", userID)
  const drinkPaths = (assets ?? []).flatMap((asset: { original_key: string | null; thumbnail_key: string | null }) => [asset.original_key, asset.thumbnail_key]).filter((value): value is string => Boolean(value))
  if (drinkPaths.length) await admin.storage.from("drink-photos").remove(drinkPaths)
  const { data: avatars } = await admin.storage.from("profile-photos").list(userID, { limit: 1000 })
  const avatarPaths = (avatars ?? []).map((item) => `${userID}/${item.name}`)
  if (avatarPaths.length) await admin.storage.from("profile-photos").remove(avatarPaths)
  const { error } = await admin.auth.admin.deleteUser(userID)
  if (error) return NextResponse.json({ error: "Unable to delete account", requestId: requestID(request) }, { status: 409 })
  return new NextResponse(null, { status: 204, headers: { "X-Request-ID": requestID(request) } })
}
