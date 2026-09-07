"use client";

import Link from "next/link";
import { useState } from "react";

type Session = { id: string; status: string; started_at: string; started_location_id: number };
type Life = { status: string; death_count: number; revival_count: number; last_cause: string | null };
type Diligence = { daysMarked: number; markedToday: boolean; rewardOwned: boolean };

export function SoloConsole({ character, location, initialSession, initialLife, initialRevivalItems, initialDiligence }: {
  character: { id: string; name: string; level: number; hp_current: number; hp_max: number };
  location: { name_th: string; location_type: string; danger_level: number } | null;
  initialSession: Session | null;
  initialLife: Life;
  initialRevivalItems: number;
  initialDiligence: Diligence;
}) {
  const [session, setSession] = useState(initialSession);
  const [life, setLife] = useState(initialLife);
  const [hp, setHp] = useState(character.hp_current);
  const [items, setItems] = useState(initialRevivalItems);
  const [diligence, setDiligence] = useState(initialDiligence);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function change(action: "start" | "end") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/solo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId: character.id, action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "revival_required" ? "ต้องคืนชีพก่อนจึงจะจบ Solo ได้" : result.error === "wilderness_required" ? "ต้องเดินทางไปพื้นที่ป่าก่อนเริ่ม Solo" : result.error === "journey_active" ? "ต้องจบการเดินทางที่ค้างอยู่ก่อน" : "เปลี่ยนสถานะ Solo ไม่สำเร็จ");
      if (action === "start") { setSession(result.solo); setMessage("เริ่มการเดินทางเดี่ยวแล้ว · ระบบห้อง DM และเวทมนตร์ถูกปิด"); }
      else { setSession(null); setMessage("สิ้นสุดการเดินทางเดี่ยวแล้ว"); }
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "เปลี่ยนสถานะไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function lifeAction(action: "defeat" | "revive") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/solo/life", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId: character.id, action, cause: "พ่ายแพ้ระหว่างการเดินทางเดี่ยว" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "revival_item_required" ? "ไม่มีประกายเถ้าฟีนิกซ์สำหรับคืนชีพ" : result.error === "already_dead" ? "ตัวละครอยู่ในสภาพวิญญาณแล้ว" : "เปลี่ยนสถานะชีวิตไม่สำเร็จ");
      setLife((current) => ({ ...current, status: result.life.status, death_count: result.life.death_count ?? current.death_count, revival_count: result.life.revival_count ?? current.revival_count, last_cause: result.life.cause ?? current.last_cause }));
      setHp(result.life.hp_current);
      if (action === "revive") setItems(result.life.item_remaining);
      setMessage(action === "defeat" ? "ร่างล้มลง · ต้องใช้ไอเทมคืนชีพจึงจะเดินทางต่อหรือออกจาก Solo ได้" : "ประกายเถ้าฟีนิกซ์สลายไป · คืนชีพที่พลังครึ่งหนึ่ง");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "ดำเนินการไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function markDiligence() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/solo/diligence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId: character.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "already_marked_today" ? "บันทึกการสำรวจวันนี้แล้ว" : result.error === "character_dead" ? "วิญญาณไม่สามารถบันทึกการสำรวจได้" : "บันทึกความขยันไม่สำเร็จ");
      setDiligence({ daysMarked: result.diligence.days_marked, markedToday: true, rewardOwned: result.diligence.reward_owned });
      setMessage(result.diligence.reward_awarded ? "ครบ 3 วัน! ได้รับตราผู้เฝ้าพงไพรแบบผูกวิญญาณ" : `บันทึกวันที่ ${result.diligence.days_marked}/3 แล้ว`);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "บันทึกความขยันไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <main className="solo-shell">
    <header><Link href={`/characters/${character.id}`}>← Character Sheet</Link><span>MYTHWEAVE · SOLO EXPEDITION</span><i>{life.status === "dead" ? "SOUL STATE" : session ? "ACTIVE" : "INACTIVE"}</i></header>
    <section className="solo-hero"><small>ONE SOUL · THE WILDERNESS</small><h1>เส้นทางผู้เดียวดาย</h1><p>{character.name} · Level {character.level} · HP {hp}/{character.hp_max}</p></section>
    {message && <p className="solo-message">{message}</p>}
    <section className="solo-grid">
      <article className="solo-status"><small>CURRENT GROUND</small><h2>{location?.name_th ?? "ยังไม่มีตำแหน่ง"}</h2><b>{location?.location_type ?? "unknown"} · DANGER {location?.danger_level ?? 0}</b><p>{session ? "Solo session กำลังทำงาน ข้อจำกัดทั้งหมดบังคับจากเซิร์ฟเวอร์" : "เดินทางไป wilderness แล้วจึงเริ่ม session ได้"}</p><div><Link href={`/world?character=${character.id}`}>เปิด World Map</Link><button onClick={() => change(session ? "end" : "start")} disabled={busy || (!session && location?.location_type !== "wilderness")}>{busy ? "กำลังเปลี่ยนสถานะ…" : session ? "จบ Solo Session" : "เริ่ม Solo Session"}</button></div>{session && <div className="solo-life-actions"><button className="defeat" onClick={() => lifeAction("defeat")} disabled={busy || life.status === "dead"}>บันทึกการพ่ายแพ้</button><button onClick={() => lifeAction("revive")} disabled={busy || life.status !== "dead" || items < 1}>คืนชีพ · เหลือ {items}</button>{life.status === "dead" && <Link href="/dice">เข้าสู่ห้องแบบวิญญาณ</Link>}</div>}</article>
      <article className="solo-rules"><small>HARD RESTRICTIONS</small><h2>{life.status === "dead" ? "วิญญาณรอคืนชีพ" : "กฎของการเดินทางเดี่ยว"}</h2>{[["W", "WILDERNESS ONLY", "เดินทางและหยุดพักได้เฉพาะพื้นที่ป่า"], ["Ø", "NO MAGIC DROPS", "Relic Forge และไอเทมเวทถูกปิด"], ["1", "NO PARTY ROOMS", "เข้า สร้าง หรืออ่านห้องร่วมไม่ได้"], ["—", "NO DUNGEON MASTER", "ไม่มี DM console หรือคำบรรยายช่วยตัดสิน"]].map(([icon, title, text]) => <div key={title}><b>{icon}</b><span><strong>{title}</strong><p>{text}</p></span></div>)}<footer><span>ประกายเถ้าฟีนิกซ์</span><b>{items}</b><small>DEATH {life.death_count} · REVIVAL {life.revival_count}</small></footer></article>
      <article className="solo-diligence"><div><small>DILIGENCE REWARD · 3 DAYS</small><h2>{diligence.rewardOwned ? "ตราผู้เฝ้าพงไพร" : "บันทึกเส้นทางประจำวัน"}</h2><p>{diligence.rewardOwned ? "รางวัลผูกวิญญาณถาวร · ซื้อขายหรือโอนไม่ได้" : "ออกสำรวจ Solo วันละหนึ่งครั้ง สะสมครบสามวันเพื่อรับตราผูกวิญญาณ"}</p></div><strong>{Math.min(diligence.daysMarked, 3)} / 3</strong><button onClick={markDiligence} disabled={busy || !session || life.status === "dead" || diligence.markedToday || diligence.rewardOwned}>{diligence.rewardOwned ? "รับรางวัลแล้ว" : diligence.markedToday ? "บันทึกวันนี้แล้ว" : "บันทึกการสำรวจวันนี้"}</button></article>
    </section>
  </main>;
}
