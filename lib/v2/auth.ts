import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

export type V2Context = { db: SupabaseClient; user: User }
export async function v2Context(request: NextRequest): Promise<V2Context | NextResponse> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!token || !url || !anonKey || !serviceKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return { user: data.user, db: createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } }) }
}
export const isV2Error = (value: unknown): value is NextResponse => value instanceof NextResponse
export const requestID = (request: NextRequest) => request.headers.get("x-request-id") ?? crypto.randomUUID()
