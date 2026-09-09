import { NextRequest, NextResponse } from "next/server"
import { isV2Error, requestID, v2Context } from "@/lib/v2/auth"
export async function GET(request: NextRequest) {
  const context = await v2Context(request); if (isV2Error(context)) return context
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 20), 1), 20)
  const { data, error } = await context.db.rpc("feed_page_v2", { p_viewer: context.user.id, p_cursor: request.nextUrl.searchParams.get("cursor"), p_limit: limit })
  return error ? NextResponse.json({ error: "Unable to load feed", requestId: requestID(request) }, { status: 500 }) : NextResponse.json(data, { headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestID(request) } })
}
