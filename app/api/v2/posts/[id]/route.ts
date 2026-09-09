import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isV2Error, requestID, v2Context } from "@/lib/v2/auth"
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await v2Context(request); if (isV2Error(context)) return context
  const { id } = await params, key = request.headers.get("idempotency-key")
  if (!z.string().uuid().safeParse(id).success || !key || !z.string().uuid().safeParse(key).success) return NextResponse.json({ error: "Invalid delete request", requestId: requestID(request) }, { status: 422 })
  const { data, error } = await context.db.rpc("soft_delete_post", { p_post: id, p_key: key })
  return error ? NextResponse.json({ error: "Unable to delete post", requestId: requestID(request) }, { status: 409 }) : NextResponse.json(data, { headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestID(request) } })
}
