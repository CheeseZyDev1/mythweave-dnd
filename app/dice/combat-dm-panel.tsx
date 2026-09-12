"use client";
import{useEffect,useMemo,useState}from"react";
import{createClient}from"../../lib/supabase/client";
import type{CombatDmMoment}from"../../lib/combat/dm-moments";

const choices=[{id:"dice",label:"ยืนยันผลเต๋า",hint:"ดำเนินการต่อสู้ต่อตามผลเดิม"},{id:"fortune",label:"ให้โชคช่วย",hint:"เปิดทางรอดหรือโอกาสพิเศษ"},{id:"twist",label:"เพิ่มเหตุพลิกผัน",hint:"คงผลเดิม แต่เพิ่มผลตามมาเล็กน้อย"}]as const;
export function CombatDmPanel({tableId,isDm,initialMoments}:{tableId:string;isDm:boolean;initialMoments:CombatDmMoment[]}){
 const[moments,setMoments]=useState(initialMoments);const[busy,setBusy]=useState("");const[message,setMessage]=useState("");
 useEffect(()=>{const supabase=createClient();const merge=(item:CombatDmMoment)=>setMoments(current=>[item,...current.filter(row=>row.id!==item.id)].slice(0,10));const channel=supabase.channel(`combat-dm-${tableId}`).on("postgres_changes",{event:"*",schema:"public",table:"combat_dm_moments",filter:`table_id=eq.${tableId}`},payload=>merge(payload.new as CombatDmMoment)).subscribe();return()=>{void supabase.removeChannel(channel)}},[tableId]);
 const pending=useMemo(()=>moments.filter(item=>item.status==="pending").sort((a,b)=>a.created_at.localeCompare(b.created_at)),[moments]);
 async function resolve(id:string,resolution:typeof choices[number]["id"]){setBusy(id);setMessage("");const supabase=createClient();const{data,error}=await supabase.rpc("resolve_combat_dm_moment",{target_moment_id:id,target_resolution:resolution});if(error)setMessage(error.message.includes("dm required")?"เฉพาะ DM เท่านั้น":"ตัดสินจังหวะนี้ไม่สำเร็จ");else{setMoments(current=>current.map(item=>item.id===id?data as CombatDmMoment:item));setMessage("เผยแพร่คำตัดสินให้ทุกคนแล้ว")}setBusy("")}
 if(!pending.length)return null;const moment=pending[0];
 return <section className={`combat-dm-moment ${moment.trigger_type}`}><header><div><small>HYBRID DM · {pending.length} จังหวะรอตัดสิน</small><h2>{moment.title_th}</h2></div><b>{moment.trigger_type.toUpperCase()}</b></header><p>{moment.description_th}</p>{isDm?<div className="combat-dm-choices">{choices.map(choice=><button key={choice.id}disabled={Boolean(busy)}onClick={()=>resolve(moment.id,choice.id)}><strong>{choice.label}</strong><span>{choice.hint}</span></button>)}</div>:<div className="combat-dm-wait">⏳ DM กำลังตัดสินจังหวะนี้…</div>}{message&&<small className="combat-dm-message">{message}</small>}</section>
}
