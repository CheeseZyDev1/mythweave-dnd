import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request:Request){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"unauthorized"},{status:401});const body=await request.json().catch(()=>null);const action=String(body?.action??"");const characterId=String(body?.characterId??"");const entryId=String(body?.entryId??"");if(!UUID.test(characterId)||!UUID.test(entryId)||!["share","guild"].includes(action))return NextResponse.json({error:"invalid_request"},{status:400});
  let data;let error;
  if(action==="share"){
    const mode=String(body?.mode??"");const tableId=body?.tableId?String(body.tableId):null;const recipientUserId=body?.recipientUserId?String(body.recipientUserId):null;if(!["party","direct"].includes(mode)||(mode==="party"&&!UUID.test(tableId??""))||(mode==="direct"&&!UUID.test(recipientUserId??"")))return NextResponse.json({error:"invalid_request"},{status:400});
    ({data,error}=await supabase.rpc("share_bestiary_entry",{target_character_id:characterId,target_entry_id:entryId,target_mode:mode,target_table_id:tableId,target_recipient_user_id:recipientUserId}));
  }else{
    const mode=String(body?.mode??"");const guildId=Number(body?.guildId);if(!["sell","donate"].includes(mode)||!Number.isInteger(guildId)||guildId<1)return NextResponse.json({error:"invalid_request"},{status:400});
    ({data,error}=await supabase.rpc("contribute_bestiary_to_guild",{target_character_id:characterId,target_entry_id:entryId,target_guild_id:guildId,target_mode:mode}));
  }
  if(error||!data){const detail=error?.message??"";const code=detail.includes("already")?"already_shared":detail.includes("unconfirmed")?"knowledge_unconfirmed":detail.includes("party required")?"party_required":detail.includes("recipient")?"recipient_unavailable":detail.includes("not found")?"not_found":"share_failed";return NextResponse.json({error:code},{status:["already_shared","knowledge_unconfirmed"].includes(code)?409:["party_required","recipient_unavailable"].includes(code)?403:code==="not_found"?404:500});}
  return NextResponse.json({result:data},{status:201});
}
