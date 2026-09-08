import type {Metadata} from "next";
import {notFound,redirect} from "next/navigation";
import {createClient} from "../../lib/supabase/server";
import {FactionsClient} from "./factions-client";
export const metadata:Metadata={title:"Faction Reputation — Mythweave"};
export default async function FactionsPage({searchParams}:{searchParams:Promise<{character?:string}>}){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth");const{character:characterId}=await searchParams;if(!characterId)redirect("/lobby");const[{data:character},{data:standings,error}]=await Promise.all([supabase.from("characters").select("id,name").eq("id",characterId).maybeSingle(),supabase.rpc("faction_standings",{target_character_id:characterId})]);if(!character||error)notFound();return <FactionsClient character={character} initialStandings={standings??[]}/>;}
