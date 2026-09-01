import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const displayName = String(user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Adventurer").trim().slice(0, 40);

  if (action === "create") {
    const { data, error } = await supabase.rpc("create_dice_table", { member_name: displayName }).single<{ table_id: string; table_code: string }>();
    if (error || !data) return NextResponse.json({ error: "create_failed" }, { status: 500 });
    return NextResponse.json({ tableId: data.table_id, code: data.table_code }, { status: 201 });
  }

  if (action === "join") {
    const code = String(body?.code ?? "").trim().toUpperCase();
    const role = String(body?.role ?? "player").toLowerCase();
    if (!/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(code)) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    if (!["player", "dm", "spectator"].includes(role)) return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    const { data, error } = await supabase.rpc("join_dice_table", { invite_code: code, member_name: displayName, requested_role: role }).single<{ table_id: string; table_code: string }>();
    if (error || !data) return NextResponse.json({ error: "table_not_found" }, { status: 404 });
    return NextResponse.json({ tableId: data.table_id, code: data.table_code });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
