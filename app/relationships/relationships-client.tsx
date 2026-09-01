"use client";

import Link from "next/link";
import { useState } from "react";

type Profile = { id: number; slug: string; name_th: string; name_en: string; role_th: string; location_th: string; description_th: string };
type Affinity = { id: string; npc_id: number; score: number; interactions: number; last_interaction_at: string | null };
type Schedule = { npc_id: number; period: string; start_hour: number; end_hour: number; location_th: string; activity_th: string; available_for_interaction: boolean };
const actions = [
  { id: "talk", label: "พูดคุย", delta: "+1" },
  { id: "gift", label: "ให้ของขวัญ", delta: "+5 · 25 CP" },
  { id: "help", label: "ช่วยเหลือ", delta: "+8" },
  { id: "insult", label: "ดูหมิ่น", delta: "−10" },
];
function tier(score: number) {
  if (score <= -50) return ["ศัตรู", "hostile"];
  if (score < 0) return ["ระแวง", "wary"];
  if (score < 20) return ["เป็นกลาง", "neutral"];
  if (score < 50) return ["เป็นมิตร", "friendly"];
  return ["ไว้ใจ", "trusted"];
}

export function RelationshipsClient({ character, profiles, schedules, worldHours, initialAffinities }: { character: { id: string; name: string }; profiles: Profile[]; schedules: Schedule[]; worldHours: number; initialAffinities: Affinity[] }) {
  const [affinities, setAffinities] = useState(initialAffinities);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  async function interact(npcId: number, action: string) {
    setBusy(npcId); setMessage("");
    try {
      const response = await fetch("/api/npc/affinity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId: character.id, npcId, action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "cooldown" ? "NPC คนนี้ต้องการเวลาสักครู่ก่อนคุยอีกครั้ง" : result.error === "npc_unavailable" ? "NPC ไม่อยู่ในจุดที่คุยได้ตอนนี้" : result.error === "insufficient_funds" ? "เหรียญไม่พอสำหรับของขวัญ" : "การโต้ตอบไม่สำเร็จ");
      const incoming = result.affinity;
      setAffinities((current) => [...current.filter((item) => item.npc_id !== npcId), { id: incoming.id, npc_id: npcId, score: incoming.score, interactions: incoming.interactions, last_interaction_at: incoming.last_interaction_at }]);
      setMessage(`${incoming.npc_name}: ${incoming.delta > 0 ? "+" : ""}${incoming.delta} ความสัมพันธ์ · ${tier(incoming.score)[0]}`);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "การโต้ตอบไม่สำเร็จ"); }
    finally { setBusy(null); }
  }
  return <main className="relationship-shell">
    <header><Link href={`/characters/${character.id}`}>← Character Sheet</Link><span>MYTHWEAVE · RELATIONSHIPS</span><i>{character.name}</i></header>
    <section className="relationship-hero"><small>PEOPLE REMEMBER</small><h1>สายสัมพันธ์แห่งโลก</h1><p>ทุกการกระทำเปลี่ยนท่าทีของ NPC · การให้ของขวัญหักเหรียญจริง</p></section>
    {message && <p className="relationship-message">{message}</p>}
    <section className="relationship-grid">{profiles.map((npc) => {
      const affinity = affinities.find((item) => item.npc_id === npc.id);
      const score = affinity?.score ?? 0;
      const [tierName, tierClass] = tier(score);
      const hour=(8+worldHours)%24;const schedule=schedules.find((item)=>item.npc_id===npc.id&&(item.start_hour<item.end_hour?hour>=item.start_hour&&hour<item.end_hour:hour>=item.start_hour||hour<item.end_hour));const available=schedule?.available_for_interaction??false;
      return <article className={`${tierClass} ${available ? "npc-available" : "npc-away"}`} key={npc.id}>
        <header><div className="npc-sigil">{npc.name_en.slice(0, 1)}</div><div><small>{schedule?.location_th??npc.location_th}</small><h2>{npc.name_th}</h2><span>{npc.name_en} · {npc.role_th}</span></div><b>{score >= 0 ? "+" : ""}{score}<small>{tierName}</small></b></header>
        <p>{npc.description_th}</p>
        <div className="npc-schedule"><b>{available ? "● พบได้ตอนนี้" : "○ ไม่ว่าง"}</b><span>{schedule?.activity_th} · {String(schedule?.start_hour??0).padStart(2,"0")}:00–{String(schedule?.end_hour??0).padStart(2,"0")}:00</span></div>
        <div className="affinity-track"><i style={{ width: `${(score + 100) / 2}%` }} /></div>
        <footer>{actions.map((action) => <button key={action.id} onClick={() => interact(npc.id, action.id)} disabled={busy !== null||!available}><span>{action.label}</span><small>{action.delta}</small></button>)}</footer>
      </article>;
    })}</section>
  </main>;
}
