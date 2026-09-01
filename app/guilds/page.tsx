import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { GuildsClient } from "./guilds-client";
export const metadata:Metadata={title:"Guild Standing — Mythweave"};
export default async function GuildsPage({searchParams}:{searchParams:Promise<{character?:string}>}){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth");const{character:characterId}=await searchParams;if(!characterId)redirect("/lobby");const[{data:character},{data:standings,error}]=await Promise.all([supabase.from("characters").select("id,name").eq("id",characterId).maybeSingle(),supabase.rpc("guild_standings",{target_character_id:characterId})]);if(!character||error)notFound();return <GuildsClient character={character} initialStandings={standings??[]}/>;}
