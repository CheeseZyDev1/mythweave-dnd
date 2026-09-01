import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {createClient} from "../../lib/supabase/server";
import {CodexClient} from "./codex-client";

export const metadata:Metadata={title:"Codex — Mythweave"};

export default async function CodexPage({searchParams}:{searchParams:Promise<{character?:string;section?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth");
  const{data:characters}=await supabase.from("characters").select("id,name,level,race").order("updated_at",{ascending:false});if(!characters?.length)redirect("/characters/new");
  const params=await searchParams;const character=characters.find(item=>item.id===params.character)??characters[0];const initialTab=["bestiary","items","lore","rates"].includes(params.section??"")?params.section as "bestiary"|"items"|"lore"|"rates":"bestiary";
  const[{data:entries},{data:shares},{data:items},{data:relics},{data:lore}]=await Promise.all([
    supabase.from("character_bestiary_entries").select("id,monster_name,biome,signature_trait,encounter_count,notes,discovered_weakness,updated_at").eq("character_id",character.id).order("updated_at",{ascending:false}),
    supabase.from("bestiary_shares").select("id,monster_name,biome,signature_trait,encounter_count,notes,discovered_weakness,share_mode,created_at").order("created_at",{ascending:false}),
    supabase.from("content_items").select("id,name_th,name_en,rarity,category,base_value,weight,tags,properties").eq("active",true).order("rarity").order("name_th"),
    supabase.from("generated_items").select("id,name_th,rarity,category,power_rating,properties,created_at").eq("character_id",character.id).order("created_at",{ascending:false}),
    supabase.from("race_lore").select("race_id,name_th,title_th,summary_th,motto_th,sigil,accent_color").eq("active",true).order("race_id")
  ]);
  return <CodexClient characters={characters} character={character} entries={entries??[]} shares={shares??[]} items={items??[]} relics={relics??[]} lore={lore??[]} initialTab={initialTab}/>;
}
