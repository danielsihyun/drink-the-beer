import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isV2Error, requestID, v2Context } from "@/lib/v2/auth"

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]),
})

export async function POST(request: NextRequest) {
  const context = await v2Context(request)
  if (isV2Error(context)) return context
  const key = request.headers.get("idempotency-key")
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!key || !z.string().uuid().safeParse(key).success || !parsed.success) {
    return NextResponse.json({ error: "Invalid drink", requestId: requestID(request) }, { status: 422 })
  }
  const { data, error } = await context.db.rpc("create_custom_drink_v2", {
    p_name: parsed.data.name,
    p_category: parsed.data.category,
    p_key: key,
  })
  return error
    ? NextResponse.json({ error: "Unable to create drink", requestId: requestID(request) }, { status: 409 })
    : NextResponse.json({ drink: data }, { status: 201, headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestID(request) } })
}
