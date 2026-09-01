import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { DEFAULT_APPEARANCE, findClass, findRace, type Appearance } from "../../lib/characters/catalog";
import { CharacterAvatar } from "../characters/character-avatar";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = { title: "ล็อบบี้ — Mythweave" };

export default async function LobbyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const displayName = String(user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Adventurer");
  const { data: characters } = await supabase.from("characters").select("id,name,race,character_class,level,hp_current,hp_max,appearance").order("created_at", { ascending: false });

  return (
    <main className="lobby-shell">
      <header className="lobby-topbar"><span className="lobby-brand">MYTHWEAVE</span><LogoutButton /></header>
      <section className="lobby-content">
        <span className="lobby-kicker">ADVENTURER VERIFIED</span>
        <h1>ยินดีต้อนรับ<br />{displayName}</h1>
        <p>{characters?.length ? "เลือกตัวละครที่ต้องการใช้ หรือสร้างตำนานบทใหม่ก่อนเข้าสู่ห้องกับเพื่อน" : "บัญชีของคุณพร้อมแล้ว ขั้นต่อไปคือสร้างตัวละคร เลือกเผ่าและอาชีพ ก่อนเข้าสู่ห้องผจญภัยกับเพื่อน"}</p>
        <div className="lobby-identity"><small>บัญชีที่กำลังใช้งาน</small><strong>{user.email}</strong></div>
        <div className="lobby-character-heading"><div><small>YOUR ADVENTURERS</small><h2>ตัวละครของคุณ</h2></div><Link href="/characters/new">+ สร้างตัวละคร</Link></div>
        {characters?.length ? <div className="lobby-characters">{characters.map((character) => {
          const race = findRace(character.race);
          const characterClass = findClass(character.character_class);
          return <Link className="lobby-character-card" href={`/characters/${character.id}`} key={character.id}><div className="lobby-avatar"><CharacterAvatar appearance={(character.appearance as Appearance) ?? DEFAULT_APPEARANCE} characterClass={character.character_class} name={character.name} race={character.race} /></div><div><small>LEVEL {character.level}</small><h3>{character.name}</h3><p>{race?.label} · {characterClass?.label}</p><span>HP {character.hp_current}/{character.hp_max}</span></div><i>เปิด Character Sheet →</i></Link>;
        })}</div> : <div className="lobby-empty"><span>✦</span><h3>ยังไม่มีตัวละคร</h3><p>เข้าสู่ Character Forge เพื่อสร้างผู้ผจญภัยคนแรก</p><Link href="/characters/new">สร้างตัวละครแรก →</Link></div>}
        <div className="lobby-next">
          <article><span>01 · READY</span><h2>สร้างตัวละคร</h2><p>เลือกเผ่า คลาส ค่าสถานะ และรูปลักษณ์เริ่มต้น</p></article>
          <article><span>02 · READY</span><h2>Character Sheet</h2><p>ดูและแก้ไข HP, stats และ inventory เบื้องต้น</p></article>
          <article><span>03 · NEXT</span><h2>ทอยเต๋าพร้อมกัน</h2><p>ส่งผลเต๋าแบบ real-time ให้ผู้เล่นในห้องเห็นพร้อมกัน</p></article>
        </div>
      </section>
    </main>
  );
}
