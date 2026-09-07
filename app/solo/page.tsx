import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { SoloConsole } from "./solo-console";

export const metadata: Metadata = { title: "Solo Expedition — Mythweave" };

function thaiDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default async function SoloPage({ searchParams }: { searchParams: Promise<{ character?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const id = (await searchParams).character;
  if (!id) redirect("/lobby");
  const [{ data: character }, { data: position }, { data: session }, { data: life }, { data: revivalStack }, { count: diligenceDays }, { data: latestDay }, { data: diligenceReward }] = await Promise.all([
    supabase.from("characters").select("id,name,level,hp_current,hp_max").eq("id", id).maybeSingle(),
    supabase.from("character_world_positions").select("location_id,world_locations(name_th,location_type,danger_level)").eq("character_id", id).maybeSingle(),
    supabase.from("solo_adventures").select("id,status,started_at,started_location_id").eq("character_id", id).eq("status", "active").maybeSingle(),
    supabase.from("solo_life_states").select("status,death_count,revival_count,last_cause,last_died_at,last_revived_at").eq("character_id", id).maybeSingle(),
    supabase.from("character_item_stacks").select("quantity,content_items!inner(slug)").eq("character_id", id).eq("content_items.slug", "phoenix-ember").maybeSingle(),
    supabase.from("solo_diligence_days").select("id", { count: "exact", head: true }).eq("character_id", id),
    supabase.from("solo_diligence_days").select("activity_date").eq("character_id", id).order("activity_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("solo_diligence_rewards").select("id").eq("character_id", id).maybeSingle(),
  ]);
  if (!character) notFound();
  const raw = position?.world_locations as unknown;
  const location = (Array.isArray(raw) ? raw[0] : raw) as { name_th: string; location_type: string; danger_level: number } | null;
  return <SoloConsole character={character} location={location} initialSession={session} initialLife={life ?? { status: "alive", death_count: 0, revival_count: 0, last_cause: null }} initialRevivalItems={revivalStack?.quantity ?? 0} initialDiligence={{ daysMarked: diligenceDays ?? 0, markedToday: latestDay?.activity_date === thaiDate(), rewardOwned: Boolean(diligenceReward) }} />;
}
