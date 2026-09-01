import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { isValidInventory, isValidSheetStats } from "../../../../lib/characters/sheet";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const hpCurrent = Number(body.hpCurrent);
  const hpMax = Number(body.hpMax);
  if (!Number.isInteger(hpCurrent) || !Number.isInteger(hpMax) || hpMax < 1 || hpMax > 9999 || hpCurrent < 0 || hpCurrent > hpMax) {
    return NextResponse.json({ error: "invalid_hp" }, { status: 400 });
  }
  if (!isValidSheetStats(body.stats)) return NextResponse.json({ error: "invalid_stats" }, { status: 400 });
  if (!isValidInventory(body.inventory)) return NextResponse.json({ error: "invalid_inventory" }, { status: 400 });

  const { data, error } = await supabase.from("characters").update({
    hp_current: hpCurrent,
    hp_max: hpMax,
    strength: body.stats.strength,
    dexterity: body.stats.dexterity,
    constitution: body.stats.constitution,
    intelligence: body.stats.intelligence,
    wisdom: body.stats.wisdom,
    charisma: body.stats.charisma,
    inventory: body.inventory.map((item: { id: string; name: string; quantity: number; note: string }) => ({
      id: item.id,
      name: item.name.trim(),
      quantity: item.quantity,
      note: item.note.trim(),
    })),
  }).eq("id", id).eq("user_id", user.id).select("updated_at").maybeSingle();

  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ updatedAt: data.updated_at });
}

