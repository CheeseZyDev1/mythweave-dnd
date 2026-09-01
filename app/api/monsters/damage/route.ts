import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAMAGE_TYPES = ["fire", "cold", "lightning", "radiant", "bludgeoning", "piercing", "slashing", "poison", "psychic"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const monsterId = String(body?.monsterId ?? "");
  const damageType = String(body?.damageType ?? "");
  const baseDamage = Number(body?.baseDamage);
  if (!UUID.test(monsterId) || !DAMAGE_TYPES.includes(damageType) || !Number.isInteger(baseDamage) || baseDamage < 1 || baseDamage > 999) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { data, error } = await supabase.rpc("resolve_monster_weakness_hit", { target_monster_id: monsterId, target_damage_type: damageType, target_base_damage: baseDamage });
  if (error || !data) {
    const code = error?.message.includes("dm required") ? "dm_required" : error?.message.includes("not found") ? "not_found" : "damage_failed";
    return NextResponse.json({ error: code }, { status: code === "dm_required" ? 403 : code === "not_found" ? 404 : 500 });
  }
  return NextResponse.json({ result: data });
}
