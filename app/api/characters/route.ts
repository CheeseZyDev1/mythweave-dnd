import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { findClass, findRace } from "../../../lib/characters/catalog";
import { finalStats, isValidAppearance, isValidStats, startingHp } from "../../../lib/characters/rules";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const race = String(body.race ?? "");
  const characterClass = String(body.characterClass ?? "");
  if (name.length < 2 || name.length > 24 || !/^[\p{L}\p{M}\p{N} ._'-]+$/u.test(name)) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  if (!findRace(race) || !findClass(characterClass)) return NextResponse.json({ error: "invalid_archetype" }, { status: 400 });
  if (!isValidStats(body.stats)) return NextResponse.json({ error: "invalid_stats" }, { status: 400 });
  if (!isValidAppearance(body.appearance)) return NextResponse.json({ error: "invalid_appearance" }, { status: 400 });

  const { count } = await supabase.from("characters").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 10) return NextResponse.json({ error: "character_limit" }, { status: 409 });

  const stats = finalStats(body.stats, race);
  const hp = startingHp(characterClass, stats);
  const { data, error } = await supabase.from("characters").insert({
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
  }).select("id").single();

  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
