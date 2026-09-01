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
  const slot = Number(body?.slot);
  if (!UUID.test(tableId) || !Number.isInteger(slot) || slot < 1 || slot > 3) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  if (action === "save") {
    const name = String(body?.name ?? "").trim().slice(0, 60) || `Save Slot ${slot}`;
    const { data, error } = await supabase.rpc("save_room_snapshot", { target_table_id: tableId, target_slot: slot, target_name: name }).single();
    if (error || !data) return NextResponse.json({ error: error?.message.includes("dm required") ? "dm_required" : "save_failed" }, { status: error?.message.includes("dm required") ? 403 : 500 });
    return NextResponse.json({ save: data });
  }
  if (action === "load") {
    const { data, error } = await supabase.rpc("load_room_snapshot", { target_table_id: tableId, target_slot: slot }).single();
    const code = error?.message.includes("dm required") ? "dm_required" : error?.message.includes("save not found") ? "not_found" : "load_failed";
    if (error || !data) return NextResponse.json({ error: code }, { status: code === "dm_required" ? 403 : code === "not_found" ? 404 : 500 });
    return NextResponse.json({ save: data });
  }
  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}

