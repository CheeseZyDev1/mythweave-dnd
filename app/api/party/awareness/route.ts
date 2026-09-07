import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request:Request){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
  const query=new URL(request.url).searchParams;const tableId=query.get("tableId")??"";const characterId=query.get("characterId")??"";
  if(!UUID.test(tableId)||!UUID.test(characterId))return NextResponse.json({error:"invalid_request"},{status:400});
  const{data,error}=await supabase.rpc("get_party_awareness",{target_table_id:tableId,viewer_character_id:characterId});
  if(error){const detail=error.message;const code=detail.includes("not a member")?"not_a_member":detail.includes("not found")||detail.includes("not linked")?"character_not_linked":"awareness_failed";return NextResponse.json({error:code},{status:code==="not_a_member"?403:code==="character_not_linked"?404:500});}
  return NextResponse.json({members:data??[]});
}
