import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { RACES } from "../../../lib/characters/catalog";

export const metadata: Metadata = { title: "Race Lore — Mythweave" };

export default async function RaceLoreIndex({ searchParams }: { searchParams: Promise<{ character?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { character } = await searchParams;
  const { data: lore } = await supabase.from("race_lore").select("race_id,name_th,title_th,summary_th,motto_th,accent_color,sigil,world_locations(name_th)").order("race_id");
  return <main className="race-lore-shell">
    <header><Link href={character ? `/characters/${character}` : "/lobby"}>← {character ? "Character Sheet" : "Lobby"}</Link><span>MYTHWEAVE · ARCHIVE OF PEOPLES</span><i>CODEX I</i></header>
    <section className="race-lore-hero"><small>SIX BLOODLINES · ONE CONTINENT</small><h1>ชนเผ่าแห่งเอเธอร์รา</h1><p>ประวัติศาสตร์ วัฒนธรรม ความเชื่อ และบ้านเกิดของผู้คนที่ร่วมถักทอโลก</p></section>
    <section className="race-lore-grid">{(lore ?? []).map((entry) => {
      const catalog = RACES.find((race) => race.id === entry.race_id);
      const location = entry.world_locations as unknown as { name_th: string } | null;
      return <Link href={`/lore/races/${entry.race_id}${character ? `?character=${character}` : ""}`} style={{ "--race-accent": entry.accent_color } as React.CSSProperties} key={entry.race_id}>
        <div className="race-lore-sigil">{entry.sigil}</div><small>{catalog?.tagline}</small><h2>{entry.name_th}</h2><b>{entry.title_th}</b><p>{entry.summary_th}</p><footer><span>จุดเริ่มต้น · {location?.name_th}</span><i>เปิดบันทึก →</i></footer>
      </Link>;
    })}</section>
  </main>;
}
