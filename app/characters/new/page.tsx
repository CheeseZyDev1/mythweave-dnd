import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { CharacterCreator } from "./character-creator";

export const metadata: Metadata = { title: "สร้างตัวละคร — Mythweave" };

export default async function NewCharacterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const{data:dimensions}=await supabase.from("dimension_presets").select("id,slug,name_th,difficulty_label_th,accent_color").eq("active",true).order("sort_order");
  return <CharacterCreator dimensions={dimensions??[]} />;
}
