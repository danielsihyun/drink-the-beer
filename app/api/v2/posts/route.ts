import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isV2Error, requestID, v2Context } from "@/lib/v2/auth"
const schema = z.object({ assetId: z.string().uuid(), drinkId: z.string().uuid().nullable().optional(), drinkType: z.enum(["Beer","Seltzer","Wine","Cocktail","Shot","Spirit","Other"]), caption: z.string().max(280).optional(), takenAt: z.string().datetime(), timezoneId: z.string().min(1).max(128), timezoneOffsetMinutes: z.number().int().min(-840).max(840) })
export async function POST(request: NextRequest) {
  const context = await v2Context(request); if (isV2Error(context)) return context
  const key = request.headers.get("idempotency-key"), parsed = schema.safeParse(await request.json().catch(() => null))
  if (!key || !z.string().uuid().safeParse(key).success || !parsed.success) return NextResponse.json({ error: "Invalid post", requestId: requestID(request) }, { status: 422 })
  const v = parsed.data
  const { data, error } = await context.db.rpc("finalize_post", { p_asset: v.assetId, p_drink: v.drinkId ?? null, p_drink_type: v.drinkType, p_caption: v.caption ?? "", p_taken_at: v.takenAt, p_timezone: v.timezoneId, p_offset: v.timezoneOffsetMinutes, p_key: key })
  return error ? NextResponse.json({ error: "Unable to publish post", requestId: requestID(request) }, { status: 409 }) : NextResponse.json({ id: data }, { status: 201, headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestID(request) } })
}
