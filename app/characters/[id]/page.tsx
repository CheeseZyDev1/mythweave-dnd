import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { DEFAULT_APPEARANCE, type Appearance, type Stats } from "../../../lib/characters/catalog";
import type { InventoryItem } from "../../../lib/characters/sheet";
import { CharacterSheet } from "./character-sheet";

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

  const stats: Stats = {
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
  };

  return <CharacterSheet character={{
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

