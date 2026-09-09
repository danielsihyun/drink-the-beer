import { NextRequest,NextResponse } from "next/server"
import { isV2Error,requestID,v2Context } from "@/lib/v2/auth"
export async function GET(request:NextRequest){const c=await v2Context(request);if(isV2Error(c))return c;const {data,error}=await c.db.rpc("refresh_today_quest_progress_v2",{p_viewer:c.user.id});return error?NextResponse.json({error:"Unable to refresh quest progress",requestId:requestID(request)},{status:500}):NextResponse.json({quest:data},{headers:{"Cache-Control":"private, no-store","X-Request-ID":requestID(request)}})}
