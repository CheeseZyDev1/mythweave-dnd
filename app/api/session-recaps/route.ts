import{NextResponse}from"next/server";
import{createClient}from"../../../lib/supabase/server";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(value:string,length=160)=>value.replace(/\s+/g," ").trim().slice(0,length);

export async function GET(request:Request){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const tableId=new URL(request.url).searchParams.get("tableId")??"";if(!UUID.test(tableId))return NextResponse.json({error:"invalid_request"},{status:400});
 const{data,error}=await supabase.from("session_recaps").select("*").eq("table_id",tableId).order("sequence",{ascending:false}).limit(20);
 if(error)return NextResponse.json({error:"recaps_failed"},{status:500});return NextResponse.json({recaps:data});
}

export async function POST(request:Request){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const body=await request.json().catch(()=>null);const tableId=String(body?.tableId??"");if(!UUID.test(tableId))return NextResponse.json({error:"invalid_request"},{status:400});
 const[{data:member},{data:table},{data:lastRecap}]=await Promise.all([
  supabase.from("dice_table_members").select("role").eq("table_id",tableId).eq("user_id",user.id).maybeSingle(),
  supabase.from("dice_tables").select("created_at").eq("id",tableId).maybeSingle(),
  supabase.from("session_recaps").select("sequence,ended_at").eq("table_id",tableId).order("sequence",{ascending:false}).limit(1).maybeSingle()
 ]);
 if(!member)return NextResponse.json({error:"not_found"},{status:404});if(member.role!=="dm")return NextResponse.json({error:"dm_required"},{status:403});if(!table)return NextResponse.json({error:"not_found"},{status:404});
 const startedAt=lastRecap?.ended_at??table.created_at;const endedAt=new Date().toISOString();
 const range=<T>(query:T)=>query;
 const[memberResult,messageResult,rollResult,narrationResult,combatResult,environmentResult,initiativeResult,trackerResult]=await Promise.all([
  supabase.from("dice_table_members").select("display_name,role").eq("table_id",tableId),
  range(supabase.from("room_messages").select("sender_name,content,created_at").eq("table_id",tableId).gte("created_at",startedAt).lte("created_at",endedAt).order("created_at")),
  range(supabase.from("dice_rolls").select("roller_name,dice_sides,rolls,total,created_at").eq("table_id",tableId).gte("created_at",startedAt).lte("created_at",endedAt).order("created_at")),
  range(supabase.from("dm_narrations").select("dm_name,narration,created_at").eq("table_id",tableId).gte("created_at",startedAt).lte("created_at",endedAt).order("created_at")),
  range(supabase.from("timed_combat_actions").select("character_name,grade,applied_damage,weakness_effective,created_at").eq("table_id",tableId).eq("status","resolved").gte("created_at",startedAt).lte("created_at",endedAt).order("created_at")),
  range(supabase.from("combat_environment_objects").select("name_th,effect_th,applied_damage,triggered_at").eq("table_id",tableId).eq("status","spent").gte("triggered_at",startedAt).lte("triggered_at",endedAt).order("triggered_at")),
  supabase.from("initiative_entries").select("name,initiative").eq("table_id",tableId).order("initiative",{ascending:false}),
  supabase.from("initiative_trackers").select("round_number,active,current_entry_id").eq("table_id",tableId).maybeSingle()
 ]);
 const failed=[memberResult,messageResult,rollResult,narrationResult,combatResult,environmentResult,initiativeResult,trackerResult].find(result=>result.error);if(failed?.error)return NextResponse.json({error:"source_failed"},{status:500});
 const members=memberResult.data??[],messages=messageResult.data??[],rolls=rollResult.data??[],narrations=narrationResult.data??[],combat=combatResult.data??[],environment=environmentResult.data??[],initiative=initiativeResult.data??[];
 const natural20s=rolls.reduce((sum,roll)=>sum+(roll.dice_sides===20?roll.rolls.filter((value:number)=>value===20).length:0),0);const damage=[...combat,...environment].reduce((sum,item)=>sum+Number(item.applied_damage??0),0);
 const participants=[...new Set([...members.map(item=>item.display_name),...messages.map(item=>item.sender_name),...rolls.map(item=>item.roller_name)])];
 const highlights:{type:string;title:string;detail:string}[]=[];
 for(const item of narrations.slice(-3))highlights.push({type:"story",title:`คำบรรยายจาก ${item.dm_name}`,detail:clean(item.narration,220)});
 const topRoll=[...rolls].sort((a,b)=>b.total-a.total)[0];if(topRoll)highlights.push({type:"dice",title:`แต้มเด่น ${topRoll.total}`,detail:`${topRoll.roller_name} ทอยได้ ${topRoll.total}${natural20s?` · มี Natural 20 รวม ${natural20s} ครั้ง`:""}`});
 const bestAttack=[...combat].sort((a,b)=>Number(b.applied_damage??0)-Number(a.applied_damage??0))[0];if(bestAttack)highlights.push({type:"combat",title:`ศึกของ ${bestAttack.character_name}`,detail:`จังหวะ ${bestAttack.grade??"miss"} สร้างความเสียหาย ${bestAttack.applied_damage??0}${bestAttack.weakness_effective?" และโจมตีถูกจุดอ่อน":""}`});
 const lastMessage=messages.at(-1);if(lastMessage)highlights.push({type:"chat",title:"ถ้อยคำล่าสุดของปาร์ตี้",detail:`${lastMessage.sender_name}: ${clean(lastMessage.content,180)}`});
 if(!highlights.length)highlights.push({type:"camp",title:"ช่วงพักระหว่างบท",detail:"คณะนักผจญภัยรวมตัวและเตรียมพร้อมสำหรับเหตุการณ์ถัดไป"});
 const story=narrations.length?clean(narrations.at(-1)!.narration,260):messages.length?`การเดินทางดำเนินต่อหลังจาก ${clean(messages.at(-1)!.content,200)}`:"เหล่านักผจญภัยรวมตัว เตรียมอุปกรณ์ และวางแผนสำหรับเส้นทางเบื้องหน้า";
 const roster=participants.length?participants.join(", "):"สมาชิกปาร์ตี้";const combatText=combat.length||environment.length?` เกิดการปะทะ ${combat.length} จังหวะและใช้สภาพแวดล้อม ${environment.length} ครั้ง สร้างความเสียหายรวม ${damage} หน่วย`:" ยังไม่มีการต่อสู้ถูกบันทึกในบทนี้";const initiativeText=trackerResult.data?.active?` Initiative กำลังดำเนินอยู่ในรอบ ${trackerResult.data.round_number} โดยมี ${initiative.length} ผู้เข้าร่วม`:` มีผู้เข้าร่วม initiative ${initiative.length} ราย`;
 const summary=`${roster} ร่วมอยู่ในบทการผจญภัยนี้ ${story}.${combatText} ปาร์ตี้สนทนา ${messages.length} ข้อความและทอยเต๋า ${rolls.length} ครั้ง${natural20s?` พบ Natural 20 จำนวน ${natural20s} ครั้ง`:""}.${initiativeText}.`;
 const metrics={participants:participants.length,messages:messages.length,rolls:rolls.length,natural20s,narrations:narrations.length,combatActions:combat.length+environment.length,damage};
 const sequence=Number(lastRecap?.sequence??0)+1;const title=`บทที่ ${sequence} · ${narrations.length?clean(narrations.at(-1)!.narration,55):combat.length?"เสียงศึกบนเส้นทาง":"รอยเท้าแห่งการผจญภัย"}`;
 const{data:recap,error}=await supabase.rpc("store_session_recap",{target_table_id:tableId,target_title:title,target_summary:summary,target_highlights:highlights,target_metrics:metrics,target_started_at:startedAt,target_ended_at:endedAt}).single();
 if(error||!recap){const dm=error?.message.includes("dm required");return NextResponse.json({error:dm?"dm_required":"recap_failed"},{status:dm?403:500});}return NextResponse.json({recap},{status:201});
}
