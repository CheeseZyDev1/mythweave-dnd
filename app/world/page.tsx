import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import type { Appearance } from "../../lib/characters/catalog";
import { WorldMap } from "./world-map";

export const metadata: Metadata = { title: "World Map — Mythweave" };

export default async function WorldPage({ searchParams }: { searchParams: Promise<{ character?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { character: characterId } = await searchParams;
  if (!characterId) redirect("/lobby");
  const { data: character } = await supabase.from("characters").select("id,name,race,character_class,appearance").eq("id", characterId).maybeSingle();
  if (!character) notFound();
  const { data: position, error: positionError } = await supabase.rpc("ensure_character_world_position", { target_character_id: characterId });
  if (positionError || !position) notFound();
  const [{ data: locations }, { data: routes }, { data: journey }] = await Promise.all([
    supabase.from("world_locations").select("*").order("id"),
    supabase.from("world_routes").select("*").order("id"),
    supabase.from("character_journeys").select("id,to_location_id,travel_mode,duration_hours,elapsed_hours,travel_encounter_templates(name_th,description_th)").eq("character_id", characterId).eq("status", "encounter").maybeSingle(),
  ]);
  const encounter = journey?.travel_encounter_templates as unknown as { name_th: string; description_th: string } | null;
  const { data: weather } = await supabase.rpc("get_character_weather", { target_character_id: characterId });
  const { data: villageEvent } = await supabase.rpc("get_or_create_village_event", { target_character_id: characterId });
  return <WorldMap
    character={{ id: character.id, name: character.name, race: character.race, characterClass: character.character_class, appearance: character.appearance as Appearance }}
    locations={locations ?? []}
    routes={routes ?? []}
    initialLocationId={position.location_id}
    initialWorldHours={position.world_hours_elapsed ?? 0}
    initialWeather={weather ?? { slug: "clear", name_th: "ท้องฟ้าโปร่ง", description_th: "ท้องฟ้าสงบ", symbol: "☀", travel_note_th: "เดินทางตามปกติ", intensity: 1, period_index: 0, next_change_in_hours: 6 }}
    initialVillageEvent={villageEvent}
    initialJourney={journey ? { id: journey.id, destinationId: journey.to_location_id, mode: journey.travel_mode, durationHours: journey.duration_hours, elapsedHours: journey.elapsed_hours, encounterName: encounter?.name_th ?? "เหตุการณ์ระหว่างทาง", encounterDescription: encounter?.description_th ?? "มีบางอย่างทำให้การเดินทางหยุดลง" } : null}
  />;
}
