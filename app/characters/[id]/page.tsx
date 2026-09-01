import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { DEFAULT_APPEARANCE, type Appearance, type Stats } from "../../../lib/characters/catalog";
import type { InventoryItem } from "../../../lib/characters/sheet";
import { CharacterSheet } from "./character-sheet";
import type { WalletTransaction } from "../../../lib/wallet/types";

export const metadata: Metadata = { title: "Character Sheet — Mythweave" };

type Props = { params: Promise<{ id: string }> };

export default async function CharacterSheetPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { id } = await params;
  const { data: character } = await supabase.from("characters")
    .select("id,name,race,character_class,level,experience,hp_current,hp_max,strength,dexterity,constitution,intelligence,wisdom,charisma,appearance,inventory,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!character) notFound();
  const [{ data: wallet }, { data: transactions }, {data:statusTemplates},{data:statusEffects},{data:innateAssignment}] = await Promise.all([
    supabase.from("character_wallets").select("balance_copper").eq("character_id",id).maybeSingle(),
    supabase.from("wallet_transactions").select("*").eq("character_id",id).order("created_at",{ascending:false}).limit(20),
    supabase.from("status_effect_templates").select("id,name_th,effect_type,description_th,default_duration,max_stacks").order("effect_type").order("id"),
    supabase.from("character_status_effects").select("id,template_id,name_th,effect_type,description_th,duration_remaining,stacks,source").eq("character_id",id).order("applied_at"),
    supabase.from("character_innate_abilities").select("assigned_at,innate_abilities(name_th,description_th,activation,effect_key,effect_value,usage_rule_th)").eq("character_id",id).maybeSingle(),
  ]);

  const stats: Stats = {
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
  };

  const innate = innateAssignment?.innate_abilities as unknown as {name_th:string;description_th:string;activation:string;effect_key:string;effect_value:number;usage_rule_th:string}|null;
  return <CharacterSheet innate={innate} statuses={{templates:statusTemplates??[],effects:statusEffects??[]}} wallet={{balance:wallet?.balance_copper??0,transactions:(transactions??[]) as WalletTransaction[]}} character={{
    id: character.id,
    name: character.name,
    race: character.race,
    characterClass: character.character_class,
    level: character.level,
    experience: character.experience,
    hpCurrent: character.hp_current,
    hpMax: character.hp_max,
    stats,
    appearance: (character.appearance as Appearance) ?? DEFAULT_APPEARANCE,
    inventory: Array.isArray(character.inventory) ? character.inventory as InventoryItem[] : [],
    updatedAt: character.updated_at,
  }} />;
}
