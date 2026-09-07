"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export type AwarenessMember={user_id:string;display_name:string;role:string;character_id:string|null;character_name:string|null;location_id:number|null;location_name:string|null;awareness_tier:string};
const labels:Record<string,{title:string;detail:string}>={same_location:{title:"อยู่จุดเดียวกัน",detail:"มองเห็นและสื่อสารกันได้ทันที"},same_city:{title:"อยู่เมือง/ภูมิภาคเดียวกัน",detail:"รับรู้ตำแหน่งคร่าว ๆ ของกันและกัน"},far_city:{title:"อยู่คนละเมือง",detail:"ไกลเกินกว่าจะรับรู้รายละเอียด"},unknown:{title:"ไม่ทราบตำแหน่ง",detail:"สมาชิกยังไม่ได้ผูกตัวละคร"}};

export function PartyAwareness({tableId,viewerCharacterId,initialMembers}:{tableId:string;viewerCharacterId:string;initialMembers:AwarenessMember[]}){
  const[members,setMembers]=useState(initialMembers);
  useEffect(()=>{if(!viewerCharacterId)return;const refresh=async()=>{const response=await fetch(`/api/party/awareness?tableId=${tableId}&characterId=${viewerCharacterId}`);if(response.ok)setMembers((await response.json()).members);};const supabase=createClient();const channel=supabase.channel(`party-awareness-${tableId}`).on("postgres_changes",{event:"*",schema:"public",table:"character_world_positions"},()=>{void refresh();}).subscribe();return()=>{void supabase.removeChannel(channel);};},[tableId,viewerCharacterId]);
  return <section className="party-awareness"><header><div><small>PARTY SPLIT · LIVE</small><h2>ตำแหน่งของปาร์ตี้</h2></div><span>{members.length} LINKED</span></header><div>{members.map(member=>{const tier=labels[member.awareness_tier]??labels.unknown;return <article className={member.awareness_tier} key={member.user_id}><b>{(member.character_name??member.display_name).slice(0,1).toUpperCase()}</b><span><strong>{member.character_name??member.display_name}</strong><small>{member.location_name??"ยังไม่ทราบตำแหน่ง"} · {member.role.toUpperCase()}</small></span><i><em>{tier.title}</em>{tier.detail}</i></article>;})}</div></section>;
}
