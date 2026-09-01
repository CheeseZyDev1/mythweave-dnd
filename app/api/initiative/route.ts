import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const tableId = String(body?.tableId ?? "");
  if (!UUID.test(tableId)) return NextResponse.json({ error: "invalid_table" }, { status: 400 });

  const { data: member } = await supabase.from("dice_table_members").select("user_id").eq("table_id", tableId).eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "not_a_member" }, { status: 403 });

  if (action === "add") {
    const name = String(body?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    const initiative = Number(body?.initiative);
    if (!name || !Number.isInteger(initiative) || initiative < -10 || initiative > 99) return NextResponse.json({ error: "invalid_entry" }, { status: 400 });
    const { data, error } = await supabase.from("initiative_entries").insert({ table_id: tableId, created_by: user.id, name, initiative }).select("*").single();
    if (error || !data) return NextResponse.json({ error: "add_failed" }, { status: 500 });
    return NextResponse.json({ entry: data }, { status: 201 });
  }

  if (action === "remove") {
    const entryId = String(body?.entryId ?? "");
    if (!UUID.test(entryId)) return NextResponse.json({ error: "invalid_entry" }, { status: 400 });
    const { error } = await supabase.from("initiative_entries").delete().eq("id", entryId).eq("table_id", tableId);
    if (error) return NextResponse.json({ error: "remove_failed" }, { status: 500 });
    return NextResponse.json({ removed: entryId });
  }

  if (action === "next") {
    const { data, error } = await supabase.rpc("advance_initiative", { target_table_id: tableId }).single<{ current_entry: string | null; new_round: number; is_active: boolean }>();
    if (error || !data) return NextResponse.json({ error: "advance_failed" }, { status: 500 });
    return NextResponse.json({ tracker: { table_id: tableId, current_entry_id: data.current_entry, round_number: data.new_round, active: data.is_active, updated_at: new Date().toISOString() } });
  }

  if (action === "reset") {
    const { error } = await supabase.rpc("reset_initiative", { target_table_id: tableId });
    if (error) return NextResponse.json({ error: "reset_failed" }, { status: 500 });
    return NextResponse.json({ reset: true });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
