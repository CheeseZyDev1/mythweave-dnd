import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const tableId = params.get("tableId") ?? "";
  if (!UUID.test(tableId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { data: table } = await supabase.from("dice_tables").select("id").eq("id", tableId).maybeSingle();
  if (!table) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const sides = Number(params.get("sides") ?? 0);
  const roller = (params.get("roller") ?? "").replace(/[%_,]/g, "").trim().slice(0, 40);
  const cursor = params.get("cursor");
  let query = supabase.from("dice_rolls").select("*").eq("table_id", tableId).order("created_at", { ascending: false }).limit(50);
  if ([4, 6, 8, 10, 12, 20, 100].includes(sides)) query = query.eq("dice_sides", sides);
  if (roller) query = query.ilike("roller_name", `%${roller}%`);
  if (cursor && !Number.isNaN(Date.parse(cursor))) query = query.lt("created_at", cursor);
  const [{ data: rolls, error }, { data: summary, error: summaryError }] = await Promise.all([query, supabase.rpc("dice_roll_history_summary", { target_table_id: tableId })]);
  if (error || summaryError) return NextResponse.json({ error: "history_failed" }, { status: 500 });
  return NextResponse.json({ rolls, summary, nextCursor: rolls?.length === 50 ? rolls.at(-1)?.created_at : null });
}
