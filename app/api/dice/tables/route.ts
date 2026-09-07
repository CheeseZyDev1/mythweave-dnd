import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const displayName = String(user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Adventurer").trim().slice(0, 40);
  const {data:activeSolo}=await supabase.from("solo_adventures").select("character_id").eq("status","active").maybeSingle();
  let isGhost=false;
  if(activeSolo){const{data:life}=await supabase.from("solo_life_states").select("status").eq("character_id",activeSolo.character_id).maybeSingle();isGhost=life?.status==="dead";}

  if (action === "create") {
    if(activeSolo)return NextResponse.json({error:"solo_mode_active"},{status:409});
    const { data, error } = await supabase.rpc("create_dice_table", { member_name: displayName }).single<{ table_id: string; table_code: string }>();
    if (error || !data) return NextResponse.json({ error: "create_failed" }, { status: 500 });
    return NextResponse.json({ tableId: data.table_id, code: data.table_code }, { status: 201 });
  }

  if (action === "join") {
    const code = String(body?.code ?? "").trim().toUpperCase();
    const role = String(body?.role ?? "player").toLowerCase();
    if (!/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(code)) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    if (!["player", "dm", "spectator"].includes(role)) return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    if(activeSolo&&!isGhost)return NextResponse.json({error:"solo_mode_active"},{status:409});
    if(isGhost&&role!=="spectator")return NextResponse.json({error:"ghost_spectator_only"},{status:409});
    const { data, error } = await supabase.rpc("join_dice_table", { invite_code: code, member_name: displayName, requested_role: role }).single<{ table_id: string; table_code: string }>();
    if (error || !data){const detail=error?.message??"";const errorCode=detail.includes("ghost spectator only")?"ghost_spectator_only":detail.includes("solo mode forbids rooms")?"solo_mode_active":"table_not_found";return NextResponse.json({error:errorCode},{status:errorCode==="table_not_found"?404:409});}
    return NextResponse.json({ tableId: data.table_id, code: data.table_code, ghost: isGhost });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
