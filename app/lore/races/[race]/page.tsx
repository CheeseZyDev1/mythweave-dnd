import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { findRace, STAT_LABELS, type StatKey } from "../../../../lib/characters/catalog";

export const metadata: Metadata = { title: "Race Chronicle — Mythweave" };

const sceneByRace: Record<string, string> = { human: "/assets/riverrest.png", elf: "/assets/elderwood.png", dwarf: "/assets/azuredeep.png", half_orc: "/assets/nightcrown.png", goblin: "/assets/riverrest.png", fallen: "/assets/nightcrown.png" };

export default async function RaceLoreDetail({ params, searchParams }: { params: Promise<{ race: string }>; searchParams: Promise<{ character?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const [{ race }, { character }] = await Promise.all([params, searchParams]);
  const catalog = findRace(race);
  if (!catalog) notFound();
  const { data: lore } = await supabase.from("race_lore").select("*,world_locations(name_th,name_en,description_th,scene_asset)").eq("race_id", race).maybeSingle();
  if (!lore) notFound();
  const location = lore.world_locations as unknown as { name_th: string; name_en: string; description_th: string; scene_asset: string | null };
  return <main className="race-chronicle" style={{ "--race-accent": lore.accent_color, "--race-scene": `url('${location.scene_asset ?? sceneByRace[race]}')` } as React.CSSProperties}>
    <header><Link href={`/lore/races${character ? `?character=${character}` : ""}`}>← สารบัญเผ่า</Link><span>MYTHWEAVE · RACE CHRONICLE</span><Link href={character ? `/characters/${character}` : "/lobby"}>{character ? "Character Sheet" : "Lobby"} →</Link></header>
    <section className="chronicle-hero"><div className="chronicle-sigil">{lore.sigil}</div><small>{catalog.tagline}</small><h1>{lore.name_th}</h1><h2>{lore.title_th}</h2><p>{lore.summary_th}</p><blockquote>“{lore.motto_th}”</blockquote></section>
    <section className="chronicle-body">
      <article><small>I · ORIGIN</small><h3>ต้นกำเนิด</h3><p>{lore.origin_th}</p></article>
      <article><small>II · CULTURE</small><h3>วิถีและวัฒนธรรม</h3><p>{lore.culture_th}</p></article>
      <article><small>III · BELIEF</small><h3>ความเชื่อ</h3><p>{lore.beliefs_th}</p></article>
      <article><small>IV · RELATIONS</small><h3>สายสัมพันธ์ระหว่างเผ่า</h3><p>{lore.relations_th}</p></article>
      <article className="chronicle-home"><small>STARTING ZONE</small><h3>{location.name_th}</h3><b>{location.name_en}</b><p>{lore.homeland_th}</p><em>{location.description_th}</em></article>
      <article className="chronicle-traits"><small>ANCESTRAL TRAITS</small><h3>พรจากสายเลือด</h3><div>{Object.entries(catalog.bonuses).map(([key, value]) => <span key={key}><strong>+{value}</strong>{STAT_LABELS[key as StatKey].label}</span>)}</div><p>ความสามารถพิเศษประจำเผ่าจะถูกเปิดเผยเมื่อสร้างตัวละครในขั้นถัดไป</p></article>
    </section>
  </main>;
}
