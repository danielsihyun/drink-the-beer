import { NextRequest, NextResponse } from "next/server"
import { isV2Error, requestID, v2Context } from "@/lib/v2/auth"
export async function GET(request:NextRequest) { const context=await v2Context(request); if(isV2Error(context)) return context; const {data,error}=await context.db.rpc("progression_summary_v2",{p_viewer:context.user.id}); return error?NextResponse.json({error:"Unable to load progression",requestId:requestID(request)},{status:500}):NextResponse.json(data,{headers:{"Cache-Control":"private, no-store","X-Request-ID":requestID(request)}}) }
