"use client";

import { useState } from "react";

const damageTypes = [{id:"fire",label:"ไฟ"},{id:"cold",label:"น้ำแข็ง"},{id:"lightning",label:"สายฟ้า"},{id:"radiant",label:"ศักดิ์สิทธิ์"},{id:"bludgeoning",label:"ทุบ"},{id:"piercing",label:"แทง"},{id:"slashing",label:"ฟัน"},{id:"poison",label:"พิษ"},{id:"psychic",label:"จิต"}];

export function MonsterWeaknessProbe({monsterId}:{monsterId:string}) {
  const [damageType,setDamageType]=useState("fire");
  const [damage,setDamage]=useState(10);
  const [result,setResult]=useState<{applied_damage:number;effective:boolean;multiplier:number}|null>(null);
  const [busy,setBusy]=useState(false);
  async function testHit(){setBusy(true);try{const response=await fetch("/api/monsters/damage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({monsterId,damageType,baseDamage:damage})});const body=await response.json();if(response.ok)setResult(body.result);}finally{setBusy(false);}}
  return <div className="weakness-probe"><small>DM DAMAGE TEST · จุดอ่อนถูกซ่อน</small><div><select value={damageType} onChange={event=>setDamageType(event.target.value)}>{damageTypes.map(type=><option value={type.id} key={type.id}>{type.label}</option>)}</select><input aria-label="ความเสียหายพื้นฐาน" type="number" min="1" max="999" value={damage} onChange={event=>setDamage(Math.max(1,Math.min(999,Number(event.target.value))))}/><button onClick={testHit} disabled={busy}>{busy?"…":"ทดสอบ"}</button></div>{result&&<p className={result.effective?"effective":"normal"}>{result.effective?`ได้ผลรุนแรง ×${result.multiplier}`:"ความเสียหายปกติ"} · {result.applied_damage} DMG</p>}</div>;
}
