import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isV2Error, requestID, v2Context } from "@/lib/v2/auth"

const schema = z.object({
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  mimeType: z.enum(["image/jpeg", "image/heic", "image/heif"]),
  byteSize: z.number().int().min(1).max(15_000_000),
  width: z.number().int().min(1).max(12_000).nullable().optional(),
  height: z.number().int().min(1).max(12_000).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const context = await v2Context(request)
  if (isV2Error(context)) return context
  const idempotencyKey = request.headers.get("idempotency-key")
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!idempotencyKey || !z.string().uuid().safeParse(idempotencyKey).success || !parsed.success) return NextResponse.json({ error: "Invalid upload request", requestId: requestID(request) }, { status: 422 })
  const input = parsed.data
  const { data: asset, error } = await context.db.rpc("create_media_upload", { p_hash: input.contentHash, p_mime: input.mimeType, p_bytes: input.byteSize, p_width: input.width ?? null, p_height: input.height ?? null, p_key: idempotencyKey })
  if (error || !asset) return NextResponse.json({ error: "Unable to create upload", requestId: requestID(request) }, { status: 409 })
  const result = asset as { id: string; key: string; state: string }
  const { data: upload, error: uploadError } = await context.db.storage.from("drink-photos").createSignedUploadUrl(result.key)
  if (uploadError || !upload) return NextResponse.json({ error: "Unable to authorize upload", requestId: requestID(request) }, { status: 409 })
  return NextResponse.json({ assetId: result.id, path: upload.path, signedUrl: upload.signedUrl, token: upload.token }, { status: 201, headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestID(request) } })
}
