import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import {
  findClass,
  findProfession,
  findRace,
} from "../../../lib/characters/catalog";
import {
  finalStats,
  isValidAppearance,
  isValidStats,
  startingHp,
} from "../../../lib/characters/rules";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const name = String(body.name ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const race = String(body.race ?? "");
  const characterClass = String(body.characterClass ?? "");
  const profession = String(body.profession ?? "chronicler");
  const dimensionId = String(body.dimensionId ?? "");
  if (
    name.length < 2 ||
    name.length > 24 ||
    !/^[\p{L}\p{M}\p{N} ._'-]+$/u.test(name)
  )
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  if (!findRace(race) || !findClass(characterClass))
    return NextResponse.json({ error: "invalid_archetype" }, { status: 400 });
  if (!findProfession(profession))
    return NextResponse.json({ error: "invalid_calling" }, { status: 400 });
  const { data: dimension } = await supabase
    .from("dimension_presets")
    .select("id")
    .eq("id", dimensionId)
    .eq("active", true)
    .maybeSingle();
  if (!dimension)
    return NextResponse.json({ error: "invalid_dimension" }, { status: 400 });
  if (!isValidStats(body.stats))
    return NextResponse.json({ error: "invalid_stats" }, { status: 400 });
  if (!isValidAppearance(body.appearance))
    return NextResponse.json({ error: "invalid_appearance" }, { status: 400 });

  const { count } = await supabase
    .from("characters")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 10)
    return NextResponse.json({ error: "character_limit" }, { status: 409 });

  const stats = finalStats(body.stats, race);
  const hp = startingHp(characterClass, stats);
  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: user.id,
      name,
      race,
      character_class: characterClass,
      strength: stats.strength,
      dexterity: stats.dexterity,
      constitution: stats.constitution,
      intelligence: stats.intelligence,
      wisdom: stats.wisdom,
      charisma: stats.charisma,
      hp_current: hp,
      hp_max: hp,
      appearance: body.appearance,
      dimension_id: dimension.id,
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  const { error: callingError } = await supabase.rpc(
    "configure_character_calling",
    {
      target_character_id: data.id,
      target_secondary_class: null,
      target_profession_id: profession,
    },
  );
  if (callingError) {
    await supabase.from("characters").delete().eq("id", data.id);
    return NextResponse.json({ error: "calling_failed" }, { status: 500 });
  }
  const [{ data: starterItems }, { data: starterSkills }, { data: blessing }] =
    await Promise.all([
      supabase
        .from("character_item_stacks")
        .select("quantity,content_items!inner(name_th,category,rarity)")
        .eq("character_id", data.id)
        .neq("content_items.rarity", "soulbound"),
      supabase
        .from("character_skills")
        .select("skill_definitions(id,name_th,description_th,effect_type)")
        .eq("character_id", data.id),
      supabase
        .from("character_divine_blessings")
        .select(
          "definition:divine_blessing_definitions(tier,name_th,deity_th,description_th)",
        )
        .eq("character_id", data.id)
        .maybeSingle(),
    ]);
  const normalizedItems = (starterItems ?? []).flatMap((item) => {
    const details = Array.isArray(item.content_items)
      ? item.content_items[0]
      : item.content_items;
    return details ? [{ quantity: item.quantity, content_items: details }] : [];
  });
  const normalizedSkills = (starterSkills ?? []).flatMap(
    (item) => item.skill_definitions ?? [],
  );
  const divineBlessing = Array.isArray(blessing?.definition)
    ? (blessing.definition[0] ?? null)
    : (blessing?.definition ?? null);
  return NextResponse.json(
    {
      id: data.id,
      starterItems: normalizedItems,
      starterSkills: normalizedSkills,
      divineBlessing,
    },
    { status: 201 },
  );
}
