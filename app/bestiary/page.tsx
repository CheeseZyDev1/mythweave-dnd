import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { BestiaryClient } from "./bestiary-client";

export const metadata: Metadata = { title: "Bestiary — Mythweave" };

export default async function BestiaryPage({searchParams}:{searchParams:Promise<{character?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth");const{character:characterId}=await searchParams;if(!characterId)redirect("/lobby");
  const[{data:character},{data:entries},{data:monsters}]=await Promise.all([supabase.from("characters").select("id,name").eq("id",characterId).maybeSingle(),supabase.from("character_bestiary_entries").select("id,monster_name,biome,signature_trait,encounter_count,notes,guessed_weakness,discovered_weakness,updated_at").eq("character_id",characterId).order("updated_at",{ascending:false}),supabase.from("generated_monsters").select("id,name_th,biome,challenge_tier,traits,created_at").order("created_at",{ascending:false}).limit(30)]);if(!character)notFound();
  return <BestiaryClient character={character} initialEntries={entries??[]} monsters={monsters??[]}/>;
}
