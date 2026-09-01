import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export const metadata: Metadata = { title: "World Content — Mythweave" };

export default async function ContentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const [{ data: items }, { data: dialogue }, { data: quests }, { data: events }] = await Promise.all([
    supabase.from("content_items").select("id,name_th,name_en,rarity,category,weight,tags").order("rarity").order("id").limit(12),
    supabase.from("dialogue_pool").select("id,context,speaker_type,text_th,weight").order("id").limit(8),
    supabase.from("quest_templates").select("id,title_th,quest_type,description_th,weight").order("id").limit(6),
    supabase.from("event_templates").select("id,title_th,event_type,description_th,weight").order("id").limit(6),
  ]);
  const [{ count: common }, { count: uncommon }, { count: dialogueCount }, { count: questCount }, { count: eventCount }] = await Promise.all([
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("rarity", "common"),
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("rarity", "uncommon"),
    supabase.from("dialogue_pool").select("id", { count: "exact", head: true }),
    supabase.from("quest_templates").select("id", { count: "exact", head: true }),
    supabase.from("event_templates").select("id", { count: "exact", head: true }),
  ]);

  return <main className="content-shell"><header><Link href="/lobby">← กลับล็อบบี้</Link><span>MYTHWEAVE · WORLD CONTENT</span><i>PHASE 2</i></header><section className="content-hero"><small>STATIC CONTENT POOL</small><h1>คลังเรื่องราว<br />แห่งทวีปแรก</h1><p>เนื้อหาพื้นฐานที่ระบบ NPC ร้านค้า ภารกิจ และเหตุการณ์จะหยิบไปใช้ด้วยค่า weight</p><div>{[["COMMON",common],["UNCOMMON",uncommon],["DIALOGUE",dialogueCount],["QUEST",questCount],["EVENT",eventCount]].map(([label,count]) => <article key={String(label)}><strong>{count ?? 0}</strong><span>{label}</span></article>)}</div></section><section className="content-grid"><article><header><small>ITEM POOL</small><h2>อุปกรณ์เริ่มต้น</h2></header>{items?.map((item) => <div key={item.id}><b>{item.name_th}</b><span>{item.name_en}</span><i>{item.rarity} · {item.category} · W{item.weight}</i></div>)}</article><article><header><small>DIALOGUE POOL</small><h2>เสียงของผู้คน</h2></header>{dialogue?.map((line) => <blockquote key={line.id}>“{line.text_th}”<small>{line.speaker_type} · {line.context} · W{line.weight}</small></blockquote>)}</article><article><header><small>QUEST TEMPLATES</small><h2>ภารกิจหมุนเวียน</h2></header>{quests?.map((quest) => <div key={quest.id}><b>{quest.title_th}</b><span>{quest.description_th}</span><i>{quest.quest_type} · W{quest.weight}</i></div>)}</article><article><header><small>EVENT TEMPLATES</small><h2>เหตุการณ์ในเมือง</h2></header>{events?.map((event) => <div key={event.id}><b>{event.title_th}</b><span>{event.description_th}</span><i>{event.event_type} · W{event.weight}</i></div>)}</article></section></main>;
}

