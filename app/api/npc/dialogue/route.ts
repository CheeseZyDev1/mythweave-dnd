import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTEXTS=["greeting","farewell","shop","rumor","quest","weather","danger","tavern"];
const SPEAKERS=["villager","merchant","guard","traveller","innkeeper","scholar","generic"];

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
  const body=await request.json().catch(()=>null);
  const tableId=String(body?.tableId??"");
  const npcName=String(body?.npcName??"").trim().replace(/\s+/g," ").slice(0,40);
  const speakerType=String(body?.speakerType??"");
  const context=String(body?.context??"");
  if(!UUID.test(tableId)||!npcName||!SPEAKERS.includes(speakerType)||!CONTEXTS.includes(context))return NextResponse.json({error:"invalid_request"},{status:400});
  const {data,error}=await supabase.rpc("trigger_npc_dialogue",{target_table_id:tableId,target_npc_name:npcName,target_speaker_type:speakerType,target_context:context}).single();
  if(error||!data){const forbidden=error?.message.includes("not a member");return NextResponse.json({error:forbidden?"not_a_member":"dialogue_failed"},{status:forbidden?403:500});}
  return NextResponse.json({dialogue:data},{status:201});
}

