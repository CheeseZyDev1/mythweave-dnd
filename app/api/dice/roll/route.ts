import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { DICE_SIDES } from "../../../../lib/dice/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const tableId = String(body?.tableId ?? "");
  const diceCount = Number(body?.diceCount);
  const diceSides = Number(body?.diceSides);
  const modifier = Number(body?.modifier);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tableId)
    || !Number.isInteger(diceCount) || diceCount < 1 || diceCount > 10
    || !DICE_SIDES.includes(diceSides as (typeof DICE_SIDES)[number])
    || !Number.isInteger(modifier) || modifier < -100 || modifier > 100) {
    return NextResponse.json({ error: "invalid_roll" }, { status: 400 });
  }

  const { data: member } = await supabase.from("dice_table_members").select("display_name").eq("table_id", tableId).eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "not_a_member" }, { status: 403 });

  const rolls = Array.from({ length: diceCount }, () => randomInt(1, diceSides + 1));
  const total = rolls.reduce((sum, value) => sum + value, 0) + modifier;
  const { data, error } = await supabase.from("dice_rolls").insert({
    table_id: tableId,
    user_id: user.id,
    roller_name: member.display_name,
    dice_count: diceCount,
    dice_sides: diceSides,
    modifier,
    rolls,
    total,
  }).select("*").single();
  if (error || !data) return NextResponse.json({ error: "roll_failed" }, { status: 500 });
  return NextResponse.json({ roll: data }, { status: 201 });
}

