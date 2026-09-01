import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { BestiaryClient, type Sharing } from "./bestiary-client";

export const metadata: Metadata = { title: "Bestiary — Mythweave" };

export default async function BestiaryPage({searchParams}:{searchParams:Promise<{character?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth");const{character:characterId}=await searchParams;if(!characterId)redirect("/lobby");
  const[{data:character},{data:entries},{data:monsters},{data:members},{data:shares},{data:guilds},{data:contributions}]=await Promise.all([supabase.from("characters").select("id,name").eq("id",characterId).maybeSingle(),supabase.from("character_bestiary_entries").select("id,monster_name,biome,signature_trait,encounter_count,notes,guessed_weakness,discovered_weakness,updated_at").eq("character_id",characterId).order("updated_at",{ascending:false}),supabase.from("generated_monsters").select("id,name_th,biome,challenge_tier,traits,created_at").order("created_at",{ascending:false}).limit(30),supabase.from("dice_table_members").select("table_id,user_id,display_name,role,dice_tables(code)"),supabase.from("bestiary_shares").select("id,entry_id,sender_user_id,share_mode,table_id,recipient_user_id,monster_name,biome,signature_trait,encounter_count,notes,discovered_weakness,created_at").order("created_at",{ascending:false}),supabase.from("guilds").select("id,name_th,emblem").order("id"),supabase.from("bestiary_guild_contributions").select("id,entry_id,guild_id,contribution_mode,payout_copper,affinity_delta,created_at").eq("character_id",characterId).order("created_at",{ascending:false})]);if(!character)notFound();
  const sharing:Sharing={members:(members??[]).map(member=>({...member,dice_tables:Array.isArray(member.dice_tables)?member.dice_tables[0]??null:member.dice_tables})),shares:shares??[],guilds:guilds??[],contributions:contributions??[]};
  return <BestiaryClient character={character} currentUserId={user.id} initialEntries={entries??[]} monsters={monsters??[]} sharing={sharing}/>;
}
