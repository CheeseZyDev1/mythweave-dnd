import{NextResponse}from"next/server";
import{createClient}from"../../../../lib/supabase/server";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
  const body=await request.json().catch(()=>null);const action=String(body?.action??"");
  if(action==="start"){
    const monsterId=String(body?.monsterId??"");const characterId=String(body?.characterId??"");if(!UUID.test(monsterId)||!UUID.test(characterId))return NextResponse.json({error:"invalid_request"},{status:400});
    const{data,error}=await supabase.rpc("start_timed_attack_synced",{target_monster_id:monsterId,target_character_id:characterId});if(error||!data){const message=error?.message??"";const code=message.includes("player required")?"player_required":message.includes("not linked")?"character_not_linked":message.includes("attack pending")?"attack_pending":message.includes("defeated")?"defeated":message.includes("not found")?"not_found":"start_failed";return NextResponse.json({error:code},{status:code==="player_required"?403:code==="not_found"?404:code==="start_failed"?500:409});}return NextResponse.json({combatAction:data.action,serverNow:data.server_now},{status:201});
  }
  if(action==="resolve"){
    const actionId=String(body?.actionId??"");if(!UUID.test(actionId))return NextResponse.json({error:"invalid_request"},{status:400});
    const{data,error}=await supabase.rpc("resolve_timed_attack",{target_action_id:actionId});if(error||!data){const message=error?.message??"";const code=message.includes("player required")?"player_required":message.includes("timing not open")?"timing_not_open":message.includes("already resolved")?"already_resolved":message.includes("not found")?"not_found":"resolve_failed";return NextResponse.json({error:code},{status:code==="player_required"?403:code==="not_found"?404:code==="resolve_failed"?500:409});}return NextResponse.json(data);
  }
  return NextResponse.json({error:"invalid_request"},{status:400});
}
