import { NextRequest,NextResponse } from "next/server"
import { z } from "zod"
import { isV2Error,requestID,v2Context } from "@/lib/v2/auth"

const input=z.object({mimeType:z.enum(["image/jpeg","image/png","image/heic","image/heif"]),byteSize:z.number().int().min(1).max(8_000_000)})

export async function POST(request:NextRequest){
  const c=await v2Context(request);if(isV2Error(c))return c
  const body=input.safeParse(await request.json().catch(()=>null))
  if(!body.success)return NextResponse.json({error:"Invalid avatar upload",requestId:requestID(request)},{status:422})
  const ext={"image/jpeg":"jpg","image/png":"png","image/heic":"heic","image/heif":"heif"}[body.data.mimeType]
  const path=`${c.user.id}/${crypto.randomUUID()}.${ext}`
  const {data,error}=await c.db.storage.from("profile-photos").createSignedUploadUrl(path)
  return error||!data?NextResponse.json({error:"Unable to authorize avatar upload",requestId:requestID(request)},{status:409}):NextResponse.json({path:data.path,signedUrl:data.signedUrl,token:data.token},{status:201,headers:{"Cache-Control":"private, no-store"}})
}
