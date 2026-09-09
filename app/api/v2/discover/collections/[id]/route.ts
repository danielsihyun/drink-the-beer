import { NextRequest,NextResponse } from "next/server"
import { z } from "zod"
import { isV2Error,requestID,v2Context } from "@/lib/v2/auth"
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const c=await v2Context(request);if(isV2Error(c))return c;const {id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Invalid collection",requestId:requestID(request)},{status:422});const {data,error}=await c.db.rpc("collection_detail_v2",{p_viewer:c.user.id,p_collection:id});return error?NextResponse.json({error:"Collection not found",requestId:requestID(request)},{status:404}):NextResponse.json({collection:data},{headers:{"Cache-Control":"private, no-store","X-Request-ID":requestID(request)}})}
