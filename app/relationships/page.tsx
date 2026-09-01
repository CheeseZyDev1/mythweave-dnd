import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { RelationshipsClient } from "./relationships-client";

export const metadata: Metadata = { title: "NPC Relationships — Mythweave" };
type Props = { searchParams: Promise<{ character?: string }> };

export default async function RelationshipsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { character: characterId } = await searchParams;
  if (!characterId) redirect("/lobby");
  const [{ data: character }, { data: profiles }, { data: affinities }] =
    await Promise.all([
      supabase.from("characters").select("id,name").eq("id", characterId).maybeSingle(),
      supabase.from("npc_profiles").select("*").order("id"),
      supabase.from("character_npc_affinity").select("id,npc_id,score,interactions,last_interaction_at").eq("character_id", characterId),
    ]);
  if (!character) notFound();
  return <RelationshipsClient character={character} profiles={profiles ?? []} initialAffinities={affinities ?? []} />;
}
