import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAMAGE_TYPES = ["fire", "cold", "lightning", "radiant", "bludgeoning", "piercing", "slashing", "poison", "psychic"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const characterId = String(body?.characterId ?? "");
  const monsterId = String(body?.monsterId ?? "");
  const notes = String(body?.notes ?? "").trim();
  const guessedWeakness = body?.guessedWeakness ? String(body.guessedWeakness) : null;
  if (!UUID.test(characterId) || !UUID.test(monsterId) || notes.length > 1000 || (guessedWeakness !== null && !DAMAGE_TYPES.includes(guessedWeakness))) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { data, error } = await supabase.rpc("record_bestiary_observation", { target_character_id: characterId, target_monster_id: monsterId, target_notes: notes, target_guessed_weakness: guessedWeakness });
  if (error || !data) {
    const code = error?.message.includes("player required") ? "player_required" : error?.message.includes("not found") ? "not_found" : "record_failed";
    return NextResponse.json({ error: code }, { status: code === "player_required" ? 403 : code === "not_found" ? 404 : 500 });
  }
  return NextResponse.json({ entry: data }, { status: 201 });
}
