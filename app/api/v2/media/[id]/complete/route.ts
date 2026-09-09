import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isV2Error, requestID, v2Context } from "@/lib/v2/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await v2Context(request); if (isV2Error(context)) return context
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid asset", requestId: requestID(request) }, { status: 422 })
  const { data, error } = await context.db.rpc("mark_media_uploaded", { p_asset: id })
  return error ? NextResponse.json({ error: "Unable to complete upload", requestId: requestID(request) }, { status: 409 }) : NextResponse.json(data, { headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestID(request) } })
}
