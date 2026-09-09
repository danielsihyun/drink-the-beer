import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isV2Error, requestID, v2Context } from "@/lib/v2/auth"
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await v2Context(request); if (isV2Error(context)) return context
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid asset", requestId: requestID(request) }, { status: 422 })
  const { data: path, error } = await context.db.rpc("authorize_media_delivery", { p_asset: id })
  if (error || !path) return NextResponse.json({ error: "Not found", requestId: requestID(request) }, { status: 404 })
  const { data, error: signedError } = await context.db.storage.from("drink-photos").createSignedUrl(path as string, 300)
  if (signedError || !data) return NextResponse.json({ error: "Unable to authorize media", requestId: requestID(request) }, { status: 409 })
  return NextResponse.json({ url: data.signedUrl, expiresIn: 300 }, { headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestID(request) } })
}
